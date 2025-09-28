import { Router } from "express";
import { body, validationResult } from "express-validator";
import prisma from "../../../db/prisma";
import { authMiddleware } from "../../../auth/middleware/auth";

const router = Router();

// Get cart items for user
router.get("/", authMiddleware, async (req: any, res) => {
  try {
    const user = req.user;
    const items = await prisma.cartItem.findMany({
      where: { userId: user.id },
      include: { pizza: true },
    });
    res.json(items);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server error" });
  }
});

// Add to cart — use upsert to avoid race conditions (requires @@unique([userId, pizzaId]) in schema)
router.post(
  "/",
  authMiddleware,
  body("pizzaId").notEmpty(),
  body("quantity").isInt({ gt: 0 }),
  async (req: any, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ errors: errors.array() });

    const { pizzaId, quantity } = req.body;
    const user = req.user;

    try {
      const pizza = await prisma.pizza.findUnique({ where: { id: pizzaId } });
      if (!pizza) return res.status(404).json({ msg: "Pizza not found" });

      // Upsert using the composite unique (userId + pizzaId). Prisma generates a compound field name
      const item = await prisma.cartItem.upsert({
        where: { userId_pizzaId: { userId: user.id, pizzaId } }, // depends on @@unique name in schema
        create: { userId: user.id, pizzaId, quantity },
        update: { quantity: { increment: quantity } },
        include: { pizza: true },
      });

      res.json(item);
    } catch (err) {
      console.error(err);
      res.status(500).json({ msg: "Server error" });
    }
  }
);

// Update cart item quantity
router.put(
  "/:id",
  authMiddleware,
  body("quantity").isInt({ gt: 0 }),
  async (req: any, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ errors: errors.array() });

    const { id } = req.params;
    const { quantity } = req.body;
    const user = req.user;

    try {
      const item = await prisma.cartItem.findUnique({ where: { id } });
      if (!item || item.userId !== user.id)
        return res.status(404).json({ msg: "Item not found" });

      const updated = await prisma.cartItem.update({
        where: { id },
        data: { quantity },
      });

      res.json(updated);
    } catch (err) {
      console.error(err);
      res.status(500).json({ msg: "Server error" });
    }
  }
);

// Remove item from cart
router.delete("/:id", authMiddleware, async (req: any, res) => {
  const { id } = req.params;
  const user = req.user;

  try {
    const item = await prisma.cartItem.findUnique({ where: { id } });
    if (!item || item.userId !== user.id)
      return res.status(404).json({ msg: "Item not found" });

    await prisma.cartItem.delete({ where: { id } });
    res.json({ msg: "Item removed from cart" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server error" });
  }
});

export default router;
