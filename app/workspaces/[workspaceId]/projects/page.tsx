import { BoardsIcon } from "@/components/ui/icons";
import { canCreateProject } from "@/features/authorization/permissions";
import { CreateProjectButton } from "@/features/projects/components/create-project-modal";
import { ProjectList } from "@/features/projects/components/project-list";
import { getWorkspaceProjectLists } from "@/features/projects/queries";

export default async function WorkspaceProjectsPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  const { actor, active, archived } = await getWorkspaceProjectLists(workspaceId);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-rule pb-5">
        <div className="flex items-center gap-3.5">
          <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary-ink shadow-2xs border border-primary/20">
            <BoardsIcon className="size-6" />
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-ink">Projects</h1>
            <p className="mt-1 text-sm text-ink-soft">
              Every project has its own kanban board.
            </p>
          </div>
        </div>
        {canCreateProject(actor.role) ? (
          <div className="shrink-0">
            <CreateProjectButton workspaceId={workspaceId} />
          </div>
        ) : null}
      </div>

      <div>
        <ProjectList
          active={active}
          archived={archived}
          workspaceId={workspaceId}
          actorRole={actor.role}
        />
      </div>
    </div>
  );
}