"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { UnauthorizedError } from "@/features/authorization/errors";
import { requireProjectActor } from "@/features/workspaces/session";
import { createProjectMemberService } from "@/features/projects/project-member-service";
import { prismaProjectMemberRepository } from "@/features/projects/prisma-project-member-repository";
import { prismaProjectRepository } from "@/features/projects/prisma-project-repository";

const memberService = createProjectMemberService({ repo: prismaProjectMemberRepository });

const emailSchema = z.string().trim().email("Invalid email address.");
const roleSchema = z.enum(["Owner", "Admin", "Member"] as const);

function message(error: unknown): string {
  if (error instanceof UnauthorizedError) return error.message;
  return "Something went wrong. Please try again.";
}

function settingsPath(workspaceId: string, projectId: string) {
  return `/workspaces/${workspaceId}/projects/${projectId}/settings`;
}

/**
 * Thêm member vào project bằng email — Owner/Admin project (Mốc 11).
 * Lookup userId từ email trước, sau đó gọi service.
 */
export async function addProjectMemberAction(
  workspaceId: string,
  projectId: string,
  formData: FormData,
): Promise<{ error?: string }> {
  const parsed = z
    .object({
      email: emailSchema,
      role: roleSchema,
    })
    .safeParse({
      email: formData.get("email"),
      role: formData.get("role") ?? "Member",
    });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid data." };
  }

  try {
    const actor = await requireProjectActor(workspaceId, projectId);

    // Lookup userId từ email
    const targetUser = await prisma.user.findUnique({
      where: { email: parsed.data.email },
      select: { id: true },
    });
    if (!targetUser) {
      return { error: "No user found with that email address." };
    }

    // Lấy danh sách workspace member ids để validate
    const workspaceMemberIds = await prismaProjectRepository.listWorkspaceMemberIds(workspaceId);

    await memberService.addMember(
      actor,
      projectId,
      targetUser.id,
      parsed.data.role,
      workspaceMemberIds,
    );
  } catch (error) {
    return { error: message(error) };
  }

  revalidatePath(settingsPath(workspaceId, projectId));
  return {};
}

/** Đổi role project member — chỉ Owner project (Mốc 11). */
export async function changeProjectMemberRoleAction(
  workspaceId: string,
  projectId: string,
  targetUserId: string,
  role: string,
): Promise<{ error?: string }> {
  const parsedRole = roleSchema.safeParse(role);
  if (!parsedRole.success) return { error: "Invalid role." };

  try {
    const actor = await requireProjectActor(workspaceId, projectId);
    await memberService.changeRole(actor, projectId, targetUserId, parsedRole.data);
  } catch (error) {
    return { error: message(error) };
  }

  revalidatePath(settingsPath(workspaceId, projectId));
  return {};
}

/** Gỡ member khỏi project — Owner xoá Admin/Member; Admin xoá Member (Mốc 11). */
export async function removeProjectMemberAction(
  workspaceId: string,
  projectId: string,
  targetUserId: string,
): Promise<{ error?: string }> {
  try {
    const actor = await requireProjectActor(workspaceId, projectId);
    await memberService.removeMember(actor, projectId, targetUserId);
  } catch (error) {
    return { error: message(error) };
  }

  revalidatePath(settingsPath(workspaceId, projectId));
  return {};
}
