import { describe, expect, it, vi } from "vitest";

import type {
  AccountRepository,
  UserProfile,
  UserSession,
  UserWorkspaceOverview,
} from "@/features/account/account-repository";
import { AccountService } from "@/features/account/account-service";
import { NotFoundError, ValidationError } from "@/features/authorization/errors";

function createMockRepository(overrides?: Partial<AccountRepository>): AccountRepository {
  const mockUser: UserProfile = {
    id: "user-1",
    name: "Alice Owner",
    email: "alice@demo.com",
    emailVerified: true,
    image: null,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
  };

  const mockSessions: UserSession[] = [
    {
      id: "session-1",
      token: "tok-1",
      expiresAt: new Date("2026-10-01"),
      ipAddress: "127.0.0.1",
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0",
      createdAt: new Date("2026-09-01"),
      updatedAt: new Date("2026-09-01"),
    },
    {
      id: "session-2",
      token: "tok-2",
      expiresAt: new Date("2026-10-01"),
      ipAddress: "192.168.1.50",
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Firefox/120.0",
      createdAt: new Date("2026-09-10"),
      updatedAt: new Date("2026-09-10"),
    },
  ];

  const mockWorkspaces: UserWorkspaceOverview[] = [
    {
      workspaceId: "ws-1",
      workspaceName: "Engineering Team",
      workspaceDescription: "Core dev team workspace",
      role: "Owner",
      joinedAt: new Date("2026-01-01"),
      projectCount: 3,
    },
  ];

  return {
    getUserProfile: vi.fn().mockResolvedValue(mockUser),
    updateUserProfile: vi.fn().mockImplementation(async (userId, data) => ({
      ...mockUser,
      ...data,
      updatedAt: new Date(),
    })),
    getUserSessions: vi.fn().mockResolvedValue(mockSessions),
    deleteSession: vi.fn().mockResolvedValue(true),
    deleteOtherSessions: vi.fn().mockResolvedValue(1),
    getUserWorkspaces: vi.fn().mockResolvedValue(mockWorkspaces),
    ...overrides,
  };
}

describe("AccountService", () => {
  describe("getAccountOverview", () => {
    it("returns user profile, marked current session, and workspaces", async () => {
      const repo = createMockRepository();
      const service = new AccountService(repo);

      const overview = await service.getAccountOverview("user-1", "tok-1");

      expect(overview.user.name).toBe("Alice Owner");
      expect(overview.user.email).toBe("alice@demo.com");
      expect(overview.sessions).toHaveLength(2);
      expect(overview.sessions[0].isCurrent).toBe(true);
      expect(overview.sessions[1].isCurrent).toBe(false);
      expect(overview.workspaces).toHaveLength(1);
      expect(overview.workspaces[0].workspaceName).toBe("Engineering Team");
    });

    it("throws NotFoundError when user does not exist", async () => {
      const repo = createMockRepository({
        getUserProfile: vi.fn().mockResolvedValue(null),
      });
      const service = new AccountService(repo);

      await expect(service.getAccountOverview("non-existent")).rejects.toThrow(NotFoundError);
    });
  });

  describe("updateProfile", () => {
    it("updates display name successfully", async () => {
      const repo = createMockRepository();
      const service = new AccountService(repo);

      const updated = await service.updateProfile("user-1", {
        name: "Alice Updated",
      });

      expect(repo.updateUserProfile).toHaveBeenCalledWith("user-1", {
        name: "Alice Updated",
        image: undefined,
      });
      expect(updated.name).toBe("Alice Updated");
    });

    it("rejects empty name with ValidationError", async () => {
      const repo = createMockRepository();
      const service = new AccountService(repo);

      await expect(
        service.updateProfile("user-1", {
          name: "   ",
        }),
      ).rejects.toThrow(ValidationError);
    });

    it("rejects name longer than 50 characters with ValidationError", async () => {
      const repo = createMockRepository();
      const service = new AccountService(repo);

      await expect(
        service.updateProfile("user-1", {
          name: "A".repeat(51),
        }),
      ).rejects.toThrow(ValidationError);
    });

    it("throws NotFoundError if user does not exist", async () => {
      const repo = createMockRepository({
        getUserProfile: vi.fn().mockResolvedValue(null),
      });
      const service = new AccountService(repo);

      await expect(
        service.updateProfile("non-existent", {
          name: "New Name",
        }),
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe("revokeSession", () => {
    it("revokes an existing user session", async () => {
      const repo = createMockRepository();
      const service = new AccountService(repo);

      const result = await service.revokeSession("user-1", "session-2");

      expect(repo.deleteSession).toHaveBeenCalledWith("user-1", "session-2");
      expect(result.success).toBe(true);
    });

    it("throws ValidationError for empty sessionId", async () => {
      const repo = createMockRepository();
      const service = new AccountService(repo);

      await expect(service.revokeSession("user-1", "")).rejects.toThrow(ValidationError);
    });

    it("throws NotFoundError when target session does not exist in user sessions", async () => {
      const repo = createMockRepository();
      const service = new AccountService(repo);

      await expect(service.revokeSession("user-1", "foreign-session-99")).rejects.toThrow(
        NotFoundError,
      );
    });
  });

  describe("revokeOtherSessions", () => {
    it("revokes all other sessions except the current token", async () => {
      const repo = createMockRepository({
        deleteOtherSessions: vi.fn().mockResolvedValue(3),
      });
      const service = new AccountService(repo);

      const result = await service.revokeOtherSessions("user-1", "tok-current");

      expect(repo.deleteOtherSessions).toHaveBeenCalledWith("user-1", "tok-current");
      expect(result.revokedCount).toBe(3);
    });

    it("throws ValidationError when currentSessionToken is empty", async () => {
      const repo = createMockRepository();
      const service = new AccountService(repo);

      await expect(service.revokeOtherSessions("user-1", "")).rejects.toThrow(ValidationError);
    });
  });
});
