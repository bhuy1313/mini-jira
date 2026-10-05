import { prisma } from "@/lib/prisma";
import type { Role } from "@/features/authorization/permissions";
import type { ApiKeyRecord, ApiKeyRepository } from "@/features/api-keys/api-key-service";

function mapApiKeyRow(row: {
  id: string;
  name: string;
  keyHash: string;
  keyPrefix: string;
  workspaceId: string;
  userId: string;
  expiresAt: Date | null;
  lastUsedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  user?: {
    id: string;
    name: string;
    email: string;
  };
}): ApiKeyRecord {
  return {
    id: row.id,
    name: row.name,
    keyHash: row.keyHash,
    keyPrefix: row.keyPrefix,
    workspaceId: row.workspaceId,
    userId: row.userId,
    expiresAt: row.expiresAt,
    lastUsedAt: row.lastUsedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    user: row.user,
  };
}

export const prismaApiKeyRepository: ApiKeyRepository = {
  async listByWorkspace(workspaceId: string): Promise<ApiKeyRecord[]> {
    const rows = await prisma.apiKey.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
    return rows.map(mapApiKeyRow);
  },

  async findById(keyId: string): Promise<ApiKeyRecord | null> {
    const row = await prisma.apiKey.findUnique({
      where: { id: keyId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
    return row ? mapApiKeyRow(row) : null;
  },

  async findByHash(keyHash: string): Promise<ApiKeyRecord | null> {
    const row = await prisma.apiKey.findUnique({
      where: { keyHash },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
    return row ? mapApiKeyRow(row) : null;
  },

  async create(data: {
    id: string;
    name: string;
    keyHash: string;
    keyPrefix: string;
    workspaceId: string;
    userId: string;
    expiresAt?: Date | null;
  }): Promise<ApiKeyRecord> {
    const row = await prisma.apiKey.create({
      data: {
        id: data.id,
        name: data.name,
        keyHash: data.keyHash,
        keyPrefix: data.keyPrefix,
        workspaceId: data.workspaceId,
        userId: data.userId,
        expiresAt: data.expiresAt ?? null,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
    return mapApiKeyRow(row);
  },

  async delete(keyId: string): Promise<void> {
    await prisma.apiKey.delete({
      where: { id: keyId },
    });
  },

  async touchLastUsed(keyId: string, lastUsedAt: Date): Promise<void> {
    await prisma.apiKey.update({
      where: { id: keyId },
      data: { lastUsedAt },
    });
  },

  async getMembership(userId: string, workspaceId: string): Promise<{ role: Role } | null> {
    const member = await prisma.workspaceMember.findUnique({
      where: {
        userId_workspaceId: {
          userId,
          workspaceId,
        },
      },
      select: {
        role: true,
      },
    });
    return member ? { role: member.role as Role } : null;
  },
};
