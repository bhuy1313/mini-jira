import { betterAuth } from "better-auth/minimal";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";

import { hasValidPassword, PASSWORD_POLICY_MESSAGE } from "@/features/auth/password-policy";
import { prisma } from "@/lib/prisma";

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3000",
  secret: process.env.BETTER_AUTH_SECRET,
  trustedOrigins: process.env.BETTER_AUTH_TRUSTED_ORIGINS
    ? process.env.BETTER_AUTH_TRUSTED_ORIGINS.split(",").map((s) => s.trim())
    : [process.env.BETTER_AUTH_URL || "http://localhost:3000"],
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
  },
  rateLimit: {
    enabled: process.env.NODE_ENV === "production",
    window: 10,
    max: 100,
  },
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path === "/sign-up/email" && !hasValidPassword(ctx.body?.password)) {
        throw new APIError("BAD_REQUEST", {
          message: PASSWORD_POLICY_MESSAGE,
        });
      }
      if (ctx.path === "/change-password" && !hasValidPassword(ctx.body?.newPassword)) {
        throw new APIError("BAD_REQUEST", {
          message: PASSWORD_POLICY_MESSAGE,
        });
      }
    }),
  },
  plugins: [nextCookies()],
});
