import express from "express";
import Stripe from "stripe";
import prisma from "../../db/prisma";
const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: "2025-08-27.basil",
});
/**
 * Note:
 * - index.ts must mount this route with express.raw({ type: 'application/json' })
 *   so that req.body is the raw Buffer required by stripe.webhooks.constructEvent.
 * - Example:
 *     app.use('/api/payments/webhook', express.raw({ type: 'application/json' }), webhooksRouter)
 */
router.post("/", async (req, res) => {
    const sig = req.headers["stripe-signature"] || undefined;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret || !sig) {
        console.error("Webhook secret or signature missing");
        return res.status(400).send("Webhook misconfigured");
    }
    let event;
    try {
        // express.raw sets req.body to the raw Buffer
        const rawBody = req.body;
        event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
    }
    catch (err) {
        console.error("⚠️ Webhook signature verification failed.", err?.message);
        return res.status(400).send(`Webhook Error: ${err?.message}`);
    }
    // process event asynchronously but keep response quick
    (async () => {
        try {
            switch (event.type) {
                case "payment_intent.succeeded": {
                    const pi = event.data.object;
                    const orderId = pi.metadata?.orderId;
                    // idempotency: skip if payment record already exists
                    const existingPayment = await prisma.payment.findUnique({
                        where: { stripeId: pi.id },
                    });
                    if (!existingPayment) {
                        let resolvedOrderId = orderId;
                        if (!resolvedOrderId) {
                            // fallback: find order by stripePaymentIntent
                            const order = await prisma.order.findUnique({
                                where: { stripePaymentIntent: pi.id },
                            });
                            resolvedOrderId = order?.id;
                        }
                        if (resolvedOrderId) {
                            await prisma.order.update({
                                where: { id: resolvedOrderId },
                                data: { status: "paid" },
                            });
                        }
                        else {
                            console.warn("Order not found for payment_intent.succeeded", pi.id);
                        }
                        // create payment record (guard for amount possibly undefined)
                        await prisma.payment.create({
                            data: {
                                orderId: resolvedOrderId ?? "",
                                stripeId: pi.id,
                                amountCents: typeof pi.amount === "number" ? pi.amount : 0,
                                currency: pi.currency ?? "usd",
                                status: "succeeded",
                            },
                        });
                    }
                    break;
                }
                case "payment_intent.payment_failed": {
                    const pi = event.data.object;
                    const orderId = pi.metadata?.orderId;
                    if (orderId) {
                        try {
                            await prisma.order.update({
                                where: { id: orderId },
                                data: { status: "failed" },
                            });
                        }
                        catch (e) {
                            console.error("Failed to mark order failed:", e);
                        }
                    }
                    break;
                }
                // add other events you care about here
                default:
                    console.log(`Unhandled event type ${event.type}`);
            }
        }
        catch (err) {
            console.error("Error processing webhook event:", err);
        }
    })();
    // respond quickly to Stripe
    res.json({ received: true });
});
export default router;
