import { defineConfig } from "prisma/config";

// Prisma 7 moved connection config out of schema.prisma. This file only
// matters once DATABASE_URL is set (see .env.example) — `prisma migrate`
// reads it from here, and PrismaClient will take an adapter built from the
// same env var. See /docs/architecture.md for the current (not-yet-connected)
// state of persistence.
export default defineConfig({
  schema: "prisma/schema.prisma",
});
