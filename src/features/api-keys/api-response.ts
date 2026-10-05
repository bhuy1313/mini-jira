import { NextResponse } from "next/server";

import { UnauthorizedError, ValidationError } from "@/features/authorization/errors";
import type { Actor } from "@/features/authorization/actor";
import { createApiKeyService } from "./api-key-service";
import { prismaApiKeyRepository } from "./prisma-api-key-repository";

const apiKeyService = createApiKeyService(prismaApiKeyRepository);

export function jsonSuccess<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data }, { status });
}

export function jsonError(code: string, message: string, status = 400) {
  return NextResponse.json(
    {
      success: false,
      error: {
        code,
        message,
      },
    },
    { status },
  );
}

export async function requireApiActor(
  request: Request,
  expectedWorkspaceId?: string,
): Promise<{
  actor: Actor;
  keyId: string;
  workspaceId: string;
}> {
  const authHeader = request.headers.get("authorization");
  const xApiKey = request.headers.get("x-api-key");

  let rawKey: string | null = null;

  if (authHeader) {
    const parts = authHeader.split(" ");
    if (parts.length === 2 && (parts[0] === "Bearer" || parts[0] === "ApiKey")) {
      rawKey = parts[1];
    } else {
      rawKey = authHeader.trim();
    }
  } else if (xApiKey) {
    rawKey = xApiKey.trim();
  }

  if (!rawKey) {
    throw new UnauthorizedError(
      "Missing API key. Provide Authorization: Bearer <key> or x-api-key header.",
    );
  }

  const result = await apiKeyService.authenticateApiKey(rawKey);

  if (expectedWorkspaceId && result.workspaceId !== expectedWorkspaceId) {
    throw new UnauthorizedError(
      "API key is not authorized for the requested workspace.",
    );
  }

  return {
    actor: result.actor,
    keyId: result.keyId,
    workspaceId: result.workspaceId,
  };
}

export function handleApiError(error: unknown) {
  if (error instanceof UnauthorizedError) {
    return jsonError("UNAUTHORIZED", error.message, 401);
  }
  if (error instanceof ValidationError) {
    return jsonError("VALIDATION_ERROR", error.message, 400);
  }
  if (error instanceof Error && error.message.includes("not found")) {
    return jsonError("NOT_FOUND", error.message, 404);
  }
  const msg = error instanceof Error ? error.message : "Internal server error";
  return jsonError("INTERNAL_ERROR", msg, 500);
}
