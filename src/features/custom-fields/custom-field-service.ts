import { canEditTask, canManageCustomFields } from "@/features/authorization/permissions";
import { UnauthorizedError, ValidationError } from "@/features/authorization/errors";
import type { ProjectActor } from "@/features/authorization/actor";

export type CustomFieldType = "Text" | "Number" | "Date" | "Select" | "Checkbox";

export const CUSTOM_FIELD_TYPES: readonly CustomFieldType[] = [
  "Text",
  "Number",
  "Date",
  "Select",
  "Checkbox",
] as const;

export interface CustomFieldRecord {
  id: string;
  projectId: string;
  name: string;
  type: CustomFieldType;
  options: string[] | null;
  required: boolean;
  position: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TaskCustomFieldValueRecord {
  taskId: string;
  fieldId: string;
  value: unknown;
  createdAt: Date;
  updatedAt: Date;
}

export interface TaskContextRecord {
  id: string;
  projectId: string;
  workspaceId: string;
  creatorId: string;
  assigneeId: string | null;
}

export interface CustomFieldRepository {
  getField(fieldId: string): Promise<CustomFieldRecord | null>;
  getProjectWorkspaceId(projectId: string): Promise<string | null>;
  listFieldsByProject(projectId: string): Promise<CustomFieldRecord[]>;
  createField(input: {
    projectId: string;
    name: string;
    type: CustomFieldType;
    options?: string[] | null;
    required?: boolean;
    position: string;
  }): Promise<CustomFieldRecord>;
  updateField(input: {
    fieldId: string;
    name?: string;
    type?: CustomFieldType;
    options?: string[] | null;
    required?: boolean;
    position?: string;
  }): Promise<CustomFieldRecord>;
  deleteField(fieldId: string): Promise<void>;
  reorderFields(items: { id: string; position: string }[]): Promise<void>;
  getTask(taskId: string): Promise<TaskContextRecord | null>;
  getTaskValues(taskId: string): Promise<TaskCustomFieldValueRecord[]>;
  listValuesByTaskIds(taskIds: string[]): Promise<TaskCustomFieldValueRecord[]>;
  setTaskValue(taskId: string, fieldId: string, value: unknown): Promise<TaskCustomFieldValueRecord>;
  batchSetTaskValues(taskId: string, values: { fieldId: string; value: unknown }[]): Promise<void>;
  deleteTaskValue(taskId: string, fieldId: string): Promise<void>;
}

export function validateFieldValue(field: CustomFieldRecord, rawValue: unknown): unknown {
  if (rawValue === null || rawValue === undefined || rawValue === "") {
    if (field.required) {
      throw new ValidationError(`Field "${field.name}" is required.`);
    }
    return null;
  }

  switch (field.type) {
    case "Number": {
      if (typeof rawValue === "number" && !Number.isNaN(rawValue) && Number.isFinite(rawValue)) {
        return rawValue;
      }
      if (typeof rawValue === "string" && rawValue.trim() !== "") {
        const num = Number(rawValue);
        if (!Number.isNaN(num) && Number.isFinite(num)) {
          return num;
        }
      }
      throw new ValidationError(`Value for field "${field.name}" must be a valid number.`);
    }

    case "Date": {
      if (typeof rawValue === "string" || rawValue instanceof Date) {
        const d = new Date(rawValue);
        if (!Number.isNaN(d.getTime())) {
          return typeof rawValue === "string" ? rawValue : d.toISOString();
        }
      }
      throw new ValidationError(`Value for field "${field.name}" must be a valid date.`);
    }

    case "Select": {
      const options = Array.isArray(field.options) ? field.options : [];
      if (typeof rawValue !== "string" || !options.includes(rawValue)) {
        throw new ValidationError(
          `Value for field "${field.name}" must be one of: ${options.join(", ")}`,
        );
      }
      return rawValue;
    }

    case "Checkbox": {
      if (typeof rawValue === "boolean") {
        return rawValue;
      }
      if (rawValue === "true" || rawValue === "1" || rawValue === 1) return true;
      if (rawValue === "false" || rawValue === "0" || rawValue === 0) return false;
      throw new ValidationError(`Value for field "${field.name}" must be a boolean.`);
    }

    case "Text": {
      if (typeof rawValue !== "string") {
        return String(rawValue);
      }
      return rawValue;
    }

    default:
      return rawValue;
  }
}

export function createCustomFieldService(repo: CustomFieldRepository) {
  async function guardProjectAccess(actor: ProjectActor, projectId: string): Promise<void> {
    if (actor.projectId !== projectId) {
      throw new UnauthorizedError("Project context mismatch.");
    }
    const wsId = await repo.getProjectWorkspaceId(projectId);
    if (!wsId || wsId !== actor.workspaceId) {
      throw new UnauthorizedError("Project not found in this workspace.");
    }
  }

  return {
    async listFields(actor: ProjectActor, projectId: string): Promise<CustomFieldRecord[]> {
      await guardProjectAccess(actor, projectId);
      return repo.listFieldsByProject(projectId);
    },

    async createField(
      actor: ProjectActor,
      input: {
        name: string;
        type: CustomFieldType;
        options?: string[] | null;
        required?: boolean;
        position?: string;
      },
    ): Promise<CustomFieldRecord> {
      await guardProjectAccess(actor, actor.projectId);
      if (!canManageCustomFields(actor.projectRole)) {
        throw new UnauthorizedError("Only project Owner or Admin can manage custom fields.");
      }

      const name = input.name?.trim();
      if (!name || name.length > 50) {
        throw new ValidationError("Custom field name must be between 1 and 50 characters.");
      }

      if (!CUSTOM_FIELD_TYPES.includes(input.type)) {
        throw new ValidationError(`Invalid custom field type: ${input.type}`);
      }

      let options: string[] | null = null;
      if (input.type === "Select") {
        if (!Array.isArray(input.options) || input.options.length === 0) {
          throw new ValidationError("Select field requires at least one option.");
        }
        const cleaned = input.options.map((o) => String(o).trim()).filter((o) => o.length > 0);
        if (cleaned.length === 0) {
          throw new ValidationError("Select field requires at least one option.");
        }
        options = cleaned;
      }

      const existingFields = await repo.listFieldsByProject(actor.projectId);
      if (existingFields.some((f) => f.name.toLowerCase() === name.toLowerCase())) {
        throw new ValidationError(`Custom field "${name}" already exists in this project.`);
      }

      let position = input.position;
      if (!position) {
        if (existingFields.length === 0) {
          position = "1000.00000000000000000000";
        } else {
          const maxPos = Math.max(...existingFields.map((f) => Number(f.position) || 0));
          position = (maxPos + 1000).toFixed(20);
        }
      }

      return repo.createField({
        projectId: actor.projectId,
        name,
        type: input.type,
        options,
        required: input.required ?? false,
        position,
      });
    },

    async updateField(
      actor: ProjectActor,
      fieldId: string,
      input: {
        name?: string;
        type?: CustomFieldType;
        options?: string[] | null;
        required?: boolean;
        position?: string;
      },
    ): Promise<CustomFieldRecord> {
      await guardProjectAccess(actor, actor.projectId);
      if (!canManageCustomFields(actor.projectRole)) {
        throw new UnauthorizedError("Only project Owner or Admin can manage custom fields.");
      }

      const field = await repo.getField(fieldId);
      if (!field || field.projectId !== actor.projectId) {
        throw new UnauthorizedError("Custom field not found in this project.");
      }

      const data: {
        name?: string;
        type?: CustomFieldType;
        options?: string[] | null;
        required?: boolean;
        position?: string;
      } = {};

      if (input.name !== undefined) {
        const name = input.name.trim();
        if (!name || name.length > 50) {
          throw new ValidationError("Custom field name must be between 1 and 50 characters.");
        }
        const existingFields = await repo.listFieldsByProject(actor.projectId);
        if (
          existingFields.some(
            (f) => f.id !== fieldId && f.name.toLowerCase() === name.toLowerCase(),
          )
        ) {
          throw new ValidationError(`Custom field "${name}" already exists in this project.`);
        }
        data.name = name;
      }

      const targetType = input.type ?? field.type;
      if (input.type !== undefined) {
        if (!CUSTOM_FIELD_TYPES.includes(input.type)) {
          throw new ValidationError(`Invalid custom field type: ${input.type}`);
        }
        data.type = input.type;
      }

      if (targetType === "Select") {
        const rawOptions = input.options !== undefined ? input.options : field.options;
        if (!Array.isArray(rawOptions) || rawOptions.length === 0) {
          throw new ValidationError("Select field requires at least one option.");
        }
        const cleaned = rawOptions.map((o) => String(o).trim()).filter((o) => o.length > 0);
        if (cleaned.length === 0) {
          throw new ValidationError("Select field requires at least one option.");
        }
        data.options = cleaned;
      } else if (input.type !== undefined && input.type !== "Select") {
        data.options = null;
      } else if (input.options !== undefined) {
        data.options = input.options;
      }

      if (input.required !== undefined) {
        data.required = input.required;
      }

      if (input.position !== undefined) {
        data.position = input.position;
      }

      return repo.updateField({
        fieldId,
        ...data,
      });
    },

    async deleteField(actor: ProjectActor, fieldId: string): Promise<void> {
      await guardProjectAccess(actor, actor.projectId);
      if (!canManageCustomFields(actor.projectRole)) {
        throw new UnauthorizedError("Only project Owner or Admin can manage custom fields.");
      }

      const field = await repo.getField(fieldId);
      if (!field || field.projectId !== actor.projectId) {
        throw new UnauthorizedError("Custom field not found in this project.");
      }

      await repo.deleteField(fieldId);
    },

    async reorderFields(actor: ProjectActor, fieldIds: string[]): Promise<void> {
      await guardProjectAccess(actor, actor.projectId);
      if (!canManageCustomFields(actor.projectRole)) {
        throw new UnauthorizedError("Only project Owner or Admin can manage custom fields.");
      }

      const existingFields = await repo.listFieldsByProject(actor.projectId);
      const existingMap = new Map(existingFields.map((f) => [f.id, f]));

      if (fieldIds.length !== existingFields.length) {
        throw new ValidationError("Must provide all field IDs to reorder.");
      }

      for (const id of fieldIds) {
        if (!existingMap.has(id)) {
          throw new ValidationError(`Field ${id} does not belong to this project.`);
        }
      }

      const items = fieldIds.map((id, index) => ({
        id,
        position: ((index + 1) * 1000).toFixed(20),
      }));

      await repo.reorderFields(items);
    },

    async getTaskValues(actor: ProjectActor, taskId: string): Promise<TaskCustomFieldValueRecord[]> {
      const task = await repo.getTask(taskId);
      if (!task || task.projectId !== actor.projectId || task.workspaceId !== actor.workspaceId) {
        throw new UnauthorizedError("Task not found in this project.");
      }
      return repo.getTaskValues(taskId);
    },

    async setTaskValue(
      actor: ProjectActor,
      taskId: string,
      fieldId: string,
      rawValue: unknown,
    ): Promise<TaskCustomFieldValueRecord> {
      const task = await repo.getTask(taskId);
      if (!task || task.projectId !== actor.projectId || task.workspaceId !== actor.workspaceId) {
        throw new UnauthorizedError("Task not found in this project.");
      }

      const canEdit = canEditTask({
        role: actor.projectRole,
        isCreator: task.creatorId === actor.userId,
        isAssignee: task.assigneeId === actor.userId,
      });
      if (!canEdit) {
        throw new UnauthorizedError("You do not have permission to edit this task.");
      }

      const field = await repo.getField(fieldId);
      if (!field || field.projectId !== actor.projectId) {
        throw new UnauthorizedError("Custom field not found in this project.");
      }

      const validated = validateFieldValue(field, rawValue);
      return repo.setTaskValue(taskId, fieldId, validated);
    },

    async batchSetTaskValues(
      actor: ProjectActor,
      taskId: string,
      values: { fieldId: string; value: unknown }[],
    ): Promise<void> {
      const task = await repo.getTask(taskId);
      if (!task || task.projectId !== actor.projectId || task.workspaceId !== actor.workspaceId) {
        throw new UnauthorizedError("Task not found in this project.");
      }

      const canEdit = canEditTask({
        role: actor.projectRole,
        isCreator: task.creatorId === actor.userId,
        isAssignee: task.assigneeId === actor.userId,
      });
      if (!canEdit) {
        throw new UnauthorizedError("You do not have permission to edit this task.");
      }

      const existingFields = await repo.listFieldsByProject(actor.projectId);
      const fieldMap = new Map(existingFields.map((f) => [f.id, f]));

      const validatedItems: { fieldId: string; value: unknown }[] = [];
      for (const item of values) {
        const field = fieldMap.get(item.fieldId);
        if (!field) {
          throw new UnauthorizedError(`Custom field ${item.fieldId} not found in this project.`);
        }
        const validated = validateFieldValue(field, item.value);
        validatedItems.push({ fieldId: item.fieldId, value: validated });
      }

      await repo.batchSetTaskValues(taskId, validatedItems);
    },
  };
}

export type CustomFieldService = ReturnType<typeof createCustomFieldService>;
