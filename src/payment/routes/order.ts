import { Router } from "express";
import prisma from "../../db/prisma";
import Stripe from "stripe";
import { authMiddleware } from "../../auth/middleware/auth";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-08-27.basil",
});

const router = Router();

/**
 * Create Order and PaymentIntent
 * Body: none — uses current user's cart
 * Returns: { orderId, clientSecret }
 */
router.post("/", authMiddleware, async (req: any, res) => {
  const user = req.user;

  try {
    // 1) Load cart items and compute total server-side
    const cartItems = await prisma.cartItem.findMany({
      where: { userId: user.id },
      include: { pizza: true },
    });
    if (!cartItems.length) return res.status(400).json({ msg: "Cart empty" });

    // compute total in cents (pizza.priceCents is already integer cents)
    let totalCents = 0;
    const orderItemsData = cartItems.map(
      (ci: { pizza: { priceCents: any }; quantity: number; pizzaId: any }) => {
        const unitCents = ci.pizza.priceCents;
        totalCents += unitCents * ci.quantity;
        return {
          pizzaId: ci.pizzaId,
          quantity: ci.quantity,
          unitPrice: unitCents,
        };
      }
    );

    // 2) Create Order in DB (status = created)
    const order = await prisma.order.create({
      data: {
        userId: user.id,
        totalCents,
        currency: process.env.STRIPE_CURRENCY || "usd",
        status: "created",
        items: {
          create: orderItemsData,
        },
      },
      include: { items: true },
    });

    try {
      // 3) Create PaymentIntent with idempotency (use order.id as idempotency key)
      const paymentIntent = await stripe.paymentIntents.create(
        {
          amount: totalCents,
          currency: order.currency,
          metadata: { orderId: order.id, userId: user.id },
        },
        {
          idempotencyKey: `pi_${order.id}`,
        }
      );

      // 4) Save stripePaymentIntent on order
      await prisma.order.update({
        where: { id: order.id },
        data: { stripePaymentIntent: paymentIntent.id },
      });

      // 5) Return client_secret to client
      return res.json({
        orderId: order.id,
        clientSecret: paymentIntent.client_secret,
      });
    } catch (err: any) {
      // If PaymentIntent creation fails, mark order as failed
      await prisma.order.update({
        where: { id: order.id },
        data: { status: "failed" },
      });
      console.error("Stripe error:", err);
      return res.status(500).json({ error: "payment creation failed" });
    }
  } catch (err) {
    console.error(err);
    return res.status(500).json({ msg: "Server error" });
  }
});

export default router;
