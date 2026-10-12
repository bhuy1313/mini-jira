import Link from "next/link";
import type { Metadata } from "next";
import { z } from "zod";

import { Badge } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button";
import { ArrowLeftIcon } from "@/components/ui/icons";
import { canManageLabels, canUpdateProject, PRIORITIES } from "@/features/authorization/permissions";
import { LabelManager } from "@/features/labels/components/label-manager";
import { getProjectDetail } from "@/features/projects/queries";
import { KanbanBoard } from "@/features/tasks/components/kanban-board";
import { isAttachmentsEnabled } from "@/features/attachments/attachment-storage";
import { getProjectBoard } from "@/features/tasks/queries";
import type { TaskFilterInput } from "@/features/tasks/task-service";

export const metadata: Metadata = { title: "Project board" };

const searchParamsSchema = z.object({
  q: z.string().trim().optional(),
  status: z.string().trim().optional(),
  priority: z.enum(PRIORITIES).optional(),
  assignee: z.string().trim().optional(),
  label: z.string().trim().optional(),
  sprint: z.string().trim().optional(),
});

export const dynamic = "force-dynamic";

export default async function ProjectDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceId: string; projectId: string }>;
  searchParams?: Promise<{
    q?: string;
    status?: string;
    priority?: string;
    assignee?: string;
    label?: string;
    sprint?: string;
  }>;
}) {
  const { workspaceId, projectId } = await params;
  const rawQuery = (await searchParams) ?? {};
  const parsed = searchParamsSchema.safeParse(rawQuery);
  const filter: TaskFilterInput = parsed.success
    ? {
        query: parsed.data.q || undefined,
        statusId: parsed.data.status || undefined,
        priority: parsed.data.priority,
        assigneeId: parsed.data.assignee === "unassigned" ? "unassigned" : parsed.data.assignee || undefined,
        labelId: parsed.data.label || undefined,
        sprintId: parsed.data.sprint || undefined,
      }
    : {};

  const activeSprint = parsed.success
    ? (parsed.data.sprint as string | "backlog" | undefined) ?? null
    : null;

  const [{ actor, project }, board] = await Promise.all([
    getProjectDetail(workspaceId, projectId),
    getProjectBoard(workspaceId, projectId, filter),
  ]);

  return (
    <div className="space-y-6">
      <div className="border-b border-rule pb-5">
        <Link
          href={`/workspaces/${workspaceId}/projects`}
          className="inline-flex items-center gap-1 text-xs text-ink-faint hover:text-ink"
        >
          <ArrowLeftIcon className="size-3.5" />
          Projects
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {project.name}
            </h1>
            <p className="mt-1 text-sm text-ink-soft">
              {project.description || "No description."}
            </p>
            <div className="mt-2">
              {project.archivedAt ? (
                <Badge tone="neutral" dot>
                  Archived
                </Badge>
              ) : (
                <Badge tone="done" dot>
                  Active
                </Badge>
              )}
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            {canUpdateProject(actor.projectRole) ? (
              <Link
                href={`/workspaces/${workspaceId}/projects/${projectId}/settings`}
                className={buttonStyles({ variant: "secondary", size: "sm" })}
              >
                Settings
              </Link>
            ) : null}
          </div>
        </div>
      </div>

      {!project.archivedAt ? (
        <>
          {canManageLabels(actor.projectRole) ? (
            <LabelManager
              workspaceId={workspaceId}
              projectId={projectId}
              labels={board.projectLabels}
            />
          ) : null}
          <KanbanBoard
            tasks={board.tasks}
            tasksTruncated={board.tasksTruncated}
            attachmentsEnabled={isAttachmentsEnabled()}
            statuses={board.statuses}
            sprints={board.sprints}
            sprintTotals={board.sprintTotals}
            sprintDoneTotals={board.sprintDoneTotals}
            activeSprintId={activeSprint}
            members={board.members}
            workspaceId={workspaceId}
            projectId={projectId}
            commentsByTask={board.commentsByTask}
            activitiesByTask={board.activitiesByTask}
            attachmentsByTask={board.attachmentsByTask}
            labelsByTask={board.labelsByTask}
            projectLabels={board.projectLabels}
            customFields={board.customFields}
            customFieldValuesByTask={board.customFieldValuesByTask}
            worklogsByTask={board.worklogsByTask}
            activeFilters={board.activeFilters}
            actorRole={actor.projectRole}
            actorUserId={actor.userId}
          />
        </>
      ) : (
        <p className="text-sm text-ink-soft">
          This project is archived. Task management is read-only.
        </p>
      )}
    </div>
  );
}