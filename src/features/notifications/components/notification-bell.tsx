"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { BellIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import { formatRelativeShort } from "@/lib/dates";
import { isMutationBusy } from "@/lib/mutation-busy";
import { startNavigation } from "@/lib/navigation-pending";
import { useLiveEvents } from "@/features/live/use-live-events";
import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "@/features/notifications/actions";
import type { NotificationRecord } from "@/features/notifications/notification-service";

function notificationHref(n: NotificationRecord): string {
  const p = n.payload as Record<string, string>;
  switch (n.type) {
    case "TaskAssigned":
    case "NewComment":
      return `/workspaces/${p.workspaceId}/projects/${p.projectId}`;
    case "WorkspaceInvited":
      return `/workspaces/${p.workspaceId}`;
    case "ProjectArchived":
      return `/workspaces/${p.workspaceId}/projects/${p.projectId}`;
    default:
      return "/workspaces";
  }
}

function notificationLabel(n: NotificationRecord): string {
  const p = n.payload as Record<string, string>;
  switch (n.type) {
    case "TaskAssigned":
      return `You were assigned to "${p.taskTitle}"`;
    case "NewComment":
      return `New comment on "${p.taskTitle}"`;
    case "WorkspaceInvited":
      return `You were added to the workspace "${p.workspaceName}"`;
    case "ProjectArchived":
      return `Project "${p.projectName}" was archived`;
    default:
      return "Notification";
  }
}

function timeAgo(date: Date): string {
  return formatRelativeShort(date);
}

/**
 * Chuông thông báo ở header workspace layout: badge đếm chưa đọc + dropdown
 * danh sách notification, click để đánh dấu đọc rồi điều hướng. Real-time
 * (Mốc 14): subscribe SSE `notify`/`notifyRead` của workspace này và refresh
 * để refetch `getNotificationData` — badge/dropdown luôn khớp server.
 */
export function NotificationBell({
  workspaceId,
  notifications,
  unreadCount,
}: {
  workspaceId: string;
  notifications: NotificationRecord[];
  unreadCount: number;
}) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [dismissed, setDismissed] = useState(0);
  const [lastUnread, setLastUnread] = useState(unreadCount);

  useLiveEvents(workspaceId, (event) => {
    if (event.kind !== "notify" && event.kind !== "notifyRead") return;
    // Don't fire a refresh into an in-flight mutation POST — defer once
    // instead of dropping, so the badge still converges.
    if (isMutationBusy()) {
      setTimeout(() => {
        if (!isMutationBusy()) router.refresh();
      }, 1000);
      if (event.kind === "notifyRead") {
        setDismissed(unreadCount);
      }
      return;
    }
    if (event.kind === "notifyRead") {
      setDismissed(unreadCount);
    }
    router.refresh();
  });

  // Server refetch (navigation/revalidate) làm thay đổi unreadCount → reset delta
  // cục bộ để count luôn là "chưa đọc mới nhất". Dùng pattern "adjust state during
  // render" của React (setState trong render, không dùng effect).
  if (lastUnread !== unreadCount) {
    setLastUnread(unreadCount);
    setDismissed(0);
  }

  const count = Math.max(0, unreadCount - dismissed);

  async function openNotification(n: NotificationRecord) {
    if (!n.readAt) {
      setDismissed((d) => d + 1);
      await markNotificationReadAction(n.id);
    }
    setIsOpen(false);
    startNavigation();
    router.push(notificationHref(n));
  }

  async function markAll() {
    if (count === 0) return;
    setDismissed(unreadCount);
    await markAllNotificationsReadAction();
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-haspopup="menu"
        aria-expanded={isOpen}
aria-label={
          count > 0 ? `Notifications, ${count} unread` : "Notifications"
        }
        className="relative grid size-9 place-items-center rounded-md text-ink-soft transition-colors hover:bg-paper hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <BellIcon className="size-5" aria-hidden />
        {count > 0 ? (
          <span className="absolute right-0.5 top-0.5 grid min-w-4 place-items-center rounded-full bg-danger px-1 text-[9px] font-bold leading-4 text-white">
            {count > 9 ? "9+" : count}
          </span>
        ) : null}
      </button>

      {isOpen ? (
        <>
          <div aria-hidden className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-1.5 w-80 rounded-lg border border-rule bg-panel p-2 shadow-lg">
            <div className="flex items-center justify-between gap-2 border-b border-rule px-2 py-1.5">
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-faint">
                Notifications
              </p>
              {count > 0 ? (
                <button
                  type="button"
                  onClick={markAll}
                  className="text-xs font-medium text-primary transition-colors hover:text-primary-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  Mark all as read
                </button>
              ) : null}
            </div>
            {notifications.length === 0 ? (
              <p className="px-2 py-6 text-center text-xs text-ink-faint">No notifications.</p>
            ) : (
              <ul className="max-h-80 overflow-y-auto py-1">
                {notifications.map((n) => (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => openNotification(n)}
                      className={cn(
                        "flex w-full items-start gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors hover:bg-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                        n.readAt
                          ? "text-ink-soft"
                          : "bg-primary-soft/40 font-medium text-ink",
                      )}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block">{notificationLabel(n)}</span>
                        <span className="mt-0.5 block text-[11px] text-ink-faint">
                          {timeAgo(n.createdAt)}
                        </span>
                      </span>
                      {!n.readAt ? (
                        <span aria-hidden className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}