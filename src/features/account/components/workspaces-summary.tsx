"use client";

import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ChevronRightIcon, PlusIcon } from "@/components/ui/icons";
import type { UserWorkspaceOverview } from "@/features/account/account-repository";
import { CreateWorkspaceModal } from "@/features/workspaces/components/create-workspace-modal";
import { WorkspaceAvatar } from "@/features/workspaces/components/workspace-avatar";
import { cn } from "@/lib/cn";

const roleColors: Record<string, string> = {
  Owner: "bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300",
  Admin: "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300",
  Member: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300",
};

export function WorkspacesSummary({
  workspaces,
}: {
  workspaces: UserWorkspaceOverview[];
}) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  return (
    <>
      <div className="rounded-lg border border-rule bg-panel p-6 shadow-xs">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-rule pb-4">
          <div>
            <h2 className="text-base font-semibold text-ink">My Workspaces</h2>
            <p className="mt-1 text-xs text-ink-soft">
              All workspaces where you are currently a registered member or owner.
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            onClick={() => setIsCreateOpen(true)}
            className="h-8 px-3 text-xs shrink-0 self-start sm:self-auto"
          >
            <PlusIcon className="size-3.5" />
            <span>New workspace</span>
          </Button>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {workspaces.map((ws) => {
            const joinedFormatted = new Intl.DateTimeFormat("en-US", {
              month: "short",
              year: "numeric",
            }).format(new Date(ws.joinedAt));

            return (
              <Link
                key={ws.workspaceId}
                href={`/workspaces/${ws.workspaceId}`}
                className="group flex flex-col justify-between rounded-xl border border-rule bg-paper p-4.5 transition-all hover:border-primary/50 hover:shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <WorkspaceAvatar
                        name={ws.workspaceName}
                        icon={ws.workspaceIcon}
                        size="md"
                      />
                      <div>
                        <h3 className="text-sm font-semibold text-ink group-hover:text-primary transition-colors">
                          {ws.workspaceName}
                        </h3>
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium",
                            roleColors[ws.role] || roleColors.Member,
                          )}
                        >
                          {ws.role}
                        </span>
                      </div>
                    </div>
                    <ChevronRightIcon className="size-4 text-ink-faint transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                  </div>

                  {ws.workspaceDescription && (
                    <p className="mt-2 line-clamp-2 text-xs text-ink-soft">
                      {ws.workspaceDescription}
                    </p>
                  )}
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-rule/60 pt-3 text-[11px] text-ink-faint">
                  <span>{ws.projectCount} active project(s)</span>
                  <span>Joined {joinedFormatted}</span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      <CreateWorkspaceModal
        open={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
      />
    </>
  );
}
