-- AlterEnum
ALTER TYPE "ActivityType" ADD VALUE 'SprintChanged';

-- AlterTable
ALTER TABLE "status" ADD COLUMN     "isDone" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "task" ADD COLUMN     "sprintId" TEXT;

-- CreateTable
CREATE TABLE "sprint" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "goal" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "position" DECIMAL(40,20) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sprint_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sprint_projectId_startDate_idx" ON "sprint"("projectId", "startDate");

-- CreateIndex
CREATE INDEX "sprint_projectId_position_idx" ON "sprint"("projectId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "sprint_projectId_name_uidx" ON "sprint"("projectId", "name");

-- CreateIndex
CREATE INDEX "task_sprintId_idx" ON "task"("sprintId");

-- AddForeignKey
ALTER TABLE "sprint" ADD CONSTRAINT "sprint_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task" ADD CONSTRAINT "task_sprintId_fkey" FOREIGN KEY ("sprintId") REFERENCES "sprint"("id") ON DELETE SET NULL ON UPDATE CASCADE;
