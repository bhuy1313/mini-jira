"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import {
  BoardsIcon,
  CheckIcon,
  ChevronsUpDownIcon,
  ChevronRightIcon,
  CloseIcon,
  PlusIcon,
  SearchIcon,
} from "@/components/ui/icons";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { CreateWorkspaceModal } from "@/features/workspaces/components/create-workspace-modal";
import { WorkspaceAvatar } from "@/features/workspaces/components/workspace-avatar";
import type { WorkspaceRecord } from "@/features/workspaces/workspace-service";

export function WorkspaceSwitcher({
  workspaces,
  currentWorkspaceId,
  variant = "block",
}: {
  workspaces: WorkspaceRecord[];
  currentWorkspaceId?: string;
  variant?: "block" | "dropdown";
}) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const currentWs = workspaces.find((w) => w.id === currentWorkspaceId);

  const filteredWorkspaces = useMemo(() => {
    if (!searchQuery.trim()) return workspaces;
    const q = searchQuery.toLowerCase();
    return workspaces.filter(
      (w) =>
        w.name.toLowerCase().includes(q) ||
        (w.description && w.description.toLowerCase().includes(q)),
    );
  }, [workspaces, searchQuery]);

  if (variant === "dropdown") {
    return (
      <>
        <div className="relative w-full">
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            aria-haspopup="menu"
            aria-expanded={isOpen}
            aria-label="Switch workspace"
            className="flex w-full items-center justify-between gap-2.5 rounded-xl border border-rule/80 bg-panel px-3 py-2 text-left transition-all hover:border-primary/40 hover:bg-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary shadow-2xs"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <WorkspaceAvatar
                name={currentWs?.name || "W"}
                icon={currentWs?.icon}
                size="sm"
              />
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-ink leading-tight">
                  {currentWs?.name || "Select Workspace"}
                </p>
                <p className="text-[10px] text-ink-faint leading-tight mt-0.5">
                  Workspace
                </p>
              </div>
            </div>
            <ChevronsUpDownIcon className="size-4 shrink-0 text-ink-faint" />
          </button>

          {isOpen ? (
            <>
              <div
                aria-hidden
                className="fixed inset-0 z-40"
                onClick={() => {
                  setIsOpen(false);
                  setSearchQuery("");
                }}
              />
              <div className="absolute left-0 right-0 top-full z-50 mt-1.5 w-full min-w-[240px] rounded-xl border border-rule bg-panel p-2 shadow-xl">
                <div className="px-2 py-1 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-ink-faint">
                  <span>Workspaces</span>
                  <span>{workspaces.length}</span>
                </div>

                {workspaces.length > 3 ? (
                  <div className="relative my-1.5 px-1">
                    <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-ink-faint" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Filter workspaces…"
                      className="h-7 w-full rounded-md border border-rule bg-paper pl-7 pr-6 text-xs text-ink placeholder:text-ink-faint focus:border-primary focus:outline-none"
                    />
                    {searchQuery ? (
                      <button
                        type="button"
                        onClick={() => setSearchQuery("")}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-faint hover:text-ink"
                      >
                        <CloseIcon className="size-3" />
                      </button>
                    ) : null}
                  </div>
                ) : null}

                <ul className="mt-1 max-h-56 space-y-0.5 overflow-y-auto px-0.5">
                  {filteredWorkspaces.map((ws) => {
                    const isCurrent = ws.id === currentWorkspaceId;
                    return (
                      <li key={ws.id}>
                        <Link
                          href={`/workspaces/${ws.id}`}
                          onClick={() => {
                            setIsOpen(false);
                            setSearchQuery("");
                          }}
                          className={cn(
                            "flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                            isCurrent
                              ? "bg-primary-soft text-primary-ink font-semibold"
                              : "text-ink-soft hover:bg-paper hover:text-ink",
                          )}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <WorkspaceAvatar
                              name={ws.name}
                              icon={ws.icon}
                              size="xs"
                            />
                            <span className="truncate">{ws.name}</span>
                          </div>
                          {isCurrent ? (
                            <CheckIcon className="size-3.5 shrink-0 text-primary-ink" />
                          ) : null}
                        </Link>
                      </li>
                    );
                  })}
                </ul>

                <div className="mt-2 border-t border-rule/70 pt-1.5 px-0.5 space-y-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      setIsOpen(false);
                      setSearchQuery("");
                      setIsModalOpen(true);
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium text-primary hover:bg-primary-soft/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-colors"
                  >
                    <PlusIcon className="size-3.5" />
                    <span>New workspace</span>
                  </button>
                  <Link
                    href="/workspaces"
                    onClick={() => {
                      setIsOpen(false);
                      setSearchQuery("");
                    }}
                    className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-medium text-ink-soft hover:bg-paper hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-colors"
                  >
                    <span>All workspaces</span>
                    <ChevronRightIcon className="size-3 text-ink-faint" />
                  </Link>
                </div>
              </div>
            </>
          ) : null}
        </div>

        <CreateWorkspaceModal
          open={isModalOpen}
          onClose={() => setIsModalOpen(false)}
        />
      </>
    );
  }

  return (
    <div className="space-y-4">
      {/* Top action bar: Title / Search / Create button */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-soft">
            Your Workspaces
          </h2>
          <span className="inline-flex size-5 items-center justify-center rounded-full bg-panel-muted text-xs font-semibold text-ink-soft border border-rule">
            {workspaces.length}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {workspaces.length > 2 ? (
            <div className="relative flex-1 sm:w-56">
              <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-faint" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search workspaces…"
                className="h-8 w-full rounded-lg border border-rule bg-panel pl-8 pr-7 text-xs text-ink placeholder:text-ink-faint focus:border-primary focus:outline-none shadow-2xs"
              />
              {searchQuery ? (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-faint hover:text-ink"
                >
                  <CloseIcon className="size-3.5" />
                </button>
              ) : null}
            </div>
          ) : null}

          {workspaces.length > 0 ? (
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => setIsModalOpen(true)}
              className="h-8 px-3 text-xs shrink-0"
            >
              <PlusIcon className="size-3.5" />
              New workspace
            </Button>
          ) : null}
        </div>
      </div>

      {/* Workspaces Grid */}
      {workspaces.length === 0 ? (
        <div className="rounded-xl border border-dashed border-rule-strong bg-panel/60 p-8 text-center">
          <BoardsIcon className="mx-auto size-8 text-ink-faint" />
          <p className="mt-2 text-sm font-medium text-ink">You are not part of any workspace yet.</p>
          <p className="mt-1 text-xs text-ink-soft">
            Create your first workspace to start organizing your projects.
          </p>
          <Button
            type="button"
            size="sm"
            onClick={() => setIsModalOpen(true)}
            className="mt-4 text-xs"
          >
            <PlusIcon className="size-3.5" />
            New workspace
          </Button>
        </div>
      ) : filteredWorkspaces.length === 0 ? (
        <div className="rounded-xl border border-dashed border-rule-strong bg-panel/60 p-6 text-center">
          <SearchIcon className="mx-auto size-6 text-ink-faint" />
          <p className="mt-2 text-sm font-medium text-ink">No workspaces match &ldquo;{searchQuery}&rdquo;</p>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setSearchQuery("")}
            className="mt-3 text-xs"
          >
            Clear search
          </Button>
        </div>
      ) : (
        <ul className="grid gap-3.5 sm:grid-cols-2">
          {filteredWorkspaces.map((ws) => {
            const isCurrent = ws.id === currentWorkspaceId;

            return (
              <li key={ws.id}>
                <Link
                  href={`/workspaces/${ws.id}`}
                  className={cn(
                    "group relative flex flex-col justify-between rounded-xl border bg-panel p-5 transition-all duration-200 hover:border-primary/50 hover:shadow-md h-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                    isCurrent ? "border-primary/60 shadow-xs" : "border-rule",
                  )}
                >
                  <div>
                    <div className="flex items-start gap-3.5">
                      <WorkspaceAvatar
                        name={ws.name}
                        icon={ws.icon}
                        size="lg"
                        className="group-hover:scale-105"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="truncate text-base font-semibold text-ink group-hover:text-primary-ink transition-colors">
                            {ws.name}
                          </h3>
                        </div>
                        <p className="mt-1 line-clamp-2 text-xs text-ink-soft min-h-[2rem]">
                          {ws.description || "Workspace for your team projects and tasks."}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-rule/60 pt-3 text-xs text-ink-faint">
                    <span className="inline-flex items-center gap-1.5 font-medium text-primary-ink group-hover:underline">
                      <BoardsIcon className="size-3.5" />
                      Projects & Board
                    </span>
                    <span className="inline-flex items-center gap-1 text-ink-faint group-hover:text-primary-ink transition-colors font-medium">
                      <span>Open</span>
                      <ChevronRightIcon className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <CreateWorkspaceModal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
}