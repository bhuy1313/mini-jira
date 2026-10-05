import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import type { Actor } from "@/features/authorization/actor";
import { requireActor, requireProjectActor } from "@/features/workspaces/session";
import type { ProjectActor } from "@/features/authorization/actor";
import {
  createProjectService,
  type ProjectRecord,
} from "@/features/projects/project-service";
import { prismaProjectRepository } from "@/features/projects/prisma-project-repository";
import type { ProjectMemberItem } from "@/features/projects/components/project-members-panel";

const projectService = createProjectService({ repo: prismaProjectRepository });

export interface WorkspaceProjectLists {
  actor: Actor;
  active: ProjectRecord[];
  archived: ProjectRecord[];
}

/** Active + archived project lists cho workspace; redirect /workspaces nếu không phải member. */
export async function getWorkspaceProjectLists(workspaceId: string): Promise<WorkspaceProjectLists> {
  const actor = await requireActor(workspaceId).catch(() => null);
  if (!actor) redirect("/workspaces");
  const [active, archived] = await Promise.all([
    projectService.listProjects(actor),
    projectService.listArchivedProjects(actor),
  ]);
  return { actor, active, archived };
}

/** Chi tiết project; redirect về danh sách nếu không có quyền hoặc không tồn tại. */
export async function getProjectDetail(
  workspaceId: string,
  projectId: string,
): Promise<{ actor: ProjectActor; project: ProjectRecord }> {
  const actor = await requireProjectActor(workspaceId, projectId).catch(() => null);
  if (!actor) redirect("/workspaces");
  const project = await projectService.getProject(actor, projectId).catch(() => null);
  if (!project) redirect(`/workspaces/${workspaceId}/projects`);
  return { actor, project };
}

import { prismaStatusRepository } from "@/features/statuses/prisma-status-repository";
import type { StatusRecord } from "@/features/statuses/status-service";
import { prismaSprintRepository } from "@/features/sprints/prisma-sprint-repository";
import type { SprintRecord } from "@/features/sprints/sprint-service";
import { prismaCustomFieldRepository } from "@/features/custom-fields/prisma-custom-field-repository";
import type { CustomFieldRecord } from "@/features/custom-fields/custom-field-service";
import { prismaAutomationRepository } from "@/features/automation/prisma-automation-repository";
import type {
  AutomationExecutionLogRecord,
  AutomationRuleRecord,
} from "@/features/automation/automation-types";
import { prismaWebhookRepository } from "@/features/webhooks/prisma-webhook-repository";
import type { WebhookDeliveryLogRecord, WebhookRecord } from "@/features/webhooks/webhook-types";

/** Dữ liệu cho trang project settings: actor (ProjectActor), project, danh sách member kèm user info, danh sách statuses, sprints, custom fields, automation rules, logs. */
export async function getProjectSettingsData(
  workspaceId: string,
  projectId: string,
): Promise<{
  actor: ProjectActor;
  project: ProjectRecord;
  members: ProjectMemberItem[];
  statuses: StatusRecord[];
  sprints: SprintRecord[];
  customFields: CustomFieldRecord[];
  automationRules: AutomationRuleRecord[];
  automationLogs: AutomationExecutionLogRecord[];
  webhooks: WebhookRecord[];
  webhookLogs: WebhookDeliveryLogRecord[];
}> {
  const actor = await requireProjectActor(workspaceId, projectId).catch(() => null);
  if (!actor) redirect("/workspaces");

  const [project, memberRows, statuses, sprints, customFields, automationRules, automationLogs, webhooks, webhookLogs] =
    await Promise.all([
      projectService.getProject(actor, projectId).catch(() => null),
      prisma.projectMember.findMany({
        where: { projectId },
        select: {
          userId: true,
          role: true,
          user: { select: { name: true, email: true } },
        },
        orderBy: { createdAt: "asc" },
      }),
      prismaStatusRepository.listStatusesByProject(projectId),
      prismaSprintRepository.listSprintsByProject(projectId),
      prismaCustomFieldRepository.listFieldsByProject(projectId),
      prismaAutomationRepository.listRulesByProject(projectId),
      prismaAutomationRepository.listLogsByProject(projectId, 50),
      prismaWebhookRepository.listWebhooksByProject(projectId),
      prismaWebhookRepository.listDeliveryLogsByProject(projectId, 50),
    ]);

  if (!project) redirect(`/workspaces/${workspaceId}/projects`);

  const members: ProjectMemberItem[] = memberRows.map((r) => ({
    userId: r.userId,
    role: r.role as ProjectMemberItem["role"],
    name: r.user.name,
    email: r.user.email,
  }));

  return {
    actor,
    project,
    members,
    statuses,
    sprints,
    customFields,
    automationRules,
    automationLogs,
    webhooks,
    webhookLogs,
  };
}


