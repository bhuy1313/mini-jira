"use client";

import { useState, useTransition } from "react";

import { cn } from "@/lib/cn";
import { setNotificationPreferenceAction } from "@/features/notifications/actions";
import {
  NOTIFICATION_TYPES,
  type NotificationPreferences,
  type NotificationType,
} from "@/features/notifications/notification-service";

const TYPE_META: Record<NotificationType, { name: string; description: string }> = {
  TaskAssigned: {
    name: "Task assignments",
    description: "When someone assigns a task to you.",
  },
  NewComment: {
    name: "New comments",
    description: "When someone comments on your tasks or tasks assigned to you.",
  },
  WorkspaceInvited: {
    name: "Workspace invites",
    description: "When you are added to a workspace.",
  },
  ProjectArchived: {
    name: "Project archived",
    description: "When a project in your workspace is archived.",
  },
};

/** Per-type opt-out — tắt thì loại đó không ghi DB cũng không bắn real-time. */
export function NotificationPreferencesForm({
  initialPreferences,
}: {
  initialPreferences: NotificationPreferences;
}) {
  const [prefs, setPrefs] = useState(initialPreferences);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function toggle(type: NotificationType, next: boolean) {
    const prev = prefs;
    setPrefs((p) => ({ ...p, [type]: next }));
    setError(null);
    startTransition(async () => {
      const res = await setNotificationPreferenceAction(type, next);
      if (res?.error) {
        setPrefs(prev);
        setError(res.error);
      }
    });
  }

  return (
    <section
      aria-label="Notification preferences"
      className="rounded-xl border border-rule bg-panel p-5 shadow-xs"
    >
      <div className="flex flex-col gap-1">
        <h2 className="text-sm font-semibold text-ink">Notifications</h2>
        <p className="text-xs text-ink-soft">
          Choose which events notify you. Disabled types are never stored.
        </p>
      </div>

      <ul className="mt-4 divide-y divide-rule border-t border-rule">
        {NOTIFICATION_TYPES.map((type) => {
          const meta = TYPE_META[type];
          const enabled = prefs[type];
          return (
            <li key={type} className="flex items-center justify-between gap-4 py-3">
              <div className="min-w-0">
                <p className="text-xs font-medium text-ink">{meta.name}</p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-ink-faint">
                  {meta.description}
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={enabled}
                aria-label={meta.name}
                disabled={isPending}
                onClick={() => toggle(type, !enabled)}
                className={cn(
                  "relative h-5.5 w-10 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50",
                  enabled ? "bg-primary" : "bg-ink-faint/30",
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "absolute top-0.5 left-0.5 grid size-4.5 place-items-center rounded-full bg-white shadow-xs transition-transform",
                    enabled && "translate-x-5",
                  )}
                />
              </button>
            </li>
          );
        })}
      </ul>

      {error ? (
        <p role="alert" className="mt-2 text-xs text-danger">
          {error}
        </p>
      ) : null}
    </section>
  );
}
