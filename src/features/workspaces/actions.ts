"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { UnauthorizedError } from "@/features/authorization/errors";
import { emailSender, workspaceAddedTemplate } from "@/lib/email";
import { prisma } from "@/lib/prisma";
import {
  fieldErrorsFromZod,
  firstIssueMessage,
  type FieldErrors,
} from "@/lib/validation";
import { liveNotificationPublisher } from "@/features/notifications/live-notification-publisher-prisma";
import { createWorkspaceService } from "@/features/workspaces/workspace-service";
import { prismaWorkspaceRepository } from "@/features/workspaces/prisma-workspace-repository";
import { getSessionUser, requireActor } from "@/features/workspaces/session";

const workspaceService = createWorkspaceService({
  repo: prismaWorkspaceRepository,
  notifications: liveNotificationPublisher,
});

import {
  createWorkspaceSchema,
  updateWorkspaceSchema,
} from "@/features/workspaces/workspace-schema";

const addMemberSchema = z.object({
  email: z.string().trim().min(1, "Email is required.").email("Invalid email."),
});

const changeRoleSchema = z.object({
  userId: z.string().min(1, "Member is required."),
  role: z.enum(["Owner", "Admin", "Member"]),
});

const removeMemberSchema = z.object({
  userId: z.string().min(1, "Member is required."),
});

function message(error: unknown): string {
  if (error instanceof UnauthorizedError) return error.message;
  return "Something went wrong. Please try again.";
}

/** Tạo workspace — creator trở thành Owner (FR-010, FR-011, FR-014). */
export async function createWorkspaceAction(formData: FormData): Promise<{
  error?: string;
  fieldErrors?: FieldErrors;
}> {
  const user = await getSessionUser();
  if (!user) redirect("/auth");

  const parsed = createWorkspaceSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    icon: formData.get("icon") || undefined,
  });
  if (!parsed.success) {
    return {
      error: firstIssueMessage(parsed.error),
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }

  const ws = await workspaceService.createWorkspace(
    { userId: user.id },
    {
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      icon: parsed.data.icon ?? null,
    },
  );
  redirect(`/workspaces/${ws.id}`);
}

/** Sửa workspace — chỉ Owner (FR-012). */
export async function updateWorkspaceAction(
  workspaceId: string,
  formData: FormData,
): Promise<{ error?: string }> {
  const actor = await requireActor(workspaceId);
  const parsed = updateWorkspaceSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    icon: formData.get("icon") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid data." };
  }

  try {
    await workspaceService.updateWorkspace(actor, {
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      icon: parsed.data.icon !== undefined ? parsed.data.icon : undefined,
    });
  } catch (error) {
    return { error: message(error) };
  }
  revalidatePath(`/workspaces/${workspaceId}/settings`);
  revalidatePath(`/workspaces/${workspaceId}`);
  revalidatePath(`/workspaces`);
  return {};
}

/** Xoá workspace vĩnh viễn — chỉ Owner (FR-013). */
export async function deleteWorkspaceAction(workspaceId: string): Promise<{ error?: string }> {
  const actor = await requireActor(workspaceId);
  try {
    await workspaceService.deleteWorkspace(actor);
  } catch (error) {
    return { error: message(error) };
  }
  redirect("/workspaces");
}

/** Thêm member theo email đã đăng ký — Owner/Admin, chống trùng (FR-020, FR-021). */
export async function addMemberAction(
  workspaceId: string,
  formData: FormData,
): Promise<{ error?: string }> {
  const actor = await requireActor(workspaceId);
  const parsed = addMemberSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid email." };
  }

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email },
    select: { id: true, name: true, email: true },
  });
  if (!user) {
    return { error: "No account found for this email. The user needs to register first." };
  }

  try {
    await workspaceService.addMember(actor, user.id, "Member");
  } catch (error) {
    return { error: message(error) };
  }
  // Mail "được thêm vào workspace" — fire-and-forget, no-op khi chưa cấu hình.
  // sender không bao giờ throw nên không await để add-member khỏi chậm theo HTTP mail.
  void emailSender.send(
    workspaceAddedTemplate(
      user.email,
      (await prisma.workspace.findUnique({ where: { id: workspaceId }, select: { name: true } }))
        ?.name ?? "Mini Jira",
      workspaceId,
    ),
  );
  revalidatePath(`/workspaces/${workspaceId}/members`);
  return {};
}

/** Đổi role member — chỉ Owner (FR-022). */
export async function changeMemberRoleAction(
  workspaceId: string,
  formData: FormData,
): Promise<{ error?: string }> {
  const actor = await requireActor(workspaceId);
  const parsed = changeRoleSchema.safeParse({
    userId: formData.get("userId"),
    role: formData.get("role"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid data." };
  }

  try {
    await workspaceService.changeMemberRole(actor, parsed.data.userId, parsed.data.role);
  } catch (error) {
    return { error: message(error) };
  }
  revalidatePath(`/workspaces/${workspaceId}/members`);
  return {};
}

/** Gỡ member — theo ma trận (FR-023). */
export async function removeMemberAction(
  workspaceId: string,
  formData: FormData,
): Promise<{ error?: string }> {
  const actor = await requireActor(workspaceId);
  const parsed = removeMemberSchema.safeParse({ userId: formData.get("userId") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid data." };
  }

  try {
    await workspaceService.removeMember(actor, parsed.data.userId);
  } catch (error) {
    return { error: message(error) };
  }
  revalidatePath(`/workspaces/${workspaceId}/members`);
  return {};
}
