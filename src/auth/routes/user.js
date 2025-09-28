import { Router } from "express";
import { body, validationResult } from "express-validator";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { authMiddleware } from "../middleware/auth.js";
const prisma = new PrismaClient();
const router = Router();
// Get profile
router.get("/me", authMiddleware, async (req, res) => {
    const user = req.user;
    res.json({
        id: user.id,
        name: user.name,
        email: user.email,
        address: user.address,
    });
});
// Update profile
router.put("/me", authMiddleware, body("name").optional().notEmpty(), body("address").optional().notEmpty(), async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty())
        return res.status(400).json({ errors: errors.array() });
    const user = req.user;
    const { name, address } = req.body;
    const updated = await prisma.user.update({
        where: { id: user.id },
        data: { name: name || user.name, address: address || user.address },
    });
    res.json({
        id: updated.id,
        name: updated.name,
        email: updated.email,
        address: updated.address,
    });
});
// Update password
router.put("/me/password", authMiddleware, body("oldPassword").notEmpty(), body("newPassword").isLength({ min: 6 }), async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty())
        return res.status(400).json({ errors: errors.array() });
    const user = req.user;
    const { oldPassword, newPassword } = req.body;
    if (!user.hashedPassword)
        return res
            .status(400)
            .json({ msg: "Cannot change password for OAuth user" });
    const isMatch = await bcrypt.compare(oldPassword, user.hashedPassword);
    if (!isMatch)
        return res.status(400).json({ msg: "Old password incorrect" });
    const hashed = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
        where: { id: user.id },
        data: { hashedPassword: hashed },
    });
    res.json({ msg: "Password updated successfully" });
});
export default router;
//# sourceMappingURL=user.js.map