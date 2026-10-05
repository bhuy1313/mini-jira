"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { CheckIcon, LaptopIcon, TrashIcon } from "@/components/ui/icons";
import type { UserSession } from "@/features/account/account-repository";
import {
  revokeOtherSessionsAction,
  revokeSessionAction,
} from "@/features/account/actions";
import { cn } from "@/lib/cn";

function parseUserAgent(ua: string | null): string {
  if (!ua) return "Unknown Device / Browser";

  let browser = "Browser";
  if (ua.includes("Firefox/")) browser = "Firefox";
  else if (ua.includes("Edg/")) browser = "Microsoft Edge";
  else if (ua.includes("Chrome/")) browser = "Chrome";
  else if (ua.includes("Safari/")) browser = "Safari";

  let os = "Desktop";
  if (ua.includes("Windows NT 10.0") || ua.includes("Windows")) os = "Windows";
  else if (ua.includes("Mac OS X")) os = "macOS";
  else if (ua.includes("Linux")) os = "Linux";
  else if (ua.includes("Android")) os = "Android";
  else if (ua.includes("iPhone") || ua.includes("iPad")) os = "iOS";

  return `${browser} on ${os}`;
}

export function SessionsList({ sessions }: { sessions: UserSession[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const otherSessions = sessions.filter((s) => !s.isCurrent);

  const handleRevokeSingle = (sessionId: string) => {
    if (!confirm("Are you sure you want to sign out this session?")) return;

    setError(null);
    setSuccess(null);

    startTransition(async () => {
      const res = await revokeSessionAction(sessionId);
      if (!res.success) {
        setError(res.error || "Failed to revoke session");
      } else {
        setSuccess("Session revoked successfully.");
        router.refresh();
      }
    });
  };

  const handleRevokeAllOthers = () => {
    if (
      !confirm(
        "Are you sure you want to sign out of all other devices? All other active sessions will be terminated.",
      )
    ) {
      return;
    }

    setError(null);
    setSuccess(null);

    startTransition(async () => {
      const res = await revokeOtherSessionsAction();
      if (!res.success) {
        setError(res.error || "Failed to revoke other sessions");
      } else {
        setSuccess(`Successfully signed out of ${res.revokedCount} other session(s).`);
        router.refresh();
      }
    });
  };

  return (
    <div className="rounded-lg border border-rule bg-panel p-6 shadow-xs">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-rule pb-4">
        <div>
          <h2 className="text-base font-semibold text-ink">Active Sessions</h2>
          <p className="mt-1 text-xs text-ink-soft">
            These are the devices and browsers that are currently logged into your account.
          </p>
        </div>

        {otherSessions.length > 0 && (
          <button
            type="button"
            disabled={isPending}
            onClick={handleRevokeAllOthers}
            className="inline-flex items-center gap-1.5 self-start rounded-md border border-rose-300 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700 transition-colors hover:bg-rose-100 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300 disabled:opacity-50"
          >
            <TrashIcon className="size-3.5" />
            <span>Sign out other devices ({otherSessions.length})</span>
          </button>
        )}
      </div>

      <div className="mt-6 space-y-4">
        {error && (
          <div
            role="alert"
            className="rounded-md border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300"
          >
            {error}
          </div>
        )}

        {success && (
          <div
            role="status"
            className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300"
          >
            <CheckIcon className="size-4 shrink-0 text-emerald-600" />
            <span>{success}</span>
          </div>
        )}

        <div className="grid gap-3.5 sm:grid-cols-2">
          {sessions.map((session) => {
            const formattedDate = new Intl.DateTimeFormat("en-US", {
              dateStyle: "medium",
              timeStyle: "short",
            }).format(new Date(session.createdAt));

            const deviceDescription = parseUserAgent(session.userAgent);

            return (
              <div
                key={session.id}
                className={cn(
                  "flex flex-col justify-between rounded-xl border p-4.5 transition-all duration-150",
                  session.isCurrent
                    ? "border-emerald-500/40 bg-emerald-500/5 shadow-xs"
                    : "border-rule bg-paper hover:border-rule-strong hover:shadow-xs",
                )}
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className={cn(
                          "grid size-10 shrink-0 place-items-center rounded-xl text-sm font-semibold shadow-2xs border",
                          session.isCurrent
                            ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                            : "bg-panel-muted text-ink-soft border-rule",
                        )}
                      >
                        <LaptopIcon className="size-5" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-ink">
                          {deviceDescription}
                        </p>
                        <p className="text-[11px] font-mono text-ink-faint mt-0.5">
                          IP: {session.ipAddress || "127.0.0.1"}
                        </p>
                      </div>
                    </div>

                    {session.isCurrent ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 shrink-0">
                        <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Current device
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-rule/60 pt-3 text-[11px] text-ink-faint">
                  <span>Active since: {formattedDate}</span>

                  {!session.isCurrent ? (
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => handleRevokeSingle(session.id)}
                      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-rose-600 transition-colors hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-950/30 disabled:opacity-50"
                    >
                      <TrashIcon className="size-3.5" />
                      <span>Revoke</span>
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
