import { prisma } from "@/lib/prisma";
import type { ProjectMemberRecord, ProjectMemberRepository } from "./project-member-service";
import type { Role } from "@/features/authorization/permissions";

function toRecord(row: { projectId: string; userId: string; role: unknown }): ProjectMemberRecord {
  return { projectId: row.projectId, userId: row.userId, role: row.role as Role };
}

/**
 * Implement `ProjectMemberRepository` bằng Prisma (DB thật).
 * Mọi guard/quyền vẫn do service layer đảm bảo; lớp này chỉ đọc/ghi.
 */
export const prismaProjectMemberRepository: ProjectMemberRepository = {
  async getProjectWorkspaceId(projectId: string): Promise<string | null> {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { workspaceId: true },
    });
    return project?.workspaceId ?? null;
  },

  async getProjectMember(projectId: string, userId: string): Promise<ProjectMemberRecord | null> {
    const row = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } },
      select: { projectId: true, userId: true, role: true },
    });
    return row ? toRecord(row) : null;
  },

  async listProjectMembers(projectId: string): Promise<ProjectMemberRecord[]> {
    const rows = await prisma.projectMember.findMany({
      where: { projectId },
      select: { projectId: true, userId: true, role: true },
      orderBy: { createdAt: "asc" },
    });
    return rows.map(toRecord);
  },

  async addProjectMember(input: {
    projectId: string;
    userId: string;
    role: Role;
  }): Promise<ProjectMemberRecord> {
    const row = await prisma.projectMember.create({
      data: { projectId: input.projectId, userId: input.userId, role: input.role },
      select: { projectId: true, userId: true, role: true },
    });
    return toRecord(row);
  },

  async changeProjectMemberRole(
    projectId: string,
    userId: string,
    role: Role,
  ): Promise<ProjectMemberRecord> {
    const row = await prisma.projectMember.update({
      where: { projectId_userId: { projectId, userId } },
      data: { role },
      select: { projectId: true, userId: true, role: true },
    });
    return toRecord(row);
  },

  async removeProjectMember(projectId: string, userId: string): Promise<void> {
    await prisma.projectMember.delete({
      where: { projectId_userId: { projectId, userId } },
    });
  },
};
