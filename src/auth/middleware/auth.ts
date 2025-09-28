import type { Request, Response, NextFunction } from "express";
import { PrismaClient } from "@prisma/client";
import jwt, { type JwtPayload } from "jsonwebtoken";

const prisma = new PrismaClient();
const tokenBlacklist = new Set<string>();
export const blacklistToken = (token: string) => tokenBlacklist.add(token);

export const authMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ msg: "Unauthorized" });
  }
  const token = authHeader.split(" ")[1];
  if (!token) return res.status(401).json({ msg: "Unauthorized" });

  // check blacklist
  if (tokenBlacklist.has(token)) {
    return res.status(401).json({ msg: "Token revoked. Please login again." });
  }

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    console.error("JWT_SECRET not set");
    return res.status(500).json({ msg: "Server misconfiguration" });
  }

  try {
    const decoded = jwt.verify(token, jwtSecret);
    if (typeof decoded !== "object" || decoded === null) {
      return res.status(401).json({ msg: "Token invalid" });
    }
    const payload = decoded as JwtPayload;
    const id = typeof payload.id === "string" ? payload.id : undefined;
    if (!id) return res.status(401).json({ msg: "Token invalid" });

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return res.status(401).json({ msg: "User not found" });

    // attach user to request
    (req as any).user = user;
    next();
  } catch (err) {
    return res.status(401).json({ msg: "Token invalid" });
  }
};
