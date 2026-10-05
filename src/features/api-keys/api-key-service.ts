import crypto from "node:crypto";

import type { Actor } from "@/features/authorization/actor";
import { requirePermission } from "@/features/authorization/actor";
import { UnauthorizedError, ValidationError } from "@/features/authorization/errors";
import { canManageApiKeys, type Role } from "@/features/authorization/permissions";

export interface ApiKeyRecord {
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
}

export interface CreateApiKeyResult {
  apiKey: ApiKeyRecord;
  secretKey: string;
}

export interface ApiKeyRepository {
  listByWorkspace(workspaceId: string): Promise<ApiKeyRecord[]>;
  findById(keyId: string): Promise<ApiKeyRecord | null>;
  findByHash(keyHash: string): Promise<ApiKeyRecord | null>;
  create(data: {
    id: string;
    name: string;
    keyHash: string;
    keyPrefix: string;
    workspaceId: string;
    userId: string;
    expiresAt?: Date | null;
  }): Promise<ApiKeyRecord>;
  delete(keyId: string): Promise<void>;
  touchLastUsed(keyId: string, lastUsedAt: Date): Promise<void>;
  getMembership(userId: string, workspaceId: string): Promise<{ role: Role } | null>;
}

export function hashApiKey(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex");
}

export function generateSecretKey(): { secretKey: string; keyHash: string; keyPrefix: string } {
  const secretKey = `mj_live_${crypto.randomBytes(32).toString("hex")}`;
  const keyHash = hashApiKey(secretKey);
  const keyPrefix = secretKey.slice(0, 8);
  return { secretKey, keyHash, keyPrefix };
}

export interface CreateApiKeyInput {
  name: string;
  expiresAt?: Date | null;
}

export function createApiKeyService(repo: ApiKeyRepository) {
  return {
    async listKeys(actor: Actor): Promise<ApiKeyRecord[]> {
      requirePermission(
        actor,
        canManageApiKeys(actor.role),
        "You do not have permission to view API keys.",
      );
      return repo.listByWorkspace(actor.workspaceId);
    },

    async createKey(actor: Actor, input: CreateApiKeyInput): Promise<CreateApiKeyResult> {
      requirePermission(
        actor,
        canManageApiKeys(actor.role),
        "You do not have permission to create API keys.",
      );

      const name = input.name?.trim();
      if (!name || name.length < 1 || name.length > 50) {
        throw new ValidationError("API key name must be between 1 and 50 characters.");
      }

      if (input.expiresAt && input.expiresAt.getTime() <= Date.now()) {
        throw new ValidationError("Expiration date must be in the future.");
      }

      const { secretKey, keyHash, keyPrefix } = generateSecretKey();
      const id = `key_${crypto.randomUUID()}`;

      const apiKey = await repo.create({
        id,
        name,
        keyHash,
        keyPrefix,
        workspaceId: actor.workspaceId,
        userId: actor.userId,
        expiresAt: input.expiresAt ?? null,
      });

      return {
        apiKey,
        secretKey,
      };
    },

    async deleteKey(actor: Actor, keyId: string): Promise<void> {
      requirePermission(
        actor,
        canManageApiKeys(actor.role),
        "You do not have permission to delete API keys.",
      );

      const key = await repo.findById(keyId);
      if (!key || key.workspaceId !== actor.workspaceId) {
        throw new ValidationError("API key not found.");
      }

      await repo.delete(keyId);
    },

    async authenticateApiKey(rawKey: string): Promise<{
      actor: Actor;
      keyId: string;
      workspaceId: string;
      apiKey: ApiKeyRecord;
    }> {
      if (!rawKey || typeof rawKey !== "string" || !rawKey.trim()) {
        throw new UnauthorizedError("Invalid API key.");
      }

      const keyHash = hashApiKey(rawKey.trim());
      const key = await repo.findByHash(keyHash);

      if (!key) {
        throw new UnauthorizedError("Invalid API key.");
      }

      if (key.expiresAt && key.expiresAt.getTime() < Date.now()) {
        throw new UnauthorizedError("API key has expired.");
      }

      const membership = await repo.getMembership(key.userId, key.workspaceId);
      if (!membership) {
        throw new UnauthorizedError("User is no longer a member of this workspace.");
      }

      const now = new Date();
      await repo.touchLastUsed(key.id, now).catch(() => {});

      const actor: Actor = {
        userId: key.userId,
        workspaceId: key.workspaceId,
        role: membership.role,
      };

      return {
        actor,
        keyId: key.id,
        workspaceId: key.workspaceId,
        apiKey: key,
      };
    },
  };
}

export type ApiKeyService = ReturnType<typeof createApiKeyService>;
