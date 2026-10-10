-- AddColumns
ALTER TABLE "project" ADD COLUMN "key" TEXT;
ALTER TABLE "project" ADD COLUMN "taskCounter" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "task" ADD COLUMN "key" TEXT;

-- Backfill project keys: first 3 alphanumerics of name (upper), fallback
-- 'PRJ', deduplicated per workspace with a -N suffix. The dash keeps this
-- provably collision-free in pure SQL (stems never contain '-', so stem and
-- stem-N can never equal each other or another stem). New projects instead
-- use dash-free STEM+N with an existence-check loop in project-service.
WITH base AS (
  SELECT "id", "workspaceId", "createdAt",
    COALESCE(NULLIF(UPPER(SUBSTRING(REGEXP_REPLACE("name", '[^A-Za-z0-9]', '', 'g') FROM 1 FOR 3)), ''), 'PRJ') AS stem
  FROM "project"
), ranked AS (
  SELECT "id", "stem",
    ROW_NUMBER() OVER (PARTITION BY "workspaceId", "stem" ORDER BY "createdAt") AS rn
  FROM base
)
UPDATE "project" p
SET "key" = CASE WHEN r.rn = 1 THEN r.stem ELSE r.stem || '-' || r.rn END
FROM ranked r WHERE r."id" = p."id";

-- Backfill per-project task sequence + task keys in creation order.
UPDATE "project" p
SET "taskCounter" = (SELECT COUNT(*) FROM "task" t WHERE t."projectId" = p."id");

WITH ranked AS (
  SELECT t."id", p."key" AS pkey,
    ROW_NUMBER() OVER (PARTITION BY t."projectId" ORDER BY t."createdAt") AS rn
  FROM "task" t JOIN "project" p ON p."id" = t."projectId"
)
UPDATE "task" t SET "key" = r.pkey || '-' || r.rn
FROM ranked r WHERE r."id" = t."id";

-- Enforce
ALTER TABLE "project" ALTER COLUMN "key" SET NOT NULL;
CREATE UNIQUE INDEX "project_workspaceId_key_key" ON "project"("workspaceId", "key");
CREATE UNIQUE INDEX "task_projectId_key_key" ON "task"("projectId", "key");
