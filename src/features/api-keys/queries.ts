import { cache } from "react";

import type { Actor } from "@/features/authorization/actor";
import { requireActor } from "@/features/workspaces/session";
import { createApiKeyService, type ApiKeyRecord } from "@/features/api-keys/api-key-service";
import { prismaApiKeyRepository } from "@/features/api-keys/prisma-api-key-repository";

const apiKeyService = createApiKeyService(prismaApiKeyRepository);

export const listWorkspaceApiKeys = cache(async (
  workspaceOrActor: string | Actor,
): Promise<ApiKeyRecord[]> => {
  const actor =
    typeof workspaceOrActor === "string"
      ? await requireActor(workspaceOrActor)
      : workspaceOrActor;
  return apiKeyService.listKeys(actor);
});
