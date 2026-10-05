import { redirect } from "next/navigation";

import type { Actor } from "@/features/authorization/actor";
import type { ProjectActor } from "@/features/authorization/actor";
import { prismaActivityRepository } from "@/features/activities/prisma-activity-repository";
import type { ActivityRecord } from "@/features/activities/activity-service";
import { prismaAttachmentRepository } from "@/features/attachments/prisma-attachment-repository";
import type { AttachmentRecord } from "@/features/attachments/attachment-service";
import { prismaCommentRepository } from "@/features/comments/prisma-comment-repository";
import type { CommentRecord } from "@/features/comments/comment-service";
import { prismaLabelRepository } from "@/features/labels/prisma-label-repository";
import type { LabelRecord } from "@/features/labels/label-service";
import { prismaProjectRepository } from "@/features/projects/prisma-project-repository";
import { createProjectService } from "@/features/projects/project-service";
import { prismaStatusRepository } from "@/features/statuses/prisma-status-repository";
import type { StatusRecord } from "@/features/statuses/status-service";
import { prismaSprintRepository } from "@/features/sprints/prisma-sprint-repository";
import type { SprintRecord } from "@/features/sprints/sprint-service";
import { prismaCustomFieldRepository } from "@/features/custom-fields/prisma-custom-field-repository";
import type {
  CustomFieldRecord,
  TaskCustomFieldValueRecord,
} from "@/features/custom-fields/custom-field-service";
import { prismaWorklogRepository } from "@/features/worklogs/prisma-worklog-repository";
import type { WorklogRecord } from "@/features/worklogs/worklog-service";
import { prismaTaskRepository } from "@/features/tasks/prisma-task-repository";
import {
  createTaskService,
  type TaskFilterInput,
  type TaskRecord,
} from "@/features/tasks/task-service";
import { prismaWorkspaceRepository } from "@/features/workspaces/prisma-workspace-repository";
import { createWorkspaceService, type MemberWithUser } from "@/features/workspaces/workspace-service";
import { requireActor } from "@/features/workspaces/session";
import { requireProjectActor } from "@/features/workspaces/session";

const taskService = createTaskService({ repo: prismaTaskRepository });
const projectService = createProjectService({ repo: prismaProjectRepository });
const workspaceService = createWorkspaceService({ repo: prismaWorkspaceRepository });

export interface ProjectBoardData {
  actor: ProjectActor;
  projectId: string;
  statuses: StatusRecord[];
  sprints: SprintRecord[];
  sprintTotals: Record<string, number>;
  sprintDoneTotals: Record<string, number>;
  tasks: TaskRecord[];
  members: MemberWithUser[];
  commentsByTask: Record<string, CommentRecord[]>;
  activitiesByTask: Record<string, ActivityRecord[]>;
  attachmentsByTask: Record<string, AttachmentRecord[]>;
  labelsByTask: Record<string, LabelRecord[]>;
  projectLabels: LabelRecord[];
  customFields: CustomFieldRecord[];
  customFieldValuesByTask: Record<string, TaskCustomFieldValueRecord[]>;
  worklogsByTask: Record<string, WorklogRecord[]>;
  activeFilters: TaskFilterInput;
}


/** Board dữ liệu cho Kanban; redirect nếu không thuộc workspace hoặc project không tồn tại. */
export async function getProjectBoard(
  workspaceId: string,
  projectId: string,
  filter?: TaskFilterInput,
): Promise<ProjectBoardData> {
  const actor = await requireProjectActor(workspaceId, projectId).catch(() => null);
  if (!actor) redirect("/workspaces");

  const project = await projectService.getProject(actor, projectId).catch(() => null);
  if (!project) redirect(`/workspaces/${workspaceId}/projects`);

  const [rawTasks, members, statuses, sprints, sprintTotals, sprintDoneTotals, customFields] =
  await Promise.all([
    taskService.listBoard(actor, projectId, filter),
    workspaceService.listMembers(actor),
    prismaStatusRepository.listStatusesByProject(projectId),
    prismaSprintRepository.listSprintsByProject(projectId),
    prismaSprintRepository.countTasksBySprint(projectId),
    prismaSprintRepository.countDoneTasksBySprint(projectId),
    prismaCustomFieldRepository.listFieldsByProject(projectId),
  ]);

  const statusIndexMap = new Map(statuses.map((s, idx) => [s.id, idx]));

  const tasks = rawTasks
    .filter((t) => t.workspaceId === actor.workspaceId)
    .sort((a, b) => {
      const idxA = statusIndexMap.get(a.statusId) ?? 999;
      const idxB = statusIndexMap.get(b.statusId) ?? 999;
      return idxA - idxB || a.position - b.position;
    });

  const taskIds = tasks.map((t) => t.id);

  const [allComments, allActivities, allAttachments, allTaskLabels, projectLabels, allCustomValues, worklogsByTask] = await Promise.all([
    prismaCommentRepository.listCommentsByTaskIds(taskIds),
    prismaActivityRepository.listActivitiesByTaskIds(taskIds),
    prismaAttachmentRepository.listAttachmentsByTaskIds(taskIds),
    prismaLabelRepository.listLabelsByTaskIds(taskIds),
    prismaLabelRepository.listLabelsByProject(projectId),
    prismaCustomFieldRepository.listValuesByTaskIds(taskIds),
    prismaWorklogRepository.listWorklogsByTaskIds(taskIds),
  ]);

  const commentsByTask: Record<string, CommentRecord[]> = {};
  for (const c of allComments) {
    (commentsByTask[c.taskId] ??= []).push(c);
  }

  const activitiesByTask: Record<string, ActivityRecord[]> = {};
  for (const a of allActivities) {
    (activitiesByTask[a.taskId] ??= []).push(a);
  }

  const attachmentsByTask: Record<string, AttachmentRecord[]> = {};
  for (const at of allAttachments) {
    (attachmentsByTask[at.taskId] ??= []).push(at);
  }

  const labelsByTask: Record<string, LabelRecord[]> = {};
  for (const tl of allTaskLabels) {
    (labelsByTask[tl.taskId] ??= []).push(tl.label);
  }

  const customFieldValuesByTask: Record<string, TaskCustomFieldValueRecord[]> = {};
  for (const cv of allCustomValues) {
    (customFieldValuesByTask[cv.taskId] ??= []).push(cv);
  }

  return {
    actor,
    projectId,
    statuses,
    sprints,
    sprintTotals,
    sprintDoneTotals,
    tasks,
    members,
    commentsByTask,
    activitiesByTask,
    attachmentsByTask,
    labelsByTask,
    projectLabels,
    customFields,
    customFieldValuesByTask,
    worklogsByTask,
    activeFilters: filter ?? {},
  };
}


/** Tìm kiếm task toàn workspace qua active projects (FR-080..FR-085). */
export async function searchWorkspaceTasks(
  workspaceId: string,
  filter: TaskFilterInput,
): Promise<{ actor: Actor; tasks: TaskRecord[] }> {
  const actor = await requireActor(workspaceId).catch(() => null);
  if (!actor) redirect("/workspaces");

  const tasks = await taskService.searchWorkspaceTasks(actor, filter);
  return { actor, tasks };
}
