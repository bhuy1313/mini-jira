import { UsersIcon } from "@/components/ui/icons";
import { InviteMemberButton } from "@/features/workspaces/components/invite-member-modal";
import { MembersList } from "@/features/workspaces/components/members-list";
import { canAddMember } from "@/features/authorization/permissions";
import { getWorkspaceContext } from "@/features/workspaces/queries";

export default async function WorkspaceMembersPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  const { actor, ws, members } = await getWorkspaceContext(workspaceId);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-rule pb-5">
        <div className="flex items-center gap-3.5">
          <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary-ink shadow-2xs border border-primary/20">
            <UsersIcon className="size-6" />
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-ink">Members</h1>
            <p className="mt-1 text-sm text-ink-soft">
              Everyone with access to {ws.name}.
            </p>
          </div>
        </div>
        {canAddMember(actor.role) ? (
          <div className="shrink-0">
            <InviteMemberButton workspaceId={workspaceId} />
          </div>
        ) : null}
      </div>

      <div>
        <MembersList
          members={members}
          workspaceId={workspaceId}
          actorRole={actor.role}
          currentUserId={actor.userId}
        />
      </div>
    </div>
  );
}