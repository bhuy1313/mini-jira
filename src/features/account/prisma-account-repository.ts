import type { PrismaClient } from "@/generated/prisma/client";
import type {
  AccountRepository,
  UserProfile,
  UserSession,
  UserWorkspaceOverview,
} from "@/features/account/account-repository";

export class PrismaAccountRepository implements AccountRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async getUserProfile(userId: string): Promise<UserProfile | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        emailVerified: true,
        image: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return user;
  }

  async updateUserProfile(
    userId: string,
    data: { name: string; image?: string | null },
  ): Promise<UserProfile> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        name: data.name,
        ...(data.image !== undefined ? { image: data.image } : {}),
      },
      select: {
        id: true,
        name: true,
        email: true,
        emailVerified: true,
        image: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return user;
  }

  async getUserSessions(userId: string): Promise<UserSession[]> {
    const sessions = await this.prisma.session.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        token: true,
        expiresAt: true,
        ipAddress: true,
        userAgent: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return sessions;
  }

  async deleteSession(userId: string, sessionId: string): Promise<boolean> {
    const result = await this.prisma.session.deleteMany({
      where: {
        id: sessionId,
        userId,
      },
    });
    return result.count > 0;
  }

  async deleteOtherSessions(userId: string, currentSessionToken: string): Promise<number> {
    const result = await this.prisma.session.deleteMany({
      where: {
        userId,
        token: { not: currentSessionToken },
      },
    });
    return result.count;
  }

  async getUserWorkspaces(userId: string): Promise<UserWorkspaceOverview[]> {
    const memberships = await this.prisma.workspaceMember.findMany({
      where: { userId },
      include: {
        workspace: {
          include: {
            _count: {
              select: {
                projects: {
                  where: { archivedAt: null },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return memberships.map((m) => ({
      workspaceId: m.workspace.id,
      workspaceName: m.workspace.name,
      workspaceDescription: m.workspace.description,
      workspaceIcon: m.workspace.icon,
      role: m.role,
      joinedAt: m.createdAt,
      projectCount: m.workspace._count.projects,
    }));
  }
}
