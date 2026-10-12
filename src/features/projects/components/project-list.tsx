"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useMemo, useState } from "react";

import { archiveProjectAction, restoreProjectAction } from "@/features/projects/actions";
import { canArchiveProject, canUpdateProject, type Role } from "@/features/authorization/permissions";
import type { ProjectRecord } from "@/features/projects/project-service";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  BoardsIcon,
  ChevronRightIcon,
  CloseIcon,
  SearchIcon,
  SettingsIcon,
} from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import { notifyError } from "@/lib/notify";

function ActionButton({
  workspaceId,
  projectId,
  action,
  children,
  variant,
  title,
}: {
  workspaceId: string;
  projectId: string;
  action: (workspaceId: string, projectId: string) => Promise<{ error?: string }>;
  children: React.ReactNode;
  variant: "secondary" | "danger";
  title?: string;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(async (_prev: { error?: string }) => {
    // Archive/restore redirect về /projects khi thành công — chỉ toast khi lỗi.
    const res = await action(workspaceId, projectId);
    if (res?.error) notifyError(res.error);
    router.refresh();
    return res;
  }, {});

  return (
    <form action={formAction} className="inline-block" onClick={(e) => e.stopPropagation()}>
      <Button
        type="submit"
        variant={variant}
        size="sm"
        disabled={pending}
        title={title}
        className="h-8 px-2.5 text-xs font-medium shadow-none hover:shadow-xs"
      >
        {children}
      </Button>
      {state.error ? (
        <p role="alert" className="mt-1 text-xs text-danger">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}

function ProjectCard({
  project,
  workspaceId,
  canArchive,
  canEdit,
  archived,
}: {
  project: ProjectRecord;
  workspaceId: string;
  canArchive: boolean;
  canEdit: boolean;
  archived: boolean;
}) {
  const projectInitial = project.name.trim().charAt(0).toUpperCase() || "P";

  return (
    <li className="group relative flex flex-col justify-between rounded-xl border border-rule bg-panel p-5 transition-all duration-200 hover:border-primary/40 hover:shadow-md">
      {/* Primary Click Area */}
      <Link
        href={`/workspaces/${workspaceId}/projects/${project.id}`}
        className="absolute inset-0 z-0 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        aria-label={`Open project ${project.name}`}
      />

      {/* Top Header Row */}
      <div>
        <div className="relative z-10 flex items-start justify-between gap-3 pointer-events-none">
          <div className="flex items-center gap-3 min-w-0">
            <span
              className={cn(
                "grid size-10 shrink-0 place-items-center rounded-lg text-sm font-semibold transition-colors shadow-xs",
                archived
                  ? "bg-panel-muted text-ink-faint border border-rule"
                  : "bg-primary-soft text-primary-ink group-hover:bg-primary group-hover:text-white",
              )}
            >
              {projectInitial}
            </span>
            <div className="min-w-0">
              <h3
                className={cn(
                  "truncate text-base font-semibold transition-colors",
                  archived
                    ? "text-ink-soft group-hover:text-ink"
                    : "text-ink group-hover:text-primary-ink",
                )}
              >
                {project.name}
              </h3>
              <div className="mt-0.5 flex items-center gap-2">
                <Badge tone={archived ? "neutral" : "info"} className="text-[11px] py-0 px-1.5">
                  {archived ? "Archived" : "Active"}
                </Badge>
              </div>
            </div>
          </div>

          {/* Action buttons (Top-Right) */}
          <div className="pointer-events-auto flex items-center gap-1.5 shrink-0">
            {canEdit && !archived ? (
              <Link
                href={`/workspaces/${workspaceId}/projects/${project.id}/settings`}
                title="Project settings"
                aria-label={`Settings for ${project.name}`}
                className="grid size-8 place-items-center rounded-md text-ink-faint transition-colors hover:bg-panel-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <SettingsIcon className="size-4" />
              </Link>
            ) : null}

            {archived ? (
              canArchive ? (
                <ActionButton
                  workspaceId={workspaceId}
                  projectId={project.id}
                  action={restoreProjectAction}
                  variant="secondary"
                  title="Restore project to active state"
                >
                  Restore
                </ActionButton>
              ) : null
            ) : canArchive ? (
              <ActionButton
                workspaceId={workspaceId}
                projectId={project.id}
                action={archiveProjectAction}
                variant="secondary"
                title="Archive project"
              >
                Archive
              </ActionButton>
            ) : null}
          </div>
        </div>

        {/* Project Description */}
        <p className="relative z-10 mt-3.5 line-clamp-2 text-sm text-ink-soft pointer-events-none min-h-[2.5rem]">
          {project.description || "No description provided."}
        </p>
      </div>

      {/* Footer Meta Row */}
      <div className="relative z-10 mt-5 flex items-center justify-between border-t border-rule/70 pt-3 text-xs text-ink-faint pointer-events-none">
        <span className="inline-flex items-center gap-1.5 font-medium text-primary-ink group-hover:underline">
          <BoardsIcon className="size-3.5 text-primary-ink" />
          Kanban Board
        </span>
        <span className="inline-flex items-center gap-1 text-ink-faint group-hover:text-primary-ink transition-colors font-medium">
          <span>Open</span>
          <ChevronRightIcon className="size-3.5 transition-transform group-hover:translate-x-0.5" />
        </span>
      </div>
    </li>
  );
}

export function ProjectList({
  active,
  archived,
  workspaceId,
  actorRole,
}: {
  active: ProjectRecord[];
  archived: ProjectRecord[];
  workspaceId: string;
  actorRole: Role;
}) {
  const canArchive = canArchiveProject(actorRole);
  const canEdit = canUpdateProject(actorRole);

  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "active" | "archived">("all");

  const filteredActive = useMemo(() => {
    if (!searchQuery.trim()) return active;
    const q = searchQuery.toLowerCase();
    return active.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.description && p.description.toLowerCase().includes(q)),
    );
  }, [active, searchQuery]);

  const filteredArchived = useMemo(() => {
    if (!searchQuery.trim()) return archived;
    const q = searchQuery.toLowerCase();
    return archived.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.description && p.description.toLowerCase().includes(q)),
    );
  }, [archived, searchQuery]);

  const totalCount = active.length + archived.length;

  return (
    <div className="space-y-6">
      {/* Search and Tabs Toolbar */}
      {totalCount > 0 ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 max-w-md">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-faint" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search projects by name or description..."
              className="w-full rounded-lg border border-rule bg-panel pl-9 pr-8 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs"
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-faint hover:text-ink"
                aria-label="Clear search"
              >
                <CloseIcon className="size-4" />
              </button>
            ) : null}
          </div>

          {/* Filter Tabs */}
          {archived.length > 0 ? (
            <div className="flex items-center gap-1 rounded-lg border border-rule bg-panel p-1 self-start sm:self-auto shadow-2xs">
              <button
                type="button"
                onClick={() => setActiveTab("all")}
                className={cn(
                  "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                  activeTab === "all"
                    ? "bg-primary text-white"
                    : "text-ink-soft hover:text-ink hover:bg-panel-muted",
                )}
              >
                All ({totalCount})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("active")}
                className={cn(
                  "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                  activeTab === "active"
                    ? "bg-primary text-white"
                    : "text-ink-soft hover:text-ink hover:bg-panel-muted",
                )}
              >
                Active ({active.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("archived")}
                className={cn(
                  "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                  activeTab === "archived"
                    ? "bg-primary text-white"
                    : "text-ink-soft hover:text-ink hover:bg-panel-muted",
                )}
              >
                Archived ({archived.length})
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Active Projects Section */}
      {activeTab !== "archived" ? (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold tracking-tight text-ink flex items-center gap-2">
              <span>Active projects</span>
              <span className="inline-flex size-5 items-center justify-center rounded-full bg-panel-muted text-xs font-semibold text-ink-soft border border-rule">
                {filteredActive.length}
              </span>
            </h2>
          </div>

          {filteredActive.length === 0 ? (
            searchQuery ? (
              <div className="rounded-xl border border-dashed border-rule-strong bg-panel/60 p-8 text-center">
                <SearchIcon className="mx-auto size-6 text-ink-faint" />
                <p className="mt-2 text-sm font-medium text-ink">No active projects found</p>
                <p className="mt-1 text-xs text-ink-soft">
                  No active projects matched &ldquo;{searchQuery}&rdquo;.
                </p>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setSearchQuery("")}
                  className="mt-3 text-xs"
                >
                  Clear search
                </Button>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-rule-strong bg-panel/60 p-10 text-center">
                <BoardsIcon className="mx-auto size-8 text-ink-faint" />
                <p className="mt-3 text-base font-semibold text-ink">No projects yet</p>
                <p className="mt-1 text-sm text-ink-soft max-w-sm mx-auto">
                  Create your first project to organize tasks and visualize work on a Kanban board.
                </p>
              </div>
            )
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredActive.map((p) => (
                <ProjectCard
                  key={p.id}
                  project={p}
                  workspaceId={workspaceId}
                  canArchive={canArchive}
                  canEdit={canEdit}
                  archived={false}
                />
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {/* Archived Projects Section */}
      {activeTab !== "active" && (archived.length > 0 || searchQuery) ? (
        <section className="space-y-3 pt-4">
          <div className="flex items-center justify-between border-t border-rule/80 pt-6">
            <h2 className="text-sm font-semibold tracking-tight text-ink-soft flex items-center gap-2">
              <span>Archived</span>
              <span className="inline-flex size-5 items-center justify-center rounded-full bg-panel-muted text-xs font-semibold text-ink-faint border border-rule">
                {filteredArchived.length}
              </span>
            </h2>
          </div>

          {filteredArchived.length === 0 ? (
            searchQuery ? (
              <p className="text-xs text-ink-faint italic py-2">
                No archived projects match &ldquo;{searchQuery}&rdquo;.
              </p>
            ) : null
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredArchived.map((p) => (
                <ProjectCard
                  key={p.id}
                  project={p}
                  workspaceId={workspaceId}
                  canArchive={canArchive}
                  canEdit={canEdit}
                  archived
                />
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </div>
  );
}