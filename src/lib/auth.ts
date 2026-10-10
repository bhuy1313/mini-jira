import { betterAuth } from "better-auth/minimal";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";

import { hasValidPassword, PASSWORD_POLICY_MESSAGE } from "@/features/auth/password-policy";
import { prisma } from "@/lib/prisma";
import {
  emailSender,
  resetPasswordTemplate,
  verifyEmailTemplate,
} from "@/lib/email";

function getBaseUrl(): string {
  if (process.env.BETTER_AUTH_URL) return process.env.BETTER_AUTH_URL;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return "http://localhost:3000";
}

function getTrustedOrigins(): string[] {
  if (process.env.BETTER_AUTH_TRUSTED_ORIGINS) {
    return process.env.BETTER_AUTH_TRUSTED_ORIGINS.split(",").map((s) => s.trim());
  }
  const origins = [getBaseUrl(), "http://localhost:3000"];
  if (process.env.VERCEL_URL) {
    origins.push(`https://${process.env.VERCEL_URL}`);
  }
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    origins.push(`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`);
  }
  return Array.from(new Set(origins));
}

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  baseURL: getBaseUrl(),
  secret: process.env.BETTER_AUTH_SECRET,
  trustedOrigins: getTrustedOrigins(),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    // Không cấu hình = endpoint quên mật khẩu câm. Sender tự no-op khi thiếu
    // RESEND_API_KEY nên dev/E2E không vỡ.
    sendResetPassword: async ({ user, url }) => {
      await emailSender.send(resetPasswordTemplate(user.email, url));
    },
  },
  emailVerification: {
    // Gửi ngay khi đăng ký; KHÔNG bật requireEmailVerification ở đây — bật nó
    // sẽ khóa user hiện tại/E2E chưa verify. Đó là quyết định product riêng.
    sendOnSignUp: true,
    sendVerificationEmail: async ({ user, url }) => {
      await emailSender.send(verifyEmailTemplate(user.email, url));
    },
  },
  rateLimit: {
    // Disabled in dev. In production it stays on unless explicitly lifted
    // for end-to-end runs (E2E=1) — rapid signup/session traffic would
    // otherwise 429 the suite. Never set E2E=1 on a real deployment.
    enabled: process.env.NODE_ENV === "production" && process.env.E2E !== "1",
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
