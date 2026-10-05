import { describe, expect, it } from "vitest";

import type { ProjectActor } from "@/features/authorization/actor";
import { UnauthorizedError, ValidationError } from "@/features/authorization/errors";
import {
  createCustomFieldService,
  type CustomFieldRecord,
  type CustomFieldRepository,
  type TaskContextRecord,
  type TaskCustomFieldValueRecord,
} from "./custom-field-service";

interface MockRepoState {
  fields: CustomFieldRecord[];
  tasks: TaskContextRecord[];
  taskValues: TaskCustomFieldValueRecord[];
  projectWorkspaceId: string | null;
}

function createMockRepo(initialState?: Partial<MockRepoState>): CustomFieldRepository {
  const state: MockRepoState = {
    fields: initialState?.fields ?? [],
    tasks: initialState?.tasks ?? [],
    taskValues: initialState?.taskValues ?? [],
    projectWorkspaceId: initialState?.projectWorkspaceId ?? "ws-1",
  };

  return {
    async getField(fieldId: string) {
      return state.fields.find((f) => f.id === fieldId) ?? null;
    },
    async getProjectWorkspaceId(_projectId: string) {
      return state.projectWorkspaceId;
    },
    async listFieldsByProject(projectId: string) {
      return state.fields
        .filter((f) => f.projectId === projectId)
        .sort((a, b) => Number(a.position) - Number(b.position));
    },
    async createField(input) {
      const field: CustomFieldRecord = {
        id: `field-${state.fields.length + 1}`,
        projectId: input.projectId,
        name: input.name,
        type: input.type,
        options: input.options ?? null,
        required: input.required ?? false,
        position: input.position,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      state.fields.push(field);
      return field;
    },
    async updateField(input) {
      const field = state.fields.find((f) => f.id === input.fieldId);
      if (!field) throw new Error("Not found");
      if (input.name !== undefined) field.name = input.name;
      if (input.type !== undefined) field.type = input.type;
      if (input.options !== undefined) field.options = input.options;
      if (input.required !== undefined) field.required = input.required;
      if (input.position !== undefined) field.position = input.position;
      field.updatedAt = new Date();
      return { ...field };
    },
    async deleteField(fieldId: string) {
      state.fields = state.fields.filter((f) => f.id !== fieldId);
      state.taskValues = state.taskValues.filter((v) => v.fieldId !== fieldId);
    },
    async reorderFields(items) {
      for (const item of items) {
        const field = state.fields.find((f) => f.id === item.id);
        if (field) field.position = item.position;
      }
    },
    async getTask(taskId: string) {
      return state.tasks.find((t) => t.id === taskId) ?? null;
    },
    async getTaskValues(taskId: string) {
      return state.taskValues.filter((v) => v.taskId === taskId);
    },
    async listValuesByTaskIds(taskIds: string[]) {
      return state.taskValues.filter((v) => taskIds.includes(v.taskId));
    },
    async setTaskValue(taskId: string, fieldId: string, value: unknown) {
      const existing = state.taskValues.find((v) => v.taskId === taskId && v.fieldId === fieldId);
      if (existing) {
        existing.value = value;
        existing.updatedAt = new Date();
        return { ...existing };
      }
      const record: TaskCustomFieldValueRecord = {
        taskId,
        fieldId,
        value,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      state.taskValues.push(record);
      return record;
    },
    async batchSetTaskValues(taskId: string, values: { fieldId: string; value: unknown }[]) {
      for (const item of values) {
        const existing = state.taskValues.find(
          (v) => v.taskId === taskId && v.fieldId === item.fieldId,
        );
        if (existing) {
          existing.value = item.value;
          existing.updatedAt = new Date();
        } else {
          state.taskValues.push({
            taskId,
            fieldId: item.fieldId,
            value: item.value,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        }
      }
    },
    async deleteTaskValue(taskId: string, fieldId: string) {
      state.taskValues = state.taskValues.filter(
        (v) => !(v.taskId === taskId && v.fieldId === fieldId),
      );
    },
  };
}

const ownerActor: ProjectActor = {
  userId: "user-owner",
  workspaceId: "ws-1",
  role: "Owner",
  projectId: "proj-1",
  projectRole: "Owner",
};

const adminActor: ProjectActor = {
  userId: "user-admin",
  workspaceId: "ws-1",
  role: "Admin",
  projectId: "proj-1",
  projectRole: "Admin",
};

const memberActor: ProjectActor = {
  userId: "user-member",
  workspaceId: "ws-1",
  role: "Member",
  projectId: "proj-1",
  projectRole: "Member",
};

describe("custom-field-service", () => {
  it("listFields returns fields ordered by position for project members", async () => {
    const repo = createMockRepo({
      fields: [
        {
          id: "f-2",
          projectId: "proj-1",
          name: "Priority Score",
          type: "Number",
          options: null,
          required: false,
          position: "2000.00000000000000000000",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "f-1",
          projectId: "proj-1",
          name: "Environment",
          type: "Select",
          options: ["Staging", "Production"],
          required: true,
          position: "1000.00000000000000000000",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    });
    const service = createCustomFieldService(repo);

    const list = await service.listFields(memberActor, "proj-1");
    expect(list).toHaveLength(2);
    expect(list[0].id).toBe("f-1");
    expect(list[1].id).toBe("f-2");
  });

  it("listFields rejects cross-project or cross-workspace access", async () => {
    const repo = createMockRepo();
    const service = createCustomFieldService(repo);

    await expect(service.listFields(memberActor, "other-proj")).rejects.toThrow(
      UnauthorizedError,
    );
  });

  it("createField creates field for Owner with calculated position", async () => {
    const repo = createMockRepo();
    const service = createCustomFieldService(repo);

    const field = await service.createField(ownerActor, {
      name: "Release Date",
      type: "Date",
    });

    expect(field.name).toBe("Release Date");
    expect(field.type).toBe("Date");
    expect(field.position).toBe("1000.00000000000000000000");
  });

  it("createField allows Admin and calculates incremental position", async () => {
    const repo = createMockRepo({
      fields: [
        {
          id: "f-1",
          projectId: "proj-1",
          name: "First",
          type: "Text",
          options: null,
          required: false,
          position: "1000.00000000000000000000",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    });
    const service = createCustomFieldService(repo);

    const field = await service.createField(adminActor, {
      name: "Second",
      type: "Checkbox",
    });

    expect(field.name).toBe("Second");
    expect(field.position).toBe("2000.00000000000000000000");
  });

  it("createField rejects Member (RBAC)", async () => {
    const repo = createMockRepo();
    const service = createCustomFieldService(repo);

    await expect(
      service.createField(memberActor, {
        name: "Sprint Goal",
        type: "Text",
      }),
    ).rejects.toThrow(UnauthorizedError);
  });

  it("createField validates name length and rejects empty name", async () => {
    const repo = createMockRepo();
    const service = createCustomFieldService(repo);

    await expect(
      service.createField(ownerActor, {
        name: "   ",
        type: "Text",
      }),
    ).rejects.toThrow(ValidationError);

    await expect(
      service.createField(ownerActor, {
        name: "a".repeat(51),
        type: "Text",
      }),
    ).rejects.toThrow(ValidationError);
  });

  it("createField rejects duplicate name in the same project case-insensitively", async () => {
    const repo = createMockRepo({
      fields: [
        {
          id: "f-1",
          projectId: "proj-1",
          name: "Environment",
          type: "Text",
          options: null,
          required: false,
          position: "1000",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    });
    const service = createCustomFieldService(repo);

    await expect(
      service.createField(ownerActor, {
        name: "environment",
        type: "Text",
      }),
    ).rejects.toThrow(ValidationError);
  });

  it("createField validates Select type requires options", async () => {
    const repo = createMockRepo();
    const service = createCustomFieldService(repo);

    await expect(
      service.createField(ownerActor, {
        name: "Severity",
        type: "Select",
        options: [],
      }),
    ).rejects.toThrow(ValidationError);

    const selectField = await service.createField(ownerActor, {
      name: "Severity",
      type: "Select",
      options: ["Low", "High"],
    });
    expect(selectField.options).toEqual(["Low", "High"]);
  });

  it("updateField updates field properties for Admin/Owner", async () => {
    const repo = createMockRepo({
      fields: [
        {
          id: "f-1",
          projectId: "proj-1",
          name: "Old Name",
          type: "Text",
          options: null,
          required: false,
          position: "1000",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    });
    const service = createCustomFieldService(repo);

    const updated = await service.updateField(adminActor, "f-1", {
      name: "New Name",
      required: true,
    });

    expect(updated.name).toBe("New Name");
    expect(updated.required).toBe(true);
  });

  it("updateField rejects duplicate name against existing fields", async () => {
    const repo = createMockRepo({
      fields: [
        {
          id: "f-1",
          projectId: "proj-1",
          name: "Field A",
          type: "Text",
          options: null,
          required: false,
          position: "1000",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "f-2",
          projectId: "proj-1",
          name: "Field B",
          type: "Text",
          options: null,
          required: false,
          position: "2000",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    });
    const service = createCustomFieldService(repo);

    await expect(
      service.updateField(ownerActor, "f-2", { name: "field a" }),
    ).rejects.toThrow(ValidationError);
  });

  it("deleteField removes field and its values", async () => {
    const repo = createMockRepo({
      fields: [
        {
          id: "f-1",
          projectId: "proj-1",
          name: "To Delete",
          type: "Text",
          options: null,
          required: false,
          position: "1000",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      taskValues: [
        {
          taskId: "t-1",
          fieldId: "f-1",
          value: "some text",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    });
    const service = createCustomFieldService(repo);

    await service.deleteField(ownerActor, "f-1");
    const fields = await service.listFields(ownerActor, "proj-1");
    expect(fields).toHaveLength(0);
  });

  it("reorderFields updates positions in order", async () => {
    const repo = createMockRepo({
      fields: [
        {
          id: "f-1",
          projectId: "proj-1",
          name: "A",
          type: "Text",
          options: null,
          required: false,
          position: "1000",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "f-2",
          projectId: "proj-1",
          name: "B",
          type: "Text",
          options: null,
          required: false,
          position: "2000",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    });
    const service = createCustomFieldService(repo);

    await service.reorderFields(ownerActor, ["f-2", "f-1"]);
    const list = await service.listFields(ownerActor, "proj-1");
    expect(list[0].id).toBe("f-2");
    expect(list[1].id).toBe("f-1");
  });

  it("setTaskValue validates Number field (numbers and numeric strings)", async () => {
    const repo = createMockRepo({
      fields: [
        {
          id: "f-num",
          projectId: "proj-1",
          name: "Story Points",
          type: "Number",
          options: null,
          required: false,
          position: "1000",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      tasks: [
        {
          id: "t-1",
          projectId: "proj-1",
          workspaceId: "ws-1",
          creatorId: "user-owner",
          assigneeId: "user-member",
        },
      ],
    });
    const service = createCustomFieldService(repo);

    // Number value
    const v1 = await service.setTaskValue(ownerActor, "t-1", "f-num", 8);
    expect(v1.value).toBe(8);

    // String number
    const v2 = await service.setTaskValue(ownerActor, "t-1", "f-num", "13.5");
    expect(v2.value).toBe(13.5);

    // Invalid number string
    await expect(
      service.setTaskValue(ownerActor, "t-1", "f-num", "not-a-number"),
    ).rejects.toThrow(ValidationError);
  });

  it("setTaskValue validates Date field", async () => {
    const repo = createMockRepo({
      fields: [
        {
          id: "f-date",
          projectId: "proj-1",
          name: "Target Date",
          type: "Date",
          options: null,
          required: false,
          position: "1000",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      tasks: [
        {
          id: "t-1",
          projectId: "proj-1",
          workspaceId: "ws-1",
          creatorId: "user-owner",
          assigneeId: null,
        },
      ],
    });
    const service = createCustomFieldService(repo);

    const v1 = await service.setTaskValue(ownerActor, "t-1", "f-date", "2026-10-15");
    expect(v1.value).toBe("2026-10-15");

    await expect(
      service.setTaskValue(ownerActor, "t-1", "f-date", "invalid-date-string-xyz"),
    ).rejects.toThrow(ValidationError);
  });

  it("setTaskValue validates Select field against options", async () => {
    const repo = createMockRepo({
      fields: [
        {
          id: "f-sel",
          projectId: "proj-1",
          name: "Platform",
          type: "Select",
          options: ["iOS", "Android", "Web"],
          required: false,
          position: "1000",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      tasks: [
        {
          id: "t-1",
          projectId: "proj-1",
          workspaceId: "ws-1",
          creatorId: "user-owner",
          assigneeId: null,
        },
      ],
    });
    const service = createCustomFieldService(repo);

    const v1 = await service.setTaskValue(ownerActor, "t-1", "f-sel", "Web");
    expect(v1.value).toBe("Web");

    await expect(
      service.setTaskValue(ownerActor, "t-1", "f-sel", "Windows"),
    ).rejects.toThrow(ValidationError);
  });

  it("setTaskValue validates Checkbox field", async () => {
    const repo = createMockRepo({
      fields: [
        {
          id: "f-check",
          projectId: "proj-1",
          name: "Needs Review",
          type: "Checkbox",
          options: null,
          required: false,
          position: "1000",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      tasks: [
        {
          id: "t-1",
          projectId: "proj-1",
          workspaceId: "ws-1",
          creatorId: "user-owner",
          assigneeId: null,
        },
      ],
    });
    const service = createCustomFieldService(repo);

    const v1 = await service.setTaskValue(ownerActor, "t-1", "f-check", true);
    expect(v1.value).toBe(true);

    const v2 = await service.setTaskValue(ownerActor, "t-1", "f-check", "false");
    expect(v2.value).toBe(false);
  });

  it("setTaskValue enforces required fields", async () => {
    const repo = createMockRepo({
      fields: [
        {
          id: "f-req",
          projectId: "proj-1",
          name: "Customer ID",
          type: "Text",
          options: null,
          required: true,
          position: "1000",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      tasks: [
        {
          id: "t-1",
          projectId: "proj-1",
          workspaceId: "ws-1",
          creatorId: "user-owner",
          assigneeId: null,
        },
      ],
    });
    const service = createCustomFieldService(repo);

    await expect(
      service.setTaskValue(ownerActor, "t-1", "f-req", ""),
    ).rejects.toThrow(ValidationError);

    await expect(
      service.setTaskValue(ownerActor, "t-1", "f-req", null),
    ).rejects.toThrow(ValidationError);
  });

  it("task value RBAC: assignee Member can set values, unrelated Member is blocked", async () => {
    const repo = createMockRepo({
      fields: [
        {
          id: "f-text",
          projectId: "proj-1",
          name: "Notes",
          type: "Text",
          options: null,
          required: false,
          position: "1000",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      tasks: [
        {
          id: "t-assigned",
          projectId: "proj-1",
          workspaceId: "ws-1",
          creatorId: "user-owner",
          assigneeId: "user-member",
        },
        {
          id: "t-other",
          projectId: "proj-1",
          workspaceId: "ws-1",
          creatorId: "user-owner",
          assigneeId: "user-admin",
        },
      ],
    });
    const service = createCustomFieldService(repo);

    // Assignee member can update
    const v = await service.setTaskValue(memberActor, "t-assigned", "f-text", "Work in progress");
    expect(v.value).toBe("Work in progress");

    // Unrelated member cannot update
    await expect(
      service.setTaskValue(memberActor, "t-other", "f-text", "Unauthorized note"),
    ).rejects.toThrow(UnauthorizedError);
  });

  it("batchSetTaskValues updates multiple values atomically", async () => {
    const repo = createMockRepo({
      fields: [
        {
          id: "f-1",
          projectId: "proj-1",
          name: "Score",
          type: "Number",
          options: null,
          required: false,
          position: "1000",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "f-2",
          projectId: "proj-1",
          name: "Flag",
          type: "Checkbox",
          options: null,
          required: false,
          position: "2000",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      tasks: [
        {
          id: "t-1",
          projectId: "proj-1",
          workspaceId: "ws-1",
          creatorId: "user-owner",
          assigneeId: null,
        },
      ],
    });
    const service = createCustomFieldService(repo);

    await service.batchSetTaskValues(ownerActor, "t-1", [
      { fieldId: "f-1", value: 100 },
      { fieldId: "f-2", value: true },
    ]);

    const values = await service.getTaskValues(ownerActor, "t-1");
    expect(values).toHaveLength(2);
    expect(values.find((v) => v.fieldId === "f-1")?.value).toBe(100);
    expect(values.find((v) => v.fieldId === "f-2")?.value).toBe(true);
  });
});
