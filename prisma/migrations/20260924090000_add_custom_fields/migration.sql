-- CreateEnum
CREATE TYPE "CustomFieldType" AS ENUM ('Text', 'Number', 'Date', 'Select', 'Checkbox');

-- CreateTable
CREATE TABLE "custom_field" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "CustomFieldType" NOT NULL,
    "options" JSONB,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "position" DECIMAL(40,20) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "custom_field_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_custom_field_value" (
    "taskId" TEXT NOT NULL,
    "fieldId" TEXT NOT NULL,
    "value" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_custom_field_value_pkey" PRIMARY KEY ("taskId","fieldId")
);

-- CreateIndex
CREATE INDEX "custom_field_projectId_position_idx" ON "custom_field"("projectId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "custom_field_projectId_name_uidx" ON "custom_field"("projectId", "name");

-- CreateIndex
CREATE INDEX "task_custom_field_value_fieldId_idx" ON "task_custom_field_value"("fieldId");

-- AddForeignKey
ALTER TABLE "custom_field" ADD CONSTRAINT "custom_field_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_custom_field_value" ADD CONSTRAINT "task_custom_field_value_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_custom_field_value" ADD CONSTRAINT "task_custom_field_value_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "custom_field"("id") ON DELETE CASCADE ON UPDATE CASCADE;
