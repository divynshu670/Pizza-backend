import { Router } from "express";
import { body, validationResult } from "express-validator";
import { authMiddleware } from "../../auth/middleware/auth";
import prisma from "../../db/prisma";
const router = Router();
// Get all pizzas (public)
router.get("/", async (req, res) => {
    try {
        const pizzas = await prisma.pizza.findMany();
        res.json(pizzas);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ msg: "Server error" });
    }
});
// Add new pizza (for admin or testing — protect later if needed)
router.post("/", authMiddleware, body("name").notEmpty(), body("description").notEmpty(), body("imageUrl").isURL(), body("price").isFloat({ gt: 0 }), async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty())
        return res.status(400).json({ errors: errors.array() });
    const { name, description, imageUrl, price } = req.body;
    // convert dollars (float) to cents
    const priceCents = Math.round(price * 100);
    try {
        const pizza = await prisma.pizza.create({
            data: { name, description, imageUrl, priceCents },
        });
        res.json(pizza);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ msg: "Server error" });
    }
});
export default router;
