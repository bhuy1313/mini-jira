"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { UnauthorizedError, ValidationError } from "@/features/authorization/errors";
import { publishBoardUpdate } from "@/features/live/live-publisher";
import { prismaCustomFieldRepository } from "@/features/custom-fields/prisma-custom-field-repository";
import {
  createCustomFieldService,
  CUSTOM_FIELD_TYPES,
  type CustomFieldType,
} from "@/features/custom-fields/custom-field-service";
import { requireProjectActor } from "@/features/workspaces/session";

const customFieldService = createCustomFieldService(prismaCustomFieldRepository);

const customFieldNameSchema = z
  .string()
  .trim()
  .min(1, "Custom field name must be between 1 and 50 characters.")
  .max(50, "Custom field name must be between 1 and 50 characters.");

const customFieldTypeSchema = z.enum(CUSTOM_FIELD_TYPES as unknown as [CustomFieldType, ...CustomFieldType[]]);

function message(error: unknown): string {
  if (
    error instanceof UnauthorizedError ||
    error instanceof ValidationError
  ) {
    return error.message;
  }
  return "Something went wrong. Please try again.";
}

function projectPaths(workspaceId: string, projectId: string): string[] {
  return [
    `/workspaces/${workspaceId}/projects/${projectId}`,
    `/workspaces/${workspaceId}/projects/${projectId}/settings`,
  ];
}

function parseOptions(raw: FormDataEntryValue | null): string[] | null {
  if (!raw) return null;
  const str = String(raw).trim();
  if (!str) return null;
  try {
    const parsed = JSON.parse(str);
    if (Array.isArray(parsed)) {
      return parsed.map((s) => String(s).trim()).filter((s) => s.length > 0);
    }
  } catch {
    // Treat as comma or newline separated
  }
  return str
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** Create a custom field — Owner/Admin (Mốc 18). */
export async function createCustomFieldAction(
  workspaceId: string,
  projectId: string,
  formData: FormData,
): Promise<{ error?: string }> {
  const actor = await requireProjectActor(workspaceId, projectId);

  const nameRaw = formData.get("name");
  const typeRaw = formData.get("type");
  const requiredRaw = formData.get("required");
  const optionsRaw = formData.get("options");

  const nameParsed = customFieldNameSchema.safeParse(nameRaw);
  if (!nameParsed.success) {
    return { error: nameParsed.error.issues[0]?.message ?? "Invalid name." };
  }

  const typeParsed = customFieldTypeSchema.safeParse(typeRaw);
  if (!typeParsed.success) {
    return { error: "Invalid custom field type." };
  }

  const required = requiredRaw === "true" || requiredRaw === "on" || requiredRaw === "1";
  const options = parseOptions(optionsRaw);

  try {
    await customFieldService.createField(actor, {
      name: nameParsed.data,
      type: typeParsed.data,
      options,
      required,
    });
  } catch (error) {
    return { error: message(error) };
  }

  for (const path of projectPaths(workspaceId, projectId)) {
    revalidatePath(path);
  }
  publishBoardUpdate(workspaceId, projectId, actor.userId);
  return {};
}

/** Update a custom field — Owner/Admin (Mốc 18). */
export async function updateCustomFieldAction(
  workspaceId: string,
  projectId: string,
  fieldId: string,
  formData: FormData,
): Promise<{ error?: string }> {
  const actor = await requireProjectActor(workspaceId, projectId);

  const nameRaw = formData.get("name");
  const typeRaw = formData.get("type");
  const requiredRaw = formData.get("required");
  const optionsRaw = formData.get("options");

  let name: string | undefined;
  if (nameRaw !== null && nameRaw !== undefined) {
    const nameParsed = customFieldNameSchema.safeParse(nameRaw);
    if (!nameParsed.success) {
      return { error: nameParsed.error.issues[0]?.message ?? "Invalid name." };
    }
    name = nameParsed.data;
  }

  let type: CustomFieldType | undefined;
  if (typeRaw !== null && typeRaw !== undefined && String(typeRaw).trim() !== "") {
    const typeParsed = customFieldTypeSchema.safeParse(typeRaw);
    if (!typeParsed.success) {
      return { error: "Invalid custom field type." };
    }
    type = typeParsed.data;
  }

  const required =
    requiredRaw !== null
      ? requiredRaw === "true" || requiredRaw === "on" || requiredRaw === "1"
      : undefined;

  const options = optionsRaw !== null ? parseOptions(optionsRaw) : undefined;

  try {
    await customFieldService.updateField(actor, fieldId, {
      name,
      type,
      required,
      options,
    });
  } catch (error) {
    return { error: message(error) };
  }

  for (const path of projectPaths(workspaceId, projectId)) {
    revalidatePath(path);
  }
  publishBoardUpdate(workspaceId, projectId, actor.userId);
  return {};
}

/** Delete a custom field — Owner/Admin (Mốc 18). */
export async function deleteCustomFieldAction(
  workspaceId: string,
  projectId: string,
  fieldId: string,
): Promise<{ error?: string }> {
  const actor = await requireProjectActor(workspaceId, projectId);
  try {
    await customFieldService.deleteField(actor, fieldId);
  } catch (error) {
    return { error: message(error) };
  }

  for (const path of projectPaths(workspaceId, projectId)) {
    revalidatePath(path);
  }
  publishBoardUpdate(workspaceId, projectId, actor.userId);
  return {};
}

/** Reorder custom fields — Owner/Admin (Mốc 18). */
export async function reorderCustomFieldsAction(
  workspaceId: string,
  projectId: string,
  fieldIds: string[],
): Promise<{ error?: string }> {
  const actor = await requireProjectActor(workspaceId, projectId);
  try {
    await customFieldService.reorderFields(actor, fieldIds);
  } catch (error) {
    return { error: message(error) };
  }

  for (const path of projectPaths(workspaceId, projectId)) {
    revalidatePath(path);
  }
  publishBoardUpdate(workspaceId, projectId, actor.userId);
  return {};
}

/** Set custom field value for a task — Person with edit permission on task (Mốc 18). */
export async function setTaskCustomFieldValueAction(
  workspaceId: string,
  projectId: string,
  taskId: string,
  fieldId: string,
  value: unknown,
): Promise<{ error?: string }> {
  const actor = await requireProjectActor(workspaceId, projectId);
  try {
    await customFieldService.setTaskValue(actor, taskId, fieldId, value);
  } catch (error) {
    return { error: message(error) };
  }

  // NOTE: intentionally no revalidatePath/publishBoardUpdate here. The drawer
  // already shows the optimistic value and the board never displays custom
  // fields — a revalidation storm here aborts the NEXT rapid save POST
  // ("destination stream closed early"). Fresh state arrives on close/reload
  // or the next unrelated refresh.
  return {};
}

/** Batch set custom field values for a task — Person with edit permission on task (Mốc 18). */
export async function batchSetTaskCustomFieldValuesAction(
  workspaceId: string,
  projectId: string,
  taskId: string,
  values: { fieldId: string; value: unknown }[],
): Promise<{ error?: string }> {
  const actor = await requireProjectActor(workspaceId, projectId);
  try {
    await customFieldService.batchSetTaskValues(actor, taskId, values);
  } catch (error) {
    return { error: message(error) };
  }

  for (const path of projectPaths(workspaceId, projectId)) {
    revalidatePath(path);
  }
  publishBoardUpdate(workspaceId, projectId, actor.userId);
  return {};
}
