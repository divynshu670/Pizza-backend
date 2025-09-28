import { PrismaClient } from "@prisma/client";
import jwt, {} from "jsonwebtoken";
const prisma = new PrismaClient();
export const authMiddleware = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ msg: "Unauthorized" });
    }
    const token = authHeader.split(" ")[1];
    if (!token) {
        return res.status(401).json({ msg: "Unauthorized" });
    }
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
        console.error("JWT_SECRET is not set in environment");
        return res.status(500).json({ msg: "Server misconfiguration" });
    }
    try {
        const decoded = jwt.verify(token, jwtSecret);
        // Narrow decoded to JwtPayload (object) — reject if it's a raw string
        if (typeof decoded !== "object" || decoded === null) {
            console.error("JWT payload is not an object:", decoded);
            return res.status(401).json({ msg: "Token invalid" });
        }
        const payload = decoded;
        const id = typeof payload.id === "string" ? payload.id : undefined;
        if (!id) {
            return res.status(401).json({ msg: "Token invalid" });
        }
        const user = await prisma.user.findUnique({ where: { id } });
        if (!user)
            return res.status(401).json({ msg: "User not found" });
        // attach user to request for downstream handlers
        req.user = user;
        return next();
    }
    catch (err) {
        console.error("JWT verify error:", err);
        return res.status(401).json({ msg: "Token invalid" });
    }
};
//# sourceMappingURL=auth.js.map