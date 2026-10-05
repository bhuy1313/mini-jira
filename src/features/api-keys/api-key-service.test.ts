import crypto from "node:crypto";
import { describe, expect, it } from "vitest";

import type { Actor } from "@/features/authorization/actor";
import { UnauthorizedError, ValidationError } from "@/features/authorization/errors";
import type { Role } from "@/features/authorization/permissions";
import {
  createApiKeyService,
  generateSecretKey,
  hashApiKey,
  type ApiKeyRecord,
  type ApiKeyRepository,
} from "./api-key-service";

interface MockRepoState {
  keys: ApiKeyRecord[];
  memberships: Array<{ userId: string; workspaceId: string; role: Role }>;
}

function createMockRepo(initialState?: Partial<MockRepoState>): ApiKeyRepository & { state: MockRepoState } {
  const state: MockRepoState = {
    keys: initialState?.keys ?? [],
    memberships: initialState?.memberships ?? [],
  };

  return {
    state,
    async listByWorkspace(workspaceId: string) {
      return state.keys.filter((k) => k.workspaceId === workspaceId);
    },
    async findById(keyId: string) {
      return state.keys.find((k) => k.id === keyId) ?? null;
    },
    async findByHash(keyHash: string) {
      return state.keys.find((k) => k.keyHash === keyHash) ?? null;
    },
    async create(data) {
      const now = new Date();
      const record: ApiKeyRecord = {
        id: data.id,
        name: data.name,
        keyHash: data.keyHash,
        keyPrefix: data.keyPrefix,
        workspaceId: data.workspaceId,
        userId: data.userId,
        expiresAt: data.expiresAt ?? null,
        lastUsedAt: null,
        createdAt: now,
        updatedAt: now,
      };
      state.keys.push(record);
      return record;
    },
    async delete(keyId: string) {
      state.keys = state.keys.filter((k) => k.id !== keyId);
    },
    async touchLastUsed(keyId: string, lastUsedAt: Date) {
      const k = state.keys.find((item) => item.id === keyId);
      if (k) {
        k.lastUsedAt = lastUsedAt;
      }
    },
    async getMembership(userId: string, workspaceId: string) {
      const m = state.memberships.find((item) => item.userId === userId && item.workspaceId === workspaceId);
      return m ? { role: m.role } : null;
    },
  };
}

const ownerActor: Actor = {
  userId: "user-owner",
  workspaceId: "ws-1",
  role: "Owner",
};

const adminActor: Actor = {
  userId: "user-admin",
  workspaceId: "ws-1",
  role: "Admin",
};

const memberActor: Actor = {
  userId: "user-member",
  workspaceId: "ws-1",
  role: "Member",
};

