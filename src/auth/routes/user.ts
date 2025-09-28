import { Router } from "express";
import { body, validationResult } from "express-validator";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { authMiddleware } from "../middleware/auth.js";

const prisma = new PrismaClient();
const router = Router();

// Get profile
router.get("/me", authMiddleware, async (req, res) => {
  const user = (req as any).user;
  res.json({
    id: user.id,
    name: user.name,
    email: user.email,
    address: user.address,
  });
});

// Update profile
router.put(
  "/me",
  authMiddleware,
  body("name").optional().notEmpty(),
  body("address").optional().notEmpty(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ errors: errors.array() });

    const user = (req as any).user;
    const { name, address } = req.body as { name?: string; address?: string };

    try {
      const updated = await prisma.user.update({
        where: { id: user.id },
        data: { ...(name ? { name } : {}), ...(address ? { address } : {}) },
      });
      res.json({
        id: updated.id,
        name: updated.name,
        email: updated.email,
        address: updated.address,
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ msg: "Server error" });
    }
  }
);

// Update password
router.put(
  "/me/password",
  authMiddleware,
  body("oldPassword").notEmpty(),
  body("newPassword").isLength({ min: 6 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ errors: errors.array() });

    const user = (req as any).user;
    const { oldPassword, newPassword } = req.body as {
      oldPassword: string;
      newPassword: string;
    };

    try {
      // If user has no hashedPassword (OAuth-only) deny
      if (!user.hashedPassword) {
        return res
          .status(400)
          .json({ msg: "Cannot change password for OAuth-only account" });
      }

      const ok = await bcrypt.compare(oldPassword, user.hashedPassword);
      if (!ok) return res.status(401).json({ msg: "Old password incorrect" });

      const hashed = await bcrypt.hash(newPassword, 10);
      await prisma.user.update({
        where: { id: user.id },
        data: { hashedPassword: hashed },
      });
      res.json({ msg: "Password updated" });
    } catch (err) {
      console.error(err);
      res.status(500).json({ msg: "Server error" });
    }
  }
);

export default router;
