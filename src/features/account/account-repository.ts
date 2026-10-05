import type { Role } from "@/generated/prisma/client";

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserSession {
  id: string;
  token: string;
  expiresAt: Date;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
  updatedAt: Date;
  isCurrent?: boolean;
}

export interface UserWorkspaceOverview {
  workspaceId: string;
  workspaceName: string;
  workspaceDescription: string | null;
  workspaceIcon?: string | null;
  role: Role;
  joinedAt: Date;
  projectCount: number;
}

export interface AccountRepository {
  getUserProfile(userId: string): Promise<UserProfile | null>;
  updateUserProfile(
    userId: string,
    data: { name: string; image?: string | null },
  ): Promise<UserProfile>;
  getUserSessions(userId: string): Promise<UserSession[]>;
  deleteSession(userId: string, sessionId: string): Promise<boolean>;
  deleteOtherSessions(userId: string, currentSessionToken: string): Promise<number>;
  getUserWorkspaces(userId: string): Promise<UserWorkspaceOverview[]>;
}
