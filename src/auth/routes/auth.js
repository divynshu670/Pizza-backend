import { Router } from "express";
import { body, validationResult } from "express-validator";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";
import passport from "passport";
const prisma = new PrismaClient();
const router = Router();
router.post("/signup", body("name").notEmpty(), body("email").isEmail(), body("password").isLength({ min: 6 }), async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty())
        return res.status(400).json({ errors: errors.array() });
    const { name, email, password, address } = req.body;
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser)
        return res.status(400).json({ msg: "Email already registered" });
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
        data: { name, email, hashedPassword, address },
    });
    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, {
        expiresIn: "8h",
    });
    res.json({
        token,
        user: {
            id: user.id,
            name: user.name,
            email: user.email,
            address: user.address,
        },
    });
});
router.post("/login", body("email").isEmail(), body("password").notEmpty(), async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty())
        return res.status(400).json({ errors: errors.array() });
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.hashedPassword)
        return res.status(400).json({ msg: "Invalid credentials" });
    const isMatch = await bcrypt.compare(password, user.hashedPassword);
    if (!isMatch)
        return res.status(400).json({ msg: "Invalid credentials" });
    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, {
        expiresIn: "8h",
    });
    res.json({
        token,
        user: {
            id: user.id,
            name: user.name,
            email: user.email,
            address: user.address,
        },
    });
});
router.get("/google", passport.authenticate("google", { scope: ["profile", "email"] }));
router.get("/google/callback", passport.authenticate("google", { failureRedirect: "/login" }), async (req, res) => {
    const user = req.user;
    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, {
        expiresIn: "8h",
    });
    res.json({
        token,
        user: { id: user.id, name: user.name, email: user.email },
    });
});
export default router;
//# sourceMappingURL=auth.js.map