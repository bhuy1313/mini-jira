"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { UnauthorizedError, ValidationError } from "@/features/authorization/errors";
import { requireActor } from "@/features/workspaces/session";
import {
  createApiKeyService,
  type ApiKeyRecord,
} from "@/features/api-keys/api-key-service";
import { prismaApiKeyRepository } from "@/features/api-keys/prisma-api-key-repository";

const apiKeyService = createApiKeyService(prismaApiKeyRepository);

const apiKeyNameSchema = z
  .string()
  .trim()
  .min(1, "API key name must be between 1 and 50 characters.")
  .max(50, "API key name must be between 1 and 50 characters.");

function message(error: unknown): string {
  if (error instanceof UnauthorizedError || error instanceof ValidationError) {
    return error.message;
  }
  return "Something went wrong. Please try again.";
}

function settingsPath(workspaceId: string): string {
  return `/workspaces/${workspaceId}/settings`;
}

export async function createApiKeyAction(
  workspaceId: string,
  formData: FormData,
): Promise<{ error?: string; apiKey?: ApiKeyRecord; secretKey?: string }> {
  try {
    const actor = await requireActor(workspaceId);

    const nameRaw = formData.get("name");
    const expiresAtRaw = formData.get("expiresAt");

    const nameParsed = apiKeyNameSchema.safeParse(nameRaw);
    if (!nameParsed.success) {
      return { error: nameParsed.error.issues[0]?.message ?? "Invalid name." };
    }

    let expiresAt: Date | null = null;
    if (expiresAtRaw && typeof expiresAtRaw === "string" && expiresAtRaw.trim()) {
      expiresAt = new Date(expiresAtRaw.trim());
      if (isNaN(expiresAt.getTime())) {
        return { error: "Invalid expiration date." };
      }
      if (expiresAt.getTime() <= Date.now()) {
        return { error: "Expiration date must be in the future." };
      }
    }

    const result = await apiKeyService.createKey(actor, {
      name: nameParsed.data,
      expiresAt,
    });

    revalidatePath(settingsPath(workspaceId));
    return {
      apiKey: result.apiKey,
      secretKey: result.secretKey,
    };
  } catch (err) {
    return { error: message(err) };
  }
}

export async function deleteApiKeyAction(
  workspaceId: string,
  keyId: string,
): Promise<{ error?: string }> {
  try {
    const actor = await requireActor(workspaceId);
    await apiKeyService.deleteKey(actor, keyId);
    revalidatePath(settingsPath(workspaceId));
    return {};
  } catch (err) {
    return { error: message(err) };
  }
}
