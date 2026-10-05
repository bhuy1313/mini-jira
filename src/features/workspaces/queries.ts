import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { createWorkspaceService } from "@/features/workspaces/workspace-service";
import { prismaWorkspaceRepository } from "@/features/workspaces/prisma-workspace-repository";
import { getSessionUser, requireActor } from "@/features/workspaces/session";
import type { Actor } from "@/features/authorization/actor";

const workspaceService = createWorkspaceService({ repo: prismaWorkspaceRepository });

/** Danh sách workspace của user hiện tại; redirect /auth nếu chưa đăng nhập. */
export async function getUserWorkspaces() {
  const user = await getSessionUser();
  if (!user) redirect("/auth");
  return workspaceService.listWorkspacesForUser({ userId: user.id });
}

/** Workspace hiện tại + actor + thông tin hiển thị; nếu không phải member → redirect /workspaces. */
export async function getWorkspaceContext(workspaceId: string) {
  const actor = await requireActor(workspaceId).catch(() => null);
  if (!actor) redirect("/workspaces");
  const [ws, members] = await Promise.all([
    workspaceService.getWorkspace(actor),
    workspaceService.listMembers(actor),
  ]);
  return { actor, ws, members };
}

export type WorkspacePageData = Awaited<ReturnType<typeof getWorkspaceContext>>;

/** Chỉ workspace settings thật sự cần; cache query nếu cần sau này. */
export async function getWorkspaceSettings(workspaceId: string): Promise<{ actor: Actor; ws: NonNullable<Awaited<ReturnType<typeof getWorkspaceContext>>["ws"]> }> {
  const actor = await requireActor(workspaceId).catch(() => null);
  if (!actor) redirect("/workspaces");
  const ws = await workspaceService.getWorkspace(actor);
  return { actor, ws };
}

/** Hỗ trợ _count cho UI nếu cần render số project/member. */
export async function getWorkspaceCounts(workspaceId: string) {
  const actor = await requireActor(workspaceId).catch(() => null);
  if (!actor) redirect("/workspaces");
  const agg = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { _count: { select: { members: true, projects: true } } },
  });
  return { count: agg?._count ?? { members: 0, projects: 0 } };
}
