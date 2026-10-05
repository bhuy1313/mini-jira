import Link from "next/link";
import { redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button";
import {
  BoardsIcon,
  ChevronRightIcon,
  PlusIcon,
  SettingsIcon,
  UsersIcon,
} from "@/components/ui/icons";
import { createProjectService } from "@/features/projects/project-service";
import { prismaProjectRepository } from "@/features/projects/prisma-project-repository";
import { getWorkspaceContext, getWorkspaceMembers } from "@/features/workspaces/queries";
import { requireActor } from "@/features/workspaces/session";
import { WorkspaceAvatar } from "@/features/workspaces/components/workspace-avatar";
import { cn } from "@/lib/cn";

const projectService = createProjectService({ repo: prismaProjectRepository });

export default async function WorkspaceHomePage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  const actor = await requireActor(workspaceId).catch(() => null);
  if (!actor) redirect("/workspaces");

  const [ctx, activeProjects] = await Promise.all([
    getWorkspaceContext(workspaceId),
    projectService.listProjects(actor),
  ]);
  const { ws } = ctx;
  const members = await getWorkspaceMembers(workspaceId);

  return (
    <div className="space-y-6">
      {/* Standardized Header Identity & CTA */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-rule pb-5">
        <div className="flex items-center gap-3.5">
          <WorkspaceAvatar
            name={ws.name}
            icon={ws.icon}
            size="lg"
          />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-ink">
              {ws.name}
            </h1>
            <p className="mt-1 text-sm text-ink-soft">
              {ws.description || "Manage your workspace projects and team members."}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2.5">
          <Link
            href={`/workspaces/${workspaceId}/settings`}
            className={buttonStyles({ variant: "secondary", size: "sm" })}
          >
            <SettingsIcon className="size-3.5" />
            <span>Settings</span>
          </Link>
          <Link
            href={`/workspaces/${workspaceId}/projects`}
            className={buttonStyles({ size: "sm" })}
          >
            <PlusIcon className="size-3.5" />
            <span>New project</span>
          </Link>
        </div>
      </div>

      {/* Primary Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href={`/workspaces/${workspaceId}/members`}
          className="group block rounded-xl border border-rule bg-panel p-5 shadow-2xs transition-all hover:border-primary/50 hover:shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-soft">
                Members
              </p>
              <p className="mt-2 text-3xl font-bold tracking-tight text-ink">
                {members.length}
              </p>
              <p className="mt-1 text-xs text-ink-faint">
                Registered collaborators
              </p>
            </div>
            <span className="grid size-12 place-items-center rounded-xl bg-primary-soft text-primary-ink transition-colors group-hover:bg-primary group-hover:text-white shadow-2xs border border-primary/20">
              <UsersIcon className="size-6" />
            </span>
          </div>
        </Link>

        <Link
          href={`/workspaces/${workspaceId}/projects`}
          className="group block rounded-xl border border-rule bg-panel p-5 shadow-2xs transition-all hover:border-primary/50 hover:shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-soft">
                Active Projects
              </p>
              <p className="mt-2 text-3xl font-bold tracking-tight text-ink">
                {activeProjects.length}
              </p>
              <p className="mt-1 text-xs text-ink-faint">
                Live Kanban boards
              </p>
            </div>
            <span className="grid size-12 place-items-center rounded-xl bg-primary-soft text-primary-ink transition-colors group-hover:bg-primary group-hover:text-white shadow-2xs border border-primary/20">
              <BoardsIcon className="size-6" />
            </span>
          </div>
        </Link>
      </div>

      {/* Recent Projects Section */}
      <section className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold tracking-tight text-ink">
              Recent Projects
            </h2>
            <p className="text-xs text-ink-soft">
              Jump directly into your active project boards
            </p>
          </div>
          <Link
            href={`/workspaces/${workspaceId}/projects`}
            className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline focus-visible:outline-none"
          >
            <span>View all projects</span>
            <ChevronRightIcon className="size-3.5" />
          </Link>
        </div>

        {activeProjects.length === 0 ? (
          <div className="rounded-xl border border-dashed border-rule-strong bg-panel/60 p-10 text-center">
            <BoardsIcon className="mx-auto size-8 text-ink-faint" />
            <p className="mt-3 text-sm font-semibold text-ink">No projects yet</p>
            <p className="mt-1 text-xs text-ink-soft">
              Create your first project to start tracking tasks on Kanban.
            </p>
            <Link
              href={`/workspaces/${workspaceId}/projects`}
              className={`${buttonStyles({ variant: "secondary", size: "sm" })} mt-4`}
            >
              <PlusIcon className="size-3.5" />
              <span>Create project</span>
            </Link>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {activeProjects.slice(0, 6).map((project) => (
              <Link
                key={project.id}
                href={`/workspaces/${workspaceId}/projects/${project.id}`}
                className="group flex flex-col justify-between rounded-xl border border-rule bg-panel p-4.5 shadow-2xs transition-all hover:border-primary/50 hover:shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary-soft text-sm font-bold text-primary-ink shadow-2xs border border-primary/20">
                        {project.name.charAt(0).toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-semibold text-ink group-hover:text-primary transition-colors">
                          {project.name}
                        </h3>
                        <Badge
                          tone={project.archivedAt ? "neutral" : "info"}
                          className="mt-0.5 text-[10px] py-0"
                        >
                          {project.archivedAt ? "Archived" : "Active"}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <p className="mt-2.5 line-clamp-2 text-xs text-ink-soft min-h-[2rem]">
                    {project.description || "No description provided."}
                  </p>
                </div>

                <div className="mt-3.5 flex items-center justify-between border-t border-rule/60 pt-2.5 text-xs text-ink-faint">
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-primary group-hover:underline">
                    <BoardsIcon className="size-3.5" />
                    Kanban Board
                  </span>
                  <ChevronRightIcon className="size-3.5 text-ink-faint transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}