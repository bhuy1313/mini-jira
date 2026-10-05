import { randomUUID } from "node:crypto";

import { prisma } from "@/lib/prisma";
import { Role } from "@/generated/prisma/enums";
import type { Membership } from "@/features/authorization/actor";
import type { Role as DomainRole } from "@/features/authorization/permissions";
import type { MemberRecord, MemberWithUser, WorkspaceRecord, WorkspaceRepository } from "./workspace-service";

function toWorkspaceRecord(row: { id: string; name: string; description: string | null; icon?: string | null }): WorkspaceRecord {
  return { id: row.id, name: row.name, description: row.description, icon: row.icon ?? null };
}

/**
 * Implement `WorkspaceRepository` bằng Prisma (DB thật). Mọi guard/quyền vẫn do
 * service layer đảm bảo; lớp này chỉ chịu trách nhiệm đọc/ghi, sinh id.
 */
export const prismaWorkspaceRepository: WorkspaceRepository = {
  async listWorkspacesForUser(userId: string): Promise<WorkspaceRecord[]> {
    const rows = await prisma.workspace.findMany({
      where: { members: { some: { userId } } },
      select: { id: true, name: true, description: true, icon: true },
      orderBy: { createdAt: "asc" },
    });
    return rows.map(toWorkspaceRecord);
  },

  async getWorkspace(workspaceId: string): Promise<WorkspaceRecord | null> {
    const row = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { id: true, name: true, description: true, icon: true },
    });
    return row ? toWorkspaceRecord(row) : null;
  },

  async getMembership(userId: string, workspaceId: string): Promise<Membership | null> {
    const row = await prisma.workspaceMember.findUnique({
      where: { userId_workspaceId: { userId, workspaceId } },
      select: { userId: true, workspaceId: true, role: true },
    });
    if (!row) return null;
    return { userId: row.userId, workspaceId: row.workspaceId, role: row.role as DomainRole };
  },

  async listMembers(workspaceId: string): Promise<MemberRecord[]> {
    const rows = await prisma.workspaceMember.findMany({
      where: { workspaceId },
      select: { userId: true, role: true },
    });
    return rows.map((r) => ({ userId: r.userId, role: r.role as DomainRole }));
  },

  async listMembersWithUsers(workspaceId: string): Promise<MemberWithUser[]> {
    const rows = await prisma.workspaceMember.findMany({
      where: { workspaceId },
      select: { userId: true, role: true, user: { select: { name: true, email: true } } },
      orderBy: { createdAt: "asc" },
    });
    return rows.map((r) => ({
      userId: r.userId,
      role: r.role as DomainRole,
      name: r.user.name,
      email: r.user.email,
    }));
  },

  async createWorkspaceWithOwner(input: {
    name: string;
    description: string | null;
    icon?: string | null;
    ownerUserId: string;
  }): Promise<WorkspaceRecord> {
    const id = randomUUID();
    await prisma.workspace.create({
      data: {
        id,
        name: input.name,
        description: input.description,
        icon: input.icon ?? null,
        members: {
          create: { id: randomUUID(), role: Role.Owner, userId: input.ownerUserId },
        },
      },
    });
    return { id, name: input.name, description: input.description, icon: input.icon ?? null };
  },

  async addMember(input: { workspaceId: string; userId: string; role: DomainRole }): Promise<MemberRecord> {
    await prisma.workspaceMember.create({
      data: {
        id: randomUUID(),
        workspaceId: input.workspaceId,
        userId: input.userId,
        role: input.role as Role,
      },
    });
    return { userId: input.userId, role: input.role };
  },

  async changeMemberRole(input: {
    workspaceId: string;
    userId: string;
    role: DomainRole;
  }): Promise<MemberRecord> {
    await prisma.workspaceMember.update({
      where: { userId_workspaceId: { userId: input.userId, workspaceId: input.workspaceId } },
      data: { role: input.role as Role },
    });
    return { userId: input.userId, role: input.role };
  },

  async removeMember(input: { workspaceId: string; userId: string }): Promise<void> {
    await prisma.workspaceMember.delete({
      where: { userId_workspaceId: { userId: input.userId, workspaceId: input.workspaceId } },
    });
  },

  async updateWorkspace(input: {
    workspaceId: string;
    name?: string;
    description?: string | null;
    icon?: string | null;
  }): Promise<WorkspaceRecord> {
    const data: { name?: string; description?: string | null; icon?: string | null } = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.description !== undefined) data.description = input.description;
    if (input.icon !== undefined) data.icon = input.icon;
    const row = await prisma.workspace.update({
      where: { id: input.workspaceId },
      data,
      select: { id: true, name: true, description: true, icon: true },
    });
    return toWorkspaceRecord(row);
  },

  async deleteWorkspace(workspaceId: string): Promise<void> {
    // Cascade trong schema (Workspace -> Member/Project -> ...) loại toàn bộ dữ liệu.
    await prisma.workspace.delete({ where: { id: workspaceId } });
  },
};
