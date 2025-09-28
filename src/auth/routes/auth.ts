import { Router } from "express";
import { body, validationResult } from "express-validator";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";
import passport from "../config/passport.js";
import { blacklistToken } from "../middleware/auth.js";

const prisma = new PrismaClient();
const router = Router();

const createToken = (userId: string) => {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) throw new Error("JWT_SECRET not set");
  // token lifetime example: 7d
  return jwt.sign({ id: userId }, jwtSecret, { expiresIn: "7d" });
};

router.post(
  "/signup",
  body("name").notEmpty(),
  body("email").isEmail(),
  body("password").isLength({ min: 6 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ errors: errors.array() });

    const { name, email, password } = req.body as {
      name: string;
      email: string;
      password: string;
    };

    try {
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) {
        return res
          .status(409)
          .json({ msg: "User with that email already exists" });
      }

      const hashed = await bcrypt.hash(password, 10);
      const user = await prisma.user.create({
        data: { name, email, hashedPassword: hashed },
      });

      const token = createToken(user.id);
      return res.json({
        token,
        user: { id: user.id, name: user.name, email: user.email },
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ msg: "Server error" });
    }
  }
);

router.post(
  "/login",
  body("email").isEmail(),
  body("password").notEmpty(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ errors: errors.array() });

    const { email, password } = req.body as { email: string; password: string };
    try {
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user || !user.hashedPassword) {
        return res.status(401).json({ msg: "Invalid credentials" });
      }

      const ok = await bcrypt.compare(password, user.hashedPassword);
      if (!ok) return res.status(401).json({ msg: "Invalid credentials" });

      const token = createToken(user.id);
      return res.json({
        token,
        user: { id: user.id, name: user.name, email: user.email },
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ msg: "Server error" });
    }
  }
);

router.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

router.get(
  "/google/callback",
  passport.authenticate("google", { failureRedirect: "/login", session: true }),
  async (req: any, res) => {
    // At this point req.user is the user object from Prisma
    try {
      const user = req.user;
      if (!user) return res.redirect("/login?error=oauth");

      const token = createToken(user.id);

      const redirectTo = process.env.CLIENT_URL ?? "http://localhost:3000";
      return res.redirect(`${redirectTo}/auth/success?token=${token}`);
    } catch (err) {
      console.error(err);
      return res.redirect("/login?error=server");
    }
  }
);

router.post("/logout", (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer "))
    return res.status(401).json({ msg: "Unauthorized" });
  const token = authHeader.split(" ")[1];
  blacklistToken(token);
  return res.json({ msg: "Logged out" });
});

export default router;
