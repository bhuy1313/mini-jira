import { z } from "zod";

/**
 * Schema dùng chung cho create/update workspace.
 * Đặt ở module client-safe (không "use server") để cả Server Action
 * và `useForm` (conform) phía client cùng dùng một nguồn sự thật.
 */
export const workspaceNameSchema = z
  .string()
  .trim()
  .min(1, "Workspace name is required.")
  .max(80, "Workspace name must be at most 80 characters.");

export const workspaceDescriptionSchema = z
  .string()
  .trim()
  .max(500, "Description must be at most 500 characters.")
  .optional();

export const createWorkspaceSchema = z.object({
  name: workspaceNameSchema,
  description: workspaceDescriptionSchema,
  icon: z.string().trim().max(50).optional(),
});

export const updateWorkspaceSchema = z.object({
  name: workspaceNameSchema,
  description: workspaceDescriptionSchema,
  icon: z.string().trim().max(50).optional(),
});
