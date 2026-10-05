import { randomUUID } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";

import { prisma } from "@/lib/prisma";
import type {
  CustomFieldRecord,
  CustomFieldRepository,
  CustomFieldType,
  TaskContextRecord,
  TaskCustomFieldValueRecord,
} from "./custom-field-service";

const CUSTOM_FIELD_SELECT = {
  id: true,
  projectId: true,
  name: true,
  type: true,
  options: true,
  required: true,
  position: true,
  createdAt: true,
  updatedAt: true,
} as const;

function mapFieldRow(row: {
  id: string;
  projectId: string;
  name: string;
  type: string;
  options: Prisma.JsonValue | null;
  required: boolean;
  position: Prisma.Decimal | string;
  createdAt: Date;
  updatedAt: Date;
}): CustomFieldRecord {
  return {
    id: row.id,
    projectId: row.projectId,
    name: row.name,
    type: row.type as CustomFieldType,
    options: Array.isArray(row.options) ? (row.options as string[]) : null,
    required: row.required,
    position: row.position.toString(),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapValueRow(row: {
  taskId: string;
  fieldId: string;
  value: Prisma.JsonValue | null;
  createdAt: Date;
  updatedAt: Date;
}): TaskCustomFieldValueRecord {
  return {
    taskId: row.taskId,
    fieldId: row.fieldId,
    value: row.value,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export const prismaCustomFieldRepository: CustomFieldRepository = {
  async getField(fieldId: string): Promise<CustomFieldRecord | null> {
    const row = await prisma.customField.findUnique({
      where: { id: fieldId },
      select: CUSTOM_FIELD_SELECT,
    });
    return row ? mapFieldRow(row) : null;
  },

  async getProjectWorkspaceId(projectId: string): Promise<string | null> {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { workspaceId: true },
    });
    return project?.workspaceId ?? null;
  },

  async listFieldsByProject(projectId: string): Promise<CustomFieldRecord[]> {
    const rows = await prisma.customField.findMany({
      where: { projectId },
      orderBy: { position: "asc" },
      select: CUSTOM_FIELD_SELECT,
    });
    return rows.map(mapFieldRow);
  },

  async createField(input: {
    projectId: string;
    name: string;
    type: CustomFieldType;
    options?: string[] | null;
    required?: boolean;
    position: string;
  }): Promise<CustomFieldRecord> {
    const id = randomUUID();
    const position = new Prisma.Decimal(input.position);

    const row = await prisma.customField.create({
      data: {
        id,
        projectId: input.projectId,
        name: input.name,
        type: input.type,
        options: input.options ? (input.options as Prisma.InputJsonValue) : Prisma.JsonNull,
        required: input.required ?? false,
        position,
      },
      select: CUSTOM_FIELD_SELECT,
    });
    return mapFieldRow(row);
  },

  async updateField(input: {
    fieldId: string;
    name?: string;
    type?: CustomFieldType;
    options?: string[] | null;
    required?: boolean;
    position?: string;
  }): Promise<CustomFieldRecord> {
    const data: Prisma.CustomFieldUpdateInput = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.type !== undefined) data.type = input.type;
    if (input.options !== undefined) {
      data.options = input.options ? (input.options as Prisma.InputJsonValue) : Prisma.JsonNull;
    }
    if (input.required !== undefined) data.required = input.required;
    if (input.position !== undefined) data.position = new Prisma.Decimal(input.position);

    const row = await prisma.customField.update({
      where: { id: input.fieldId },
      data,
      select: CUSTOM_FIELD_SELECT,
    });
    return mapFieldRow(row);
  },

  async deleteField(fieldId: string): Promise<void> {
    await prisma.customField.delete({
      where: { id: fieldId },
    });
  },

  async reorderFields(items: { id: string; position: string }[]): Promise<void> {
    await prisma.$transaction(
      items.map((item) =>
        prisma.customField.update({
          where: { id: item.id },
          data: { position: new Prisma.Decimal(item.position) },
        }),
      ),
    );
  },

  async getTask(taskId: string): Promise<TaskContextRecord | null> {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: {
        id: true,
        projectId: true,
        creatorId: true,
        assigneeId: true,
        project: { select: { workspaceId: true } },
      },
    });
    if (!task) return null;
    return {
      id: task.id,
      projectId: task.projectId,
      workspaceId: task.project.workspaceId,
      creatorId: task.creatorId,
      assigneeId: task.assigneeId,
    };
  },

  async getTaskValues(taskId: string): Promise<TaskCustomFieldValueRecord[]> {
    const rows = await prisma.taskCustomFieldValue.findMany({
      where: { taskId },
      select: {
        taskId: true,
        fieldId: true,
        value: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return rows.map(mapValueRow);
  },

  async listValuesByTaskIds(taskIds: string[]): Promise<TaskCustomFieldValueRecord[]> {
    if (taskIds.length === 0) return [];
    const rows = await prisma.taskCustomFieldValue.findMany({
      where: { taskId: { in: taskIds } },
      select: {
        taskId: true,
        fieldId: true,
        value: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return rows.map(mapValueRow);
  },

  async setTaskValue(
    taskId: string,
    fieldId: string,
    value: unknown,
  ): Promise<TaskCustomFieldValueRecord> {
    const row = await prisma.taskCustomFieldValue.upsert({
      where: { taskId_fieldId: { taskId, fieldId } },
      create: {
        taskId,
        fieldId,
        value: value !== null && value !== undefined ? (value as Prisma.InputJsonValue) : Prisma.JsonNull,
      },
      update: {
        value: value !== null && value !== undefined ? (value as Prisma.InputJsonValue) : Prisma.JsonNull,
      },
      select: {
        taskId: true,
        fieldId: true,
        value: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return mapValueRow(row);
  },

  async batchSetTaskValues(
    taskId: string,
    values: { fieldId: string; value: unknown }[],
  ): Promise<void> {
    await prisma.$transaction(
      values.map((v) =>
        prisma.taskCustomFieldValue.upsert({
          where: { taskId_fieldId: { taskId, fieldId: v.fieldId } },
          create: {
            taskId,
            fieldId: v.fieldId,
            value: v.value !== null && v.value !== undefined ? (v.value as Prisma.InputJsonValue) : Prisma.JsonNull,
          },
          update: {
            value: v.value !== null && v.value !== undefined ? (v.value as Prisma.InputJsonValue) : Prisma.JsonNull,
          },
        }),
      ),
    );
  },

  async deleteTaskValue(taskId: string, fieldId: string): Promise<void> {
    await prisma.taskCustomFieldValue.deleteMany({
      where: { taskId, fieldId },
    });
  },
};