describe("ApiKey Service", () => {
  describe("Key Generation & Hashing", () => {
    it("sinh secret key đúng tiền tố mj_live_ và prefix 8 ký tự", () => {
      const { secretKey, keyHash, keyPrefix } = generateSecretKey();
      expect(secretKey.startsWith("mj_live_")).toBe(true);
      expect(keyPrefix).toBe("mj_live_");
      expect(keyHash).toBe(crypto.createHash("sha256").update(secretKey).digest("hex"));
    });

    it("hash sha256 nhất quán cho cùng một raw key", () => {
      const raw = "mj_live_abcdef1234567890";
      const hash1 = hashApiKey(raw);
      const hash2 = hashApiKey(raw);
      expect(hash1).toBe(hash2);
      expect(hash1.length).toBe(64);
    });
  });

  describe("Create API Key", () => {
    it("Owner tạo API key thành công", async () => {
      const repo = createMockRepo();
      const service = createApiKeyService(repo);

      const result = await service.createKey(ownerActor, {
        name: "Production Backend",
      });

      expect(result.secretKey).toBeDefined();
      expect(result.secretKey.startsWith("mj_live_")).toBe(true);
      expect(result.apiKey.name).toBe("Production Backend");
      expect(result.apiKey.workspaceId).toBe("ws-1");
      expect(result.apiKey.userId).toBe("user-owner");
      expect(repo.state.keys).toHaveLength(1);
    });

    it("Admin tạo API key thành công", async () => {
      const repo = createMockRepo();
      const service = createApiKeyService(repo);

      const result = await service.createKey(adminActor, {
        name: "CI Key",
      });

      expect(result.apiKey.name).toBe("CI Key");
      expect(result.apiKey.userId).toBe("user-admin");
    });

    it("Member tạo API key bị từ chối với UnauthorizedError", async () => {
      const repo = createMockRepo();
      const service = createApiKeyService(repo);

      await expect(
        service.createKey(memberActor, { name: "Test" }),
      ).rejects.toThrow(UnauthorizedError);
    });

    it("Validate tên rỗng hoặc quá 50 ký tự", async () => {
      const repo = createMockRepo();
      const service = createApiKeyService(repo);

      await expect(
        service.createKey(ownerActor, { name: "" }),
      ).rejects.toThrow(ValidationError);

      await expect(
        service.createKey(ownerActor, { name: "a".repeat(51) }),
      ).rejects.toThrow(ValidationError);
    });

    it("Validate expiresAt trong quá khứ bị từ chối", async () => {
      const repo = createMockRepo();
      const service = createApiKeyService(repo);

      const pastDate = new Date(Date.now() - 1000 * 60);
      await expect(
        service.createKey(ownerActor, { name: "Test Key", expiresAt: pastDate }),
      ).rejects.toThrow(ValidationError);
    });

    it("Cho phép tạo API key kèm expiresAt trong tương lai", async () => {
      const repo = createMockRepo();
      const service = createApiKeyService(repo);

      const futureDate = new Date(Date.now() + 1000 * 60 * 60 * 24);
      const result = await service.createKey(ownerActor, {
        name: "Expiring Key",
        expiresAt: futureDate,
      });

      expect(result.apiKey.expiresAt).toEqual(futureDate);
    });
  });

  describe("List API Keys", () => {
    it("Owner/Admin liệt kê danh sách API keys của workspace", async () => {
      const repo = createMockRepo();
      const service = createApiKeyService(repo);

      await service.createKey(ownerActor, { name: "Key 1" });
      await service.createKey(adminActor, { name: "Key 2" });

      const keys = await service.listKeys(ownerActor);
      expect(keys).toHaveLength(2);
      expect(keys.map((k) => k.name)).toEqual(["Key 1", "Key 2"]);
    });

    it("Member không có quyền xem API keys", async () => {
      const repo = createMockRepo();
      const service = createApiKeyService(repo);

      await expect(service.listKeys(memberActor)).rejects.toThrow(UnauthorizedError);
    });
  });

  describe("Delete API Key", () => {
    it("Owner/Admin xóa API key thành công", async () => {
      const repo = createMockRepo();
      const service = createApiKeyService(repo);

      const created = await service.createKey(ownerActor, { name: "Key to delete" });
      expect(repo.state.keys).toHaveLength(1);

      await service.deleteKey(adminActor, created.apiKey.id);
      expect(repo.state.keys).toHaveLength(0);
    });

    it("Member không có quyền xóa API key", async () => {
      const repo = createMockRepo();
      const service = createApiKeyService(repo);

      const created = await service.createKey(ownerActor, { name: "Key to delete" });
      await expect(
        service.deleteKey(memberActor, created.apiKey.id),
      ).rejects.toThrow(UnauthorizedError);
    });

    it("Xóa key không tồn tại ném ValidationError", async () => {
      const repo = createMockRepo();
      const service = createApiKeyService(repo);

      await expect(
        service.deleteKey(ownerActor, "non-existent-id"),
      ).rejects.toThrow(ValidationError);
    });

    it("Xóa key thuộc workspace khác ném ValidationError", async () => {
      const repo = createMockRepo();
      const service = createApiKeyService(repo);

      const otherWsActor: Actor = { userId: "user-other", workspaceId: "ws-2", role: "Owner" };
      const created = await service.createKey(otherWsActor, { name: "Other WS key" });

      await expect(
        service.deleteKey(ownerActor, created.apiKey.id),
      ).rejects.toThrow(ValidationError);
    });
  });

  describe("Authenticate API Key", () => {
    it("Xác thực API key hợp lệ trả về Actor và cập nhật lastUsedAt", async () => {
      const repo = createMockRepo({
        memberships: [{ userId: "user-owner", workspaceId: "ws-1", role: "Owner" }],
      });
      const service = createApiKeyService(repo);

      const { secretKey, apiKey } = await service.createKey(ownerActor, { name: "Live Key" });

      const authResult = await service.authenticateApiKey(secretKey);
      expect(authResult.actor.userId).toBe("user-owner");
      expect(authResult.actor.workspaceId).toBe("ws-1");
      expect(authResult.actor.role).toBe("Owner");
      expect(authResult.keyId).toBe(apiKey.id);

      const keyInDb = await repo.findById(apiKey.id);
      expect(keyInDb?.lastUsedAt).not.toBeNull();
    });

    it("Xác thực API key không hợp lệ ném UnauthorizedError", async () => {
      const repo = createMockRepo();
      const service = createApiKeyService(repo);

      await expect(
        service.authenticateApiKey("mj_live_invalid_key_12345"),
      ).rejects.toThrow(UnauthorizedError);

      await expect(
        service.authenticateApiKey(""),
      ).rejects.toThrow(UnauthorizedError);
    });

    it("Xác thực API key đã hết hạn ném UnauthorizedError", async () => {
      const repo = createMockRepo({
        memberships: [{ userId: "user-owner", workspaceId: "ws-1", role: "Owner" }],
      });
      const service = createApiKeyService(repo);

      const { secretKey, apiKey } = await service.createKey(ownerActor, {
        name: "Expiring Soon",
        expiresAt: new Date(Date.now() + 1000 * 60),
      });

      // Manually set expiration in past
      const keyInDb = repo.state.keys.find((k) => k.id === apiKey.id);
      if (keyInDb) {
        keyInDb.expiresAt = new Date(Date.now() - 1000 * 60);
      }

      await expect(
        service.authenticateApiKey(secretKey),
      ).rejects.toThrow("API key has expired.");
    });

    it("Xác thực khi user đã bị gỡ khỏi workspace ném UnauthorizedError", async () => {
      const repo = createMockRepo({
        memberships: [], // No membership
      });
      const service = createApiKeyService(repo);

      const { secretKey } = await service.createKey(ownerActor, { name: "Orphan Key" });

      await expect(
        service.authenticateApiKey(secretKey),
      ).rejects.toThrow("User is no longer a member of this workspace.");
    });
  });
});
