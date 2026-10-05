"use client";

import type { ActivityRecord } from "@/features/activities/activity-service";

function formatActivityMessage(activity: ActivityRecord): string {
  const actorName = activity.actor?.name || activity.actor?.email || "Someone";
  switch (activity.type) {
    case "TaskCreated":
      return `${actorName} created this task.`;
    case "TitleChanged":
      return `${actorName} changed title from "${activity.oldValue ?? ""}" to "${activity.newValue ?? ""}".`;
    case "StatusChanged":
      return `${actorName} moved status from ${activity.oldValue ?? "unknown"} to ${activity.newValue ?? "unknown"}.`;
    case "PriorityChanged":
      return `${actorName} changed priority from ${activity.oldValue ?? "none"} to ${activity.newValue ?? "none"}.`;
    case "AssigneeChanged":
      if (!activity.newValue) {
        return `${actorName} removed the assignee.`;
      }
      return `${actorName} updated the assignee.`;
    case "DueDateChanged":
      if (!activity.newValue) {
        return `${actorName} removed the due date.`;
      }
      return `${actorName} set due date to ${activity.newValue.slice(0, 10)}.`;
    case "SprintChanged":
      if (!activity.oldValue && !activity.newValue) {
        return `${actorName} cleared the sprint.`;
      }
      if (!activity.oldValue) {
        return `${actorName} added this task to sprint "${activity.newValue}".`;
      }
      if (!activity.newValue) {
        return `${actorName} removed this task from sprint "${activity.oldValue}" (backlog).`;
      }
      return `${actorName} moved this task from sprint "${activity.oldValue}" to "${activity.newValue}".`;
    default:
      return `${actorName} updated this task.`;
  }
}

export function ActivityTimeline({ activities }: { activities: ActivityRecord[] }) {
  if (activities.length === 0) {
    return (
      <p className="py-6 text-center text-xs text-ink-faint">
        No activity history recorded yet.
      </p>
    );
  }

  return (
    <ol className="relative space-y-4 pl-5 before:absolute before:bottom-1 before:left-[5px] before:top-1 before:w-px before:bg-rule">
      {activities.map((activity) => {
        const formattedDate = new Date(activity.createdAt).toLocaleString(undefined, {
          dateStyle: "medium",
          timeStyle: "short",
        });
        const actorName = activity.actor?.name || activity.actor?.email || "Someone";

        return (
          <li key={activity.id} className="relative">
            <span
              aria-hidden
              className="absolute -left-5 top-1.5 grid size-3 place-items-center rounded-full border border-ink bg-panel"
            >
              <span className="size-1.5 rounded-full bg-ink" />
            </span>
            <p className="text-sm text-ink-soft">
              <span className="font-medium text-ink">{actorName}</span>{" "}
              {formatActivityMessage(activity).replace(actorName, "").trim()}
            </p>
            <time className="text-xs text-ink-faint">{formattedDate}</time>
          </li>
        );
      })}
    </ol>
  );
}