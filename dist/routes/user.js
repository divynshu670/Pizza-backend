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
    try {
        console.log("Updating user", { id: user.id, name, address });
        const updated = await prisma.user.update({
            where: { id: user.id },
            data: {
                // only update fields if provided
                ...(name !== undefined ? { name } : {}),
                ...(address !== undefined ? { address } : {}),
            },
        });
        console.log("Prisma update returned:", updated);
        return res.json({
            id: updated.id,
            name: updated.name,
            email: updated.email,
            address: updated.address,
        });
    }
    catch (err) {
        console.error("Error updating user:", err);
        // Prisma throws if user not found — return 404 or 500 depending on error
        return res
            .status(500)
            .json({ msg: "Failed to update user", error: err.message });
    }
});
// Update password
// Update password (improved)
router.put("/me/password", authMiddleware, body("oldPassword").notEmpty(), body("newPassword").isLength({ min: 6 }), async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty())
        return res.status(400).json({ errors: errors.array() });
    const user = req.user;
    const { oldPassword, newPassword } = req.body;
    try {
        if (!user.hashedPassword)
            return res
                .status(400)
                .json({ msg: "Cannot change password for OAuth user" });
        const isMatch = await bcrypt.compare(oldPassword, user.hashedPassword);
        if (!isMatch)
            return res.status(400).json({ msg: "Old password incorrect" });
        const hashed = await bcrypt.hash(newPassword, 10);
        const updated = await prisma.user.update({
            where: { id: user.id },
            data: { hashedPassword: hashed },
        });
        console.log("Password updated for user id:", user.id);
        return res.json({ msg: "Password updated successfully", id: updated.id });
    }
    catch (err) {
        console.error("Error updating password:", err);
        return res
            .status(500)
            .json({
            msg: "Failed to update password",
            error: err.message,
        });
    }
});
export default router;
//# sourceMappingURL=user.js.map