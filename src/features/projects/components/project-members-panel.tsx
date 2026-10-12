"use client";

import { useActionState, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/inputs";
import type { Role } from "@/features/authorization/permissions";
import {
  addProjectMemberAction,
  changeProjectMemberRoleAction,
  removeProjectMemberAction,
} from "@/features/projects/project-member-actions";
import { notifyCreated, notifyDeleted, notifyError, notifyUpdated } from "@/lib/notify";

export interface ProjectMemberItem {
  userId: string;
  role: Role;
  name: string;
  email: string;
}

const ROLE_BADGE_STYLES: Record<Role, string> = {
  Owner: "bg-primary/10 text-primary font-medium",
  Admin: "bg-amber-100 text-amber-700 font-medium",
  Member: "bg-panel text-ink-soft border border-rule",
};

function RoleBadge({ role }: { role: Role }) {
  return (
    <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs ${ROLE_BADGE_STYLES[role]}`}>
      {role}
    </span>
  );
}

function Initials({ name, email }: { name: string; email: string }) {
  const display = name || email;
  const letters = display
    .split(/\s+/)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .slice(0, 2)
    .join("");
  return (
    <span
      aria-hidden="true"
      className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary"
    >
      {letters || "?"}
    </span>
  );
}

/** Row for a single project member with role-change / remove controls. */
function MemberRow({
  member,
  workspaceId,
  projectId,
  actorProjectRole,
  actorUserId,
}: {
  member: ProjectMemberItem;
  workspaceId: string;
  projectId: string;
  actorProjectRole: Role;
  actorUserId: string;
}) {
  const [removing, setRemoving] = useState(false);
  const [roleError, setRoleError] = useState<string | undefined>();
  const [, startRoleTransition] = useTransition();

  const [removeState, doRemoveAction, removeChanging] = useActionState(
    async (_prev: { error?: string }) => {
      const res = await removeProjectMemberAction(workspaceId, projectId, member.userId);
      if (res?.error) {
        notifyError(res.error);
      } else {
        notifyDeleted("member");
      }
      return res;
    },
    {},
  );

  const isOwnerActor = actorProjectRole === "Owner";
  const isAdminActor = actorProjectRole === "Admin";
  const isSelf = actorUserId === member.userId;

  // Owner can remove Admin/Member; Admin can remove Member
  const canRemove =
    !isSelf &&
    ((isOwnerActor && member.role !== "Owner") ||
      (isAdminActor && member.role === "Member"));

  // Only Owner can change roles; not self
  const canChangeRole = isOwnerActor && !isSelf;

  function handleRoleChange(role: string) {
    setRoleError(undefined);
    startRoleTransition(async () => {
      const result = await changeProjectMemberRoleAction(workspaceId, projectId, member.userId, role);
      if (result.error) {
        setRoleError(result.error);
        notifyError(result.error);
      } else {
        notifyUpdated("member");
      }
    });
  }

  return (
    <li className="flex flex-wrap items-center gap-3 py-3">
      <Initials name={member.name} email={member.email} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink">{member.name || member.email}</p>
        <p className="truncate text-xs text-ink-soft">{member.email}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <RoleBadge role={member.role} />

        {canChangeRole && (
          <select
            aria-label={`Change role for ${member.name || member.email}`}
            defaultValue={member.role}
            className="rounded border border-rule bg-panel px-2 py-1 text-xs text-ink focus:outline-none focus:ring-1 focus:ring-primary/50"
            onChange={(e) => handleRoleChange(e.target.value)}
          >
            <option value="Owner">Owner</option>
            <option value="Admin">Admin</option>
            <option value="Member">Member</option>
          </select>
        )}

        {canRemove && (
          <>
            {!removing ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setRemoving(true)}
                className="text-danger hover:text-danger"
              >
                Remove
              </Button>
            ) : (
              <form action={doRemoveAction} className="flex items-center gap-1">
                <span className="text-xs text-danger">Remove?</span>
                <Button type="submit" variant="danger" size="sm" disabled={removeChanging}>
                  Yes
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setRemoving(false)}
                >
                  Cancel
                </Button>
              </form>
            )}
          </>
        )}
      </div>
      {roleError && (
        <p role="alert" className="w-full text-xs text-danger">
          {roleError}
        </p>
      )}
      {removeState.error && (
        <p role="alert" className="w-full text-xs text-danger">
          {removeState.error}
        </p>
      )}
    </li>
  );
}

/** Add-member form (email + role). Shown to Owner/Admin. */
function AddMemberForm({
  workspaceId,
  projectId,
}: {
  workspaceId: string;
  projectId: string;
}) {
  const bound = async (prev: { error?: string } | undefined, formData: FormData) => {
    const res = await addProjectMemberAction(workspaceId, projectId, formData);
    if (res?.error) {
      notifyError(res.error);
    } else {
      notifyCreated("member");
    }
    return res;
  };
  const [state, formAction, pending] = useActionState(bound, {});

  return (
    <form action={formAction} className="mt-4 flex flex-wrap items-end gap-3">
      <Field label="Email" className="flex-1 min-w-48">
        <Input
          name="email"
          type="email"
          required
          placeholder="colleague@example.com"
          aria-label="Member email"
        />
      </Field>
      <Field label="Role" className="w-32">
        <select
          name="role"
          defaultValue="Member"
          className="h-9 w-full rounded-md border border-rule bg-panel px-3 text-sm text-ink focus:outline-none focus:ring-1 focus:ring-primary/50"
          aria-label="Role to assign"
        >
          <option value="Admin">Admin</option>
          <option value="Member">Member</option>
        </select>
      </Field>
      <Button type="submit" disabled={pending} className="mb-0.5">
        {pending ? "Adding…" : "Add member"}
      </Button>
      {state.error && (
        <p role="alert" className="w-full text-xs text-danger">
          {state.error}
        </p>
      )}
    </form>
  );
}

/**
 * Client component — panel quản lý project member (Mốc 11).
 * Nhận dữ liệu đã fetch từ Server Component cha.
 */
export function ProjectMembersPanel({
  workspaceId,
  projectId,
  members,
  actorProjectRole,
  actorUserId,
}: {
  workspaceId: string;
  projectId: string;
  members: ProjectMemberItem[];
  actorProjectRole: Role;
  actorUserId: string;
}) {
  const canAdd = actorProjectRole === "Owner" || actorProjectRole === "Admin";

  return (
    <section aria-labelledby="project-members-heading" className="rounded-md border border-rule bg-panel p-5">
      <h2 id="project-members-heading" className="text-lg font-semibold tracking-tight">Members</h2>
      <p className="mt-1 text-sm text-ink-soft">
        Manage who has access to this project and their roles.
      </p>

      {members.length === 0 ? (
        <p className="mt-4 text-sm text-ink-soft italic">No members yet.</p>
      ) : (
        <ul
          className="mt-4 divide-y divide-rule"
          aria-label="Project members"
        >
          {members.map((m) => (
            <MemberRow
              key={m.userId}
              member={m}
              workspaceId={workspaceId}
              projectId={projectId}
              actorProjectRole={actorProjectRole}
              actorUserId={actorUserId}
            />
          ))}
        </ul>
      )}

      {canAdd && (
        <>
          <hr className="mt-4 border-rule" />
          <h3 className="mt-4 text-sm font-medium text-ink">Add a member</h3>
          <AddMemberForm workspaceId={workspaceId} projectId={projectId} />
        </>
      )}
    </section>
  );
}
