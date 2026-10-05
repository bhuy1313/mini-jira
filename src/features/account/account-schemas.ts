import { z } from "zod";

import { hasValidPassword, PASSWORD_POLICY_MESSAGE } from "@/features/auth/password-policy";

export const updateProfileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name cannot be empty")
    .max(50, "Name must be 50 characters or fewer"),
  image: z.string().url("Invalid image URL").nullable().optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .max(128, "Password must be 128 characters or fewer")
      .refine(hasValidPassword, {
        message: PASSWORD_POLICY_MESSAGE,
      }),
    confirmPassword: z.string().min(1, "Please confirm your new password"),
    revokeOtherSessions: z.boolean().optional().default(false),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "New password and confirmation do not match",
    path: ["confirmPassword"],
  });

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export const revokeSessionSchema = z.object({
  sessionId: z.string().min(1, "Session ID is required"),
});

export type RevokeSessionInput = z.infer<typeof revokeSessionSchema>;
