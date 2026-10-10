-- Re-baseline: captures every out-of-band change applied directly to dev DBs
-- (webhooks, worklogs, task enrichment, workspace icon) so fresh databases
-- created from migration history match the schema. Generated via
-- `prisma migrate diff --from-migrations --to-schema`, applied as-is.
-- NOTE: drops task_search_vector_gin_idx (unmanaged by the schema);
-- re-run prisma/setup-fulltext.sql afterwards if the GIN index is wanted.
-- CreateEnum
CREATE TYPE "WebhookFormat" AS ENUM ('Generic', 'Slack', 'Discord');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ActivityType" ADD VALUE 'EstimateChanged';
ALTER TYPE "ActivityType" ADD VALUE 'Worklogged';

-- DropIndex
DROP INDEX "task_search_vector_gin_idx";

-- AlterTable
ALTER TABLE "task" ADD COLUMN     "originalEstimateMinutes" INTEGER,
ADD COLUMN     "parentId" TEXT;

-- AlterTable
ALTER TABLE "workspace" ADD COLUMN     "icon" TEXT;

-- CreateTable
CREATE TABLE "worklog" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "timeSpentMinutes" INTEGER NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "worklog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "secret" TEXT,
    "format" "WebhookFormat" NOT NULL DEFAULT 'Generic',
    "events" JSONB NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "projectId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "webhook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_delivery_log" (
    "id" TEXT NOT NULL,
    "webhookId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "statusCode" INTEGER,
    "responseBody" TEXT,
    "durationMs" INTEGER NOT NULL,
    "success" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_delivery_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "worklog_taskId_idx" ON "worklog"("taskId");

-- CreateIndex
CREATE INDEX "worklog_authorId_idx" ON "worklog"("authorId");

-- CreateIndex
CREATE INDEX "worklog_taskId_startedAt_idx" ON "worklog"("taskId", "startedAt");

-- CreateIndex
CREATE INDEX "webhook_projectId_enabled_idx" ON "webhook"("projectId", "enabled");

-- CreateIndex
CREATE INDEX "webhook_delivery_log_webhookId_createdAt_idx" ON "webhook_delivery_log"("webhookId", "createdAt");

-- CreateIndex
CREATE INDEX "task_parentId_idx" ON "task"("parentId");

-- AddForeignKey
ALTER TABLE "task" ADD CONSTRAINT "task_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "worklog" ADD CONSTRAINT "worklog_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "worklog" ADD CONSTRAINT "worklog_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook" ADD CONSTRAINT "webhook_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_delivery_log" ADD CONSTRAINT "webhook_delivery_log_webhookId_fkey" FOREIGN KEY ("webhookId") REFERENCES "webhook"("id") ON DELETE CASCADE ON UPDATE CASCADE;
