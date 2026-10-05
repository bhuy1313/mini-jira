import { SettingsIcon } from "@/components/ui/icons";
import { DeleteWorkspaceButton } from "@/features/workspaces/components/delete-workspace-button";
import { SettingsForm } from "@/features/workspaces/components/settings-form";
import {
  canDeleteWorkspace,
  canManageApiKeys,
  canUpdateWorkspace,
} from "@/features/authorization/permissions";
import { getWorkspaceSettings } from "@/features/workspaces/queries";
import { WorkspaceApiKeysPanel } from "@/features/api-keys/components/workspace-api-keys-panel";
import { listWorkspaceApiKeys } from "@/features/api-keys/queries";

export default async function WorkspaceSettingsPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  const { actor, ws } = await getWorkspaceSettings(workspaceId);
  const apiKeys = canManageApiKeys(actor.role)
    ? await listWorkspaceApiKeys(actor)
    : [];

  return (
    <div className="space-y-6">
      {/* ── Standardized Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-rule pb-5">
        <div className="flex items-center gap-3.5">
          <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary-ink shadow-2xs border border-primary/20">
            <SettingsIcon className="size-6" />
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-ink">
              Workspace Settings
            </h1>
            <p className="mt-1 text-sm text-ink-soft">
              Manage workspace profile, API keys, and security preferences for {ws.name}.
            </p>
          </div>
        </div>
      </div>

      {/* ── General Information Card ── */}
      <div className="rounded-xl border border-rule bg-panel p-6 shadow-2xs">
        <h2 className="text-base font-semibold text-ink">General Information</h2>
        {canUpdateWorkspace(actor.role) ? (
          <>
            <p className="mt-1 text-xs text-ink-soft">
              Edit the workspace name and public description.
            </p>
            <div className="mt-5 max-w-md">
              <SettingsForm
                workspaceId={workspaceId}
                name={ws.name}
                description={ws.description}
                icon={ws.icon}
              />
            </div>
          </>
        ) : (
          <p className="mt-2 text-xs text-ink-soft">
            Only the Owner can edit workspace settings.
          </p>
        )}
      </div>

      {/* ── API Keys Panel ── */}
      <WorkspaceApiKeysPanel
        workspaceId={workspaceId}
        apiKeys={apiKeys}
        canManage={canManageApiKeys(actor.role)}
      />

      {/* ── Danger Zone ── */}
      {canDeleteWorkspace(actor.role) ? (
        <div className="rounded-xl border border-danger/30 bg-panel p-6 shadow-2xs">
          <h2 className="text-base font-semibold text-danger">Danger Zone</h2>
          <p className="mt-1 text-xs text-ink-soft">
            Permanently delete this workspace and all associated projects, tasks, and data.
          </p>
          <div className="mt-4">
            <DeleteWorkspaceButton
              workspaceId={workspaceId}
              workspaceName={ws.name}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}