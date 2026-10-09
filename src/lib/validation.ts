import type { z } from "zod";

/** Per-field error map: tên field -> danh sách message. */
export type FieldErrors = Record<string, string[] | undefined>;

/** Rút per-field errors từ ZodError (dùng cho Server Action result). */
export function fieldErrorsFromZod(error: z.ZodError): FieldErrors {
  return error.flatten().fieldErrors as FieldErrors;
}

/** Message đầu tiên — giữ tương thích với UI chỉ hiện 1 alert chung. */
export function firstIssueMessage(
  error: z.ZodError,
  fallback = "Invalid data.",
): string {
  return error.issues[0]?.message ?? fallback;
}
