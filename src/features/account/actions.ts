"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import {
  changePasswordSchema,
  revokeSessionSchema,
  updateProfileSchema,
} from "@/features/account/account-schemas";
import { AccountService } from "@/features/account/account-service";
import { PrismaAccountRepository } from "@/features/account/prisma-account-repository";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const accountRepository = new PrismaAccountRepository(prisma);
const accountService = new AccountService(accountRepository);

export async function updateProfileAction(data: { name: string; image?: string | null }) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return { success: false, error: "You must be signed in to update your profile." };
    }

    const parsed = updateProfileSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Invalid profile data.",
      };
    }

    const updated = await accountService.updateProfile(session.user.id, parsed.data);
    revalidatePath("/account");
    revalidatePath("/workspaces");

    return { success: true, user: updated };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update profile.";
    return { success: false, error: message };
  }
}

export async function changePasswordAction(data: {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
  revokeOtherSessions?: boolean;
}) {
  try {
    const reqHeaders = await headers();
    const session = await auth.api.getSession({ headers: reqHeaders });
    if (!session?.user) {
      return { success: false, error: "You must be signed in to change your password." };
    }

    const parsed = changePasswordSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Invalid password parameters.",
      };
    }

    // Call Better Auth change password API
    await auth.api.changePassword({
      body: {
        currentPassword: parsed.data.currentPassword,
        newPassword: parsed.data.newPassword,
        revokeOtherSessions: parsed.data.revokeOtherSessions ?? false,
      },
      headers: reqHeaders,
    });

    revalidatePath("/account");
    return { success: true };
  } catch (error) {
    let message = "Failed to change password.";
    if (error && typeof error === "object" && "message" in error) {
      message = String((error as { message: string }).message);
    } else if (error instanceof Error) {
      message = error.message;
    }
    return { success: false, error: message };
  }
}

export async function revokeSessionAction(sessionId: string) {
  try {
    const reqHeaders = await headers();
    const session = await auth.api.getSession({ headers: reqHeaders });
    if (!session?.user) {
      return { success: false, error: "You must be signed in to manage sessions." };
    }

    const parsed = revokeSessionSchema.safeParse({ sessionId });
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Invalid session ID.",
      };
    }

    await accountService.revokeSession(session.user.id, parsed.data.sessionId);
    revalidatePath("/account");

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to revoke session.";
    return { success: false, error: message };
  }
}

export async function revokeOtherSessionsAction() {
  try {
    const reqHeaders = await headers();
    const session = await auth.api.getSession({ headers: reqHeaders });
    if (!session?.user || !session.session?.token) {
      return { success: false, error: "You must be signed in to manage sessions." };
    }

    const result = await accountService.revokeOtherSessions(
      session.user.id,
      session.session.token,
    );
    revalidatePath("/account");

    return { success: true, revokedCount: result.revokedCount };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to revoke other sessions.";
    return { success: false, error: message };
  }
}
