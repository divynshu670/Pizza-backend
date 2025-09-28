# Pizza Ordering Backend

A simple backend for a pizza ordering service built with Node.js, TypeScript, Express, Prisma ORM, PostgreSQL, and Stripe.

# Features

User authentication with JWT and Google OAuth (Passport)

Secure REST APIs for pizzas, cart, orders, and payments

Stripe PaymentIntent integration with webhook verification

Prisma ORM with PostgreSQL and migrations

Input validation using express-validator

Server-side price calculations (integer cents)

# Tech Stack

Node.js · TypeScript · Express · Prisma · PostgreSQL · Stripe · JWT · Passport

# Setup
Clone the repo and install dependencies.
Add a .env file with your configs.
Run migrations and generate Prisma client.
Start the server:

# API Overview
Auth → Signup, Login, Google OAuth
Pizzas → List, Create (admin)
Cart → Add, Update, Delete items
Orders → Create order, process payment
Payments → Stripe webhook endpoint

# Notes
Prices stored in integer cents to avoid floating-point issues.
Cart items use atomic upsert with unique constraint (userId + pizzaId).
Stripe webhook requires raw body parsing (express.raw).
