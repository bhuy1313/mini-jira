import type { Priority } from "@/features/authorization/permissions";

export const PRIORITY_LABEL: Record<Priority, string> = {
  Low: "Low",
  Medium: "Medium",
  High: "High",
  Urgent: "Urgent",
};

/** Sọc signal bên cạnh card — chỉ High/Urgent hiện màu; Low/Medium im lặng. */
export const PRIORITY_SIGNAL_CLASS: Record<Priority, string> = {
  Low: "bg-transparent",
  Medium: "bg-rule-strong",
  High: "bg-urgent",
  Urgent: "bg-danger",
};

/** Màu text cho priority khi hiện dạng badge/dot. */
export const PRIORITY_TEXT_CLASS: Record<Priority, string> = {
  Low: "text-ink-faint",
  Medium: "text-ink-soft",
  High: "text-urgent",
  Urgent: "text-danger",
};

/** Pill màu cho priority tag trên card (giống Jira). */
export const PRIORITY_TAG_CLASS: Record<Priority, string> = {
  Low: "bg-rule/80 text-ink-soft",
  Medium: "bg-primary-soft text-primary-ink",
  High: "bg-urgent-soft text-urgent",
  Urgent: "bg-danger-soft text-danger",
};

export function getStatusDotClass(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes("done") || lower.includes("complete") || lower.includes("finish") || lower.includes("closed")) {
    return "bg-done";
  }
  if (
    lower.includes("progress") ||
    lower.includes("doing") ||
    lower.includes("dev") ||
    lower.includes("review") ||
    lower.includes("test")
  ) {
    return "bg-primary";
  }
  return "bg-rule-strong";
}