import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { UnauthorizedError } from "@/features/authorization/errors";
import {
  actorFromMembership,
  projectActorFromMembership,
  type Actor,
  type ProjectActor,
} from "@/features/authorization/actor";

/** Lấy user từ session; trả null nếu chưa đăng nhập. Memoized per request qua React.cache. */
export const getSessionUser = cache(async () => {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user ?? null;
});

/**
 * Lấy Actor (currentUserId + workspaceId + role) cho một workspace từ session.
 * Memoized per request qua React.cache.
 * - Chưa đăng nhập → redirect /auth.
 * - Không phải member của workspace → ném UnauthorizedError (không làm lộ dữ liệu).
 */
export const requireActor = cache(async (workspaceId: string): Promise<Actor> => {
  const user = await getSessionUser();
  if (!user) redirect("/auth");

  const membership = await prisma.workspaceMember.findUnique({
    where: { userId_workspaceId: { userId: user.id, workspaceId } },
    select: { userId: true, workspaceId: true, role: true },
  });
  if (!membership) throw new UnauthorizedError("You are not a member of this workspace.");

  return actorFromMembership({
    userId: membership.userId,
    workspaceId: membership.workspaceId,
    role: membership.role,
  });
});

/**
 * Lấy ProjectActor cho (workspaceId, projectId) từ session (Mốc 11).
 * Memoized per request qua React.cache.
 * - Chưa đăng nhập → redirect /auth.
 * - Không phải workspace member → ném UnauthorizedError.
 * - Chưa có project membership row → projectRole = workspace role (backward-compat).
 */
export const requireProjectActor = cache(async (
  workspaceId: string,
  projectId: string,
): Promise<ProjectActor> => {
  const user = await getSessionUser();
  if (!user) redirect("/auth");

  const [wsMembership, projectMembership, project] = await Promise.all([
    prisma.workspaceMember.findUnique({
      where: { userId_workspaceId: { userId: user.id, workspaceId } },
      select: { userId: true, workspaceId: true, role: true },
    }),
    prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: user.id } },
      select: { role: true },
    }),
    // H1: verify project actually belongs to this workspace (prevents cross-workspace access)
    prisma.project.findUnique({
      where: { id: projectId },
      select: { workspaceId: true },
    }),
  ]);

  if (!wsMembership) throw new UnauthorizedError("You are not a member of this workspace.");

  // H1 guard: project must belong to the workspace being accessed
  if (!project || project.workspaceId !== workspaceId) {
    throw new UnauthorizedError("Project not found or does not belong to this workspace.");
  }

  return projectActorFromMembership(
    {
      userId: wsMembership.userId,
      workspaceId: wsMembership.workspaceId,
      role: wsMembership.role,
    },
    projectId,
    projectMembership?.role ?? null,
  );
});
