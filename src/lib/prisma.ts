import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    // Generous local pool: E2E/dev runs concurrent SSE streams, 1.5s polls
    // and action POSTs against slow disks. PgBouncer/Neon URLs manage their
    // own pooling server-side; this only raises the client-side ceiling.
    adapter: new PrismaPg({ connectionString, max: 25 }),
  });

globalForPrisma.prisma = prisma;
