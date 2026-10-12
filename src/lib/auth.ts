import { betterAuth } from "better-auth/minimal";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { emailOTP } from "better-auth/plugins";

import { hasValidPassword, PASSWORD_POLICY_MESSAGE } from "@/features/auth/password-policy";
import { prisma } from "@/lib/prisma";
import {
  emailSender,
  isEmailEnabled,
  resetPasswordTemplate,
  verifyCodeTemplate,
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
      if (!isEmailEnabled()) return;
      await emailSender.send(resetPasswordTemplate(user.email, url));
    },
  },
  emailVerification: {
    // Link verify giữ làm fallback; luồng chính là mã OTP 6 số (emailOTP plugin).
    sendOnSignUp: true,
    sendVerificationEmail: async ({ user, url }) => {
      if (!isEmailEnabled()) return;
      await emailSender.send(verifyEmailTemplate(user.email, url));
    },
    // Gate chỉ bật khi có cờ REQUIRE_EMAIL_VERIFICATION=1 (và không phải E2E).
    // Lý do: Resend test mode (chưa verify domain) chỉ gửi được cho email chủ
    // tài khoản — bật gate khi chưa có domain là khóa mọi đăng ký mới.
    // Ràng buộc thêm isEmailEnabled: bật gate mà tắt mail là khóa cứng.
    requireEmailVerification:
      process.env.E2E !== "1" &&
      process.env.REQUIRE_EMAIL_VERIFICATION === "1" &&
      isEmailEnabled(),
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
  plugins: [
    nextCookies(),
    emailOTP({
      otpLength: 6,
      expiresIn: 300,
      allowedAttempts: 3,
      sendVerificationOnSignUp: true,
      // Chống brute-force phụ (chính vẫn là 3 attempts/code + hết hạn 5 phút):
      // 10/phút/IP thay vì default 3 — đủ cho luồng nhập sai + resend của người
      // thật và cho E2E (3 test dùng ~5 lượt gọi từ cùng IP localhost).
      rateLimit: { window: 60, max: 10 },
      sendVerificationOTP: async ({ email, otp }) => {
        if (!isEmailEnabled()) return;
        await emailSender.send(verifyCodeTemplate(email, otp));
      },
    }),
  ],
});
