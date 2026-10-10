import {
  type AccountRepository,
  type UserProfile,
  type UserSession,
  type UserWorkspaceOverview,
} from "@/features/account/account-repository";
import {
  updateProfileSchema,
  type UpdateProfileInput,
} from "@/features/account/account-schemas";
import type { NotificationPreferences } from "@/features/notifications/notification-service";
import { NotFoundError, ValidationError } from "@/features/authorization/errors";

export interface AccountOverview {
  user: UserProfile;
  sessions: UserSession[];
  workspaces: UserWorkspaceOverview[];
  /** Gắn ở queries layer (không qua AccountService) — tab Notifications. */
  notificationPreferences?: NotificationPreferences;
}

export class AccountService {
  constructor(private readonly repo: AccountRepository) {}

  async getAccountOverview(
    userId: string,
    currentSessionToken?: string,
  ): Promise<AccountOverview> {
    const [user, rawSessions, workspaces] = await Promise.all([
      this.repo.getUserProfile(userId),
      this.repo.getUserSessions(userId),
      this.repo.getUserWorkspaces(userId),
    ]);

    if (!user) {
      throw new NotFoundError("User not found");
    }

    const sessions = rawSessions.map((s) => ({
      ...s,
      isCurrent: currentSessionToken ? s.token === currentSessionToken : false,
    }));

    return {
      user,
      sessions,
      workspaces,
    };
  }

  async updateProfile(userId: string, input: UpdateProfileInput): Promise<UserProfile> {
    const validated = updateProfileSchema.safeParse(input);
    if (!validated.success) {
      const firstError = validated.error.issues[0]?.message || "Invalid profile data";
      throw new ValidationError(firstError);
    }

    const existing = await this.repo.getUserProfile(userId);
    if (!existing) {
      throw new NotFoundError("User not found");
    }

    return this.repo.updateUserProfile(userId, {
      name: validated.data.name,
      image: validated.data.image,
    });
  }

  async revokeSession(
    userId: string,
    sessionId: string,
  ): Promise<{ success: boolean; isCurrentSession: boolean }> {
    if (!sessionId || sessionId.trim().length === 0) {
      throw new ValidationError("Session ID is required");
    }

    const sessions = await this.repo.getUserSessions(userId);
    const targetSession = sessions.find((s) => s.id === sessionId);

    if (!targetSession) {
      throw new NotFoundError("Session not found or already expired");
    }

    const deleted = await this.repo.deleteSession(userId, sessionId);
    return {
      success: deleted,
      isCurrentSession: false,
    };
  }

  async revokeOtherSessions(
    userId: string,
    currentSessionToken: string,
  ): Promise<{ revokedCount: number }> {
    if (!currentSessionToken) {
      throw new ValidationError("Current session token is required to revoke other sessions");
    }

    const revokedCount = await this.repo.deleteOtherSessions(userId, currentSessionToken);
    return { revokedCount };
  }
}
