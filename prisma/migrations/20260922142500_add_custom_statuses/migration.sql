-- CreateTable
CREATE TABLE "status" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position" DECIMAL(40,20) NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "status_pkey" PRIMARY KEY ("id")
);

-- Seed default statuses for all existing projects
INSERT INTO "status" ("id", "projectId", "name", "position", "isDefault", "createdAt", "updatedAt")
SELECT
    concat('status-', "id", '-todo'),
    "id",
    'To Do',
    1000.00000000000000000000,
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "project"
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "status" ("id", "projectId", "name", "position", "isDefault", "createdAt", "updatedAt")
SELECT
    concat('status-', "id", '-inprogress'),
    "id",
    'In Progress',
    2000.00000000000000000000,
    false,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "project"
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "status" ("id", "projectId", "name", "position", "isDefault", "createdAt", "updatedAt")
SELECT
    concat('status-', "id", '-done'),
    "id",
    'Done',
    3000.00000000000000000000,
    false,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "project"
ON CONFLICT ("id") DO NOTHING;

-- Add statusId column as nullable initially
ALTER TABLE "task" ADD COLUMN "statusId" TEXT;

-- Backfill statusId from existing task status
UPDATE "task"
SET "statusId" = concat('status-', "projectId", '-todo')
WHERE "status"::text = 'Todo';

UPDATE "task"
SET "statusId" = concat('status-', "projectId", '-inprogress')
WHERE "status"::text = 'InProgress';

UPDATE "task"
SET "statusId" = concat('status-', "projectId", '-done')
WHERE "status"::text = 'Done';

-- Fallback for any remaining tasks
UPDATE "task"
SET "statusId" = concat('status-', "projectId", '-todo')
WHERE "statusId" IS NULL;

-- Make statusId NOT NULL
ALTER TABLE "task" ALTER COLUMN "statusId" SET NOT NULL;

-- Drop old indices
DROP INDEX IF EXISTS "task_projectId_status_position_idx";
DROP INDEX IF EXISTS "task_projectId_status_idx";
DROP INDEX IF EXISTS "task_status_idx";

-- Drop old status column & enum
ALTER TABLE "task" DROP COLUMN "status";
DROP TYPE IF EXISTS "TaskStatus";

-- CreateIndex
CREATE UNIQUE INDEX "status_projectId_name_uidx" ON "status"("projectId", "name");

-- CreateIndex
CREATE INDEX "status_projectId_position_idx" ON "status"("projectId", "position");

-- CreateIndex
CREATE INDEX "task_projectId_statusId_position_idx" ON "task"("projectId", "statusId", "position");

-- CreateIndex
CREATE INDEX "task_projectId_statusId_idx" ON "task"("projectId", "statusId");

-- CreateIndex
CREATE INDEX "task_statusId_idx" ON "task"("statusId");

-- AddForeignKey
ALTER TABLE "status" ADD CONSTRAINT "status_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task" ADD CONSTRAINT "task_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "status"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
