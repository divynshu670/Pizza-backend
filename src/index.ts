import express from "express";
import dotenv from "dotenv";
import passport from "./auth/config/passport";
import authRoutes from "./auth/routes/auth";
import userRoutes from "./auth/routes/user";
import session from "express-session";
import prisma from "./db/prisma";
import pizzaRoutes from "./pizza/routes/pizza";
import cartRoutes from "./cart/src/routes/cart";
import ordersRoutes from "./payment/routes/order";
import webhookRouter from "./payment/routes/webhook";

dotenv.config();

const app = express();

// Mount webhook raw parser only for the webhook route
app.use(
  "/api/payments/webhook",
  express.raw({ type: "application/json" }),
  webhookRouter
);

// regular json parser for other routes
app.use(express.json());

app.use(
  session({
    secret: process.env.SESSION_SECRET ?? "dev-session-secret",
    resave: false,
    saveUninitialized: false,
    cookie: { secure: process.env.NODE_ENV === "production" },
  })
);

app.use(passport.initialize());
app.use(passport.session());
app.use("/auth", authRoutes);
app.use("/user", userRoutes);
app.use("/api/pizzas", pizzaRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/orders", ordersRoutes);

const PORT = process.env.PORT ?? 5000;

async function start() {
  try {
    await prisma.$connect();
    console.log("Connected to database");
  } catch (err) {
    console.error("Failed to connect to DB:", err);
    process.exit(1);
  }

  app.listen(PORT, () => console.log(`Server started on port ${PORT}`));
}

start();
