-- CreateEnum
CREATE TYPE "RuleTriggerType" AS ENUM ('TaskCreated', 'StatusChanged', 'PriorityChanged');

-- CreateEnum
CREATE TYPE "RuleActionType" AS ENUM ('ChangeAssignee', 'ChangePriority', 'ChangeStatus', 'AddComment');

-- CreateEnum
CREATE TYPE "ExecutionStatus" AS ENUM ('Success', 'Failed', 'Skipped');

-- CreateTable
CREATE TABLE "automation_rule" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "triggerType" "RuleTriggerType" NOT NULL,
    "triggerConfig" JSONB,
    "actionType" "RuleActionType" NOT NULL,
    "actionConfig" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "automation_rule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "automation_execution_log" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "status" "ExecutionStatus" NOT NULL,
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "automation_execution_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "automation_rule_projectId_enabled_idx" ON "automation_rule"("projectId", "enabled");

-- CreateIndex
CREATE INDEX "automation_execution_log_ruleId_createdAt_idx" ON "automation_execution_log"("ruleId", "createdAt");

-- CreateIndex
CREATE INDEX "automation_execution_log_taskId_idx" ON "automation_execution_log"("taskId");

-- AddForeignKey
ALTER TABLE "automation_rule" ADD CONSTRAINT "automation_rule_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_execution_log" ADD CONSTRAINT "automation_execution_log_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "automation_rule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
