import { Panel } from "@/components/ui/panel";
import { canPermanentlyDeleteProject, canUpdateProject } from "@/features/authorization/permissions";
import { DeleteProjectButton } from "@/features/projects/components/delete-project-button";
import { ProjectSettingsForm } from "@/features/projects/components/project-settings-form";
import { ProjectMembersPanel } from "@/features/projects/components/project-members-panel";
import { ProjectStatusesPanel } from "@/features/statuses/components/project-statuses-panel";
import { ProjectSprintsPanel } from "@/features/sprints/components/project-sprints-panel";
import { ProjectCustomFieldsPanel } from "@/features/custom-fields/components/project-custom-fields-panel";
import { ProjectAutomationPanel } from "@/features/automation/components/project-automation-panel";
import { ProjectWebhooksPanel } from "@/features/webhooks/components/project-webhooks-panel";
import { getProjectSettingsData } from "@/features/projects/queries";

export const dynamic = "force-dynamic";

export default async function ProjectSettingsPage({
  params,
}: {
  params: Promise<{ workspaceId: string; projectId: string }>;
}) {
  const { workspaceId, projectId } = await params;
  const {
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
  } = await getProjectSettingsData(workspaceId, projectId);

  return (
    <div className="space-y-6">
      {/* Quick Navigation Sticky Bar */}
      <div className="sticky top-0 z-20 -mx-1 flex items-center gap-1.5 overflow-x-auto rounded-xl border border-rule bg-panel/95 p-2 shadow-xs backdrop-blur-md">
        <a
          href="#general"
          className="rounded-lg px-2.5 py-1 text-xs font-medium text-ink-soft transition-colors hover:bg-paper hover:text-ink whitespace-nowrap"
        >
          ⚙️ General
        </a>
        <a
          href="#statuses"
          className="rounded-lg px-2.5 py-1 text-xs font-medium text-ink-soft transition-colors hover:bg-paper hover:text-ink whitespace-nowrap"
        >
          📊 Statuses ({statuses.length})
        </a>
        <a
          href="#sprints"
          className="rounded-lg px-2.5 py-1 text-xs font-medium text-ink-soft transition-colors hover:bg-paper hover:text-ink whitespace-nowrap"
        >
          🏃 Sprints ({sprints.length})
        </a>
        <a
          href="#custom-fields"
          className="rounded-lg px-2.5 py-1 text-xs font-medium text-ink-soft transition-colors hover:bg-paper hover:text-ink whitespace-nowrap"
        >
          🏷️ Custom Fields ({customFields.length})
        </a>
        <a
          href="#automation"
          className="rounded-lg px-2.5 py-1 text-xs font-medium text-ink-soft transition-colors hover:bg-paper hover:text-ink whitespace-nowrap"
        >
          ⚡ Automation ({automationRules.length})
        </a>
        <a
          href="#webhooks"
          className="rounded-lg px-2.5 py-1 text-xs font-medium text-ink-soft transition-colors hover:bg-paper hover:text-ink whitespace-nowrap"
        >
          🔗 Webhooks ({webhooks.length})
        </a>
        <a
          href="#members"
          className="rounded-lg px-2.5 py-1 text-xs font-medium text-ink-soft transition-colors hover:bg-paper hover:text-ink whitespace-nowrap"
        >
          👥 Members ({members.length})
        </a>
        {canPermanentlyDeleteProject(actor.projectRole) ? (
          <a
            href="#danger-zone"
            className="rounded-lg px-2.5 py-1 text-xs font-medium text-danger transition-colors hover:bg-danger-soft whitespace-nowrap"
          >
            ⚠️ Danger Zone
          </a>
        ) : null}
      </div>

      <div id="general">
        <Panel>
          <h1 className="text-2xl font-semibold tracking-tight">
            {project.name} <span className="text-ink-faint">/ settings</span>
          </h1>
          {canUpdateProject(actor.projectRole) ? (
            <>
              <p className="mt-1 text-sm text-ink-soft">
                Edit the project name and description.
              </p>
              <div className="mt-5 max-w-md">
                <ProjectSettingsForm
                  workspaceId={workspaceId}
                  projectId={projectId}
                  name={project.name}
                  description={project.description}
                />
              </div>
            </>
          ) : (
            <p className="mt-2 text-sm text-ink-soft">
              Only the Owner or an Admin can edit project settings.
            </p>
          )}
        </Panel>
      </div>

      <div id="statuses">
        <ProjectStatusesPanel
          workspaceId={workspaceId}
          projectId={projectId}
          statuses={statuses}
          actorProjectRole={actor.projectRole}
        />
      </div>

      <div id="sprints">
        <ProjectSprintsPanel
          workspaceId={workspaceId}
          projectId={projectId}
          sprints={sprints}
          actorProjectRole={actor.projectRole}
        />
      </div>

      <div id="custom-fields">
        <ProjectCustomFieldsPanel
          workspaceId={workspaceId}
          projectId={projectId}
          customFields={customFields}
          actorProjectRole={actor.projectRole}
        />
      </div>

      <div id="automation">
        <ProjectAutomationPanel
          workspaceId={workspaceId}
          projectId={projectId}
          rules={automationRules}
          logs={automationLogs}
          statuses={statuses}
          members={members}
          actorProjectRole={actor.projectRole}
        />
      </div>

      <div id="webhooks">
        <ProjectWebhooksPanel
          workspaceId={workspaceId}
          projectId={projectId}
          webhooks={webhooks}
          logs={webhookLogs}
          actorProjectRole={actor.projectRole}
        />
      </div>

      <div id="members">
        <ProjectMembersPanel
          workspaceId={workspaceId}
          projectId={projectId}
          members={members}
          actorProjectRole={actor.projectRole}
          actorUserId={actor.userId}
        />
      </div>

      {canPermanentlyDeleteProject(actor.projectRole) ? (
        <div id="danger-zone">
          <Panel className="border-danger/30">
            <h2 className="text-lg font-semibold text-danger">Danger zone</h2>
            <p className="mt-1 text-sm text-ink-soft">
              Permanently delete this project and all its tasks, comments, and
              activity.
            </p>
            <div className="mt-4">
              <DeleteProjectButton
                workspaceId={workspaceId}
                projectId={projectId}
                projectName={project.name}
              />
            </div>
          </Panel>
        </div>
      ) : null}
    </div>
  );
}