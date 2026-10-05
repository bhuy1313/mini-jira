import { prismaWebhookRepository } from "./prisma-webhook-repository";
import { createWebhookDispatcher } from "./webhook-dispatcher";

export const webhookDispatcher = createWebhookDispatcher(prismaWebhookRepository);
