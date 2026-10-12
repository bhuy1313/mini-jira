"use client";

import { useActionState, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CloseIcon, SearchIcon, UsersIcon } from "@/components/ui/icons";
import { changeMemberRoleAction, removeMemberAction } from "@/features/workspaces/actions";
import { canChangeMemberRole, canRemoveMember, type Role } from "@/features/authorization/permissions";
import type { MemberWithUser } from "@/features/workspaces/workspace-service";
import { cn } from "@/lib/cn";
import { notifyDeleted, notifyError, notifyUpdated } from "@/lib/notify";

const ROLE_LABEL: Record<Role, string> = {
  Owner: "Owner",
  Admin: "Admin",
  Member: "Member",
};

const ROLE_TONES: Record<Role, "urgent" | "info" | "neutral"> = {
  Owner: "urgent",
  Admin: "info",
  Member: "neutral",
};

function MemberCard({
  member,
  workspaceId,
  actorRole,
  isSelf,
}: {
  member: MemberWithUser;
  workspaceId: string;
  actorRole: Role;
  isSelf: boolean;
}) {
  const boundRole = async (prev: { error?: string } | undefined, formData: FormData) => {
    formData.set("userId", member.userId);
    const res = await changeMemberRoleAction(workspaceId, formData);
    if (res?.error) {
      notifyError(res.error);
    } else {
      notifyUpdated("member");
    }
    return res;
  };
  const [roleState, roleAction, rolePending] = useActionState(boundRole, {});

  const boundRemove = async (prev: { error?: string } | undefined, formData: FormData) => {
    formData.set("userId", member.userId);
    const res = await removeMemberAction(workspaceId, formData);
    if (res?.error) {
      notifyError(res.error);
    } else {
      notifyDeleted("member");
    }
    return res;
  };
  const [removeState, removeAction, removePending] = useActionState(boundRemove, {});

  const canChangeRole = canChangeMemberRole(actorRole);
  const canRemove = canRemoveMember(actorRole, member.role, isSelf);

  const display = member.name || member.email;
  const initials = display
    .split(/\s+/)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .slice(0, 2)
    .join("") || "?";

  return (
    <li className="group flex flex-col justify-between rounded-xl border border-rule bg-panel p-5 transition-all duration-200 hover:border-primary/40 hover:shadow-md">
      {/* Top Header Row */}
      <div>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <span
              aria-hidden="true"
              className={cn(
                "grid size-11 shrink-0 place-items-center rounded-full text-sm font-semibold shadow-2xs border",
                member.role === "Owner"
                  ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30"
                  : member.role === "Admin"
                    ? "bg-primary-soft text-primary-ink border-primary/25"
                    : "bg-panel-muted text-ink-soft border-rule",
              )}
            >
              {initials}
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="truncate text-base font-semibold text-ink">
                  {member.name}
                </h3>
                {isSelf ? (
                  <span className="rounded-sm bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                    You
                  </span>
                ) : null}
              </div>
              <p className="truncate text-xs text-ink-soft mt-0.5">
                {member.email}
              </p>
            </div>
          </div>

          <Badge tone={ROLE_TONES[member.role]} className="text-[11px] py-0 px-2 shrink-0">
            {ROLE_LABEL[member.role]}
          </Badge>
        </div>
      </div>

      {/* Action Controls (Bottom) */}
      <div className="mt-5 border-t border-rule/70 pt-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {canChangeRole ? (
            <form action={roleAction} className="flex items-center gap-1.5 flex-1 min-w-[140px]">
              <select
                name="role"
                defaultValue={member.role}
                aria-label="Role"
                className="h-8 flex-1 cursor-pointer rounded-md border border-rule bg-panel px-2 text-xs font-medium text-ink hover:border-rule-strong focus:border-primary focus:outline-none"
              >
                {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABEL[r]}
                  </option>
                ))}
              </select>
              <Button
                type="submit"
                variant="secondary"
                size="sm"
                disabled={rolePending}
                className="h-8 px-2.5 text-xs"
              >
                {rolePending ? "Saving…" : "Save"}
              </Button>
            </form>
          ) : (
            <div className="text-xs text-ink-faint italic">
              {isSelf ? "Your account" : "Workspace member"}
            </div>
          )}

          {canRemove ? (
            <form action={removeAction} className="shrink-0">
              <Button
                type="submit"
                variant="danger"
                size="sm"
                disabled={removePending}
                className="h-8 px-2.5 text-xs"
              >
                {removePending ? "Removing…" : "Remove"}
              </Button>
            </form>
          ) : null}
        </div>

        {/* Error Alerts */}
        {roleState.error ? (
          <p role="alert" className="mt-2 text-xs text-danger">
            {roleState.error}
          </p>
        ) : null}
        {removeState.error ? (
          <p role="alert" className="mt-2 text-xs text-danger">
            {removeState.error}
          </p>
        ) : null}
      </div>
    </li>
  );
}

export function MembersList({
  members,
  workspaceId,
  actorRole,
  currentUserId,
}: {
  members: MemberWithUser[];
  workspaceId: string;
  actorRole: Role;
  currentUserId: string;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | Role>("all");

  const filteredMembers = useMemo(() => {
    return members.filter((m) => {
      // Role filter
      if (roleFilter !== "all" && m.role !== roleFilter) return false;

      // Text search
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        m.name.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q)
      );
    });
  }, [members, searchQuery, roleFilter]);

  const ownersCount = useMemo(() => members.filter((m) => m.role === "Owner").length, [members]);
  const adminsCount = useMemo(() => members.filter((m) => m.role === "Admin").length, [members]);
  const membersCount = useMemo(() => members.filter((m) => m.role === "Member").length, [members]);

  return (
    <div className="space-y-6">
      {/* Search & Filter Bar */}
      {members.length > 0 ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 max-w-md">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-faint" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search members by name or email..."
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

          {/* Role Filter Tabs */}
          <div className="flex items-center gap-1 rounded-lg border border-rule bg-panel p-1 self-start sm:self-auto shadow-2xs">
            <button
              type="button"
              onClick={() => setRoleFilter("all")}
              className={cn(
                "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                roleFilter === "all"
                  ? "bg-primary text-white"
                  : "text-ink-soft hover:text-ink hover:bg-panel-muted",
              )}
            >
              All ({members.length})
            </button>
            <button
              type="button"
              onClick={() => setRoleFilter("Owner")}
              className={cn(
                "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                roleFilter === "Owner"
                  ? "bg-primary text-white"
                  : "text-ink-soft hover:text-ink hover:bg-panel-muted",
              )}
            >
              Owners ({ownersCount})
            </button>
            <button
              type="button"
              onClick={() => setRoleFilter("Admin")}
              className={cn(
                "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                roleFilter === "Admin"
                  ? "bg-primary text-white"
                  : "text-ink-soft hover:text-ink hover:bg-panel-muted",
              )}
            >
              Admins ({adminsCount})
            </button>
            <button
              type="button"
              onClick={() => setRoleFilter("Member")}
              className={cn(
                "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                roleFilter === "Member"
                  ? "bg-primary text-white"
                  : "text-ink-soft hover:text-ink hover:bg-panel-muted",
              )}
            >
              Members ({membersCount})
            </button>
          </div>
        </div>
      ) : null}

      {/* Member Cards Grid */}
      {filteredMembers.length === 0 ? (
        <div className="rounded-xl border border-dashed border-rule-strong bg-panel/60 p-8 text-center">
          {searchQuery || roleFilter !== "all" ? (
            <>
              <SearchIcon className="mx-auto size-6 text-ink-faint" />
              <p className="mt-2 text-sm font-medium text-ink">No members found</p>
              <p className="mt-1 text-xs text-ink-soft">
                No members matched your search or filter criteria.
              </p>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setSearchQuery("");
                  setRoleFilter("all");
                }}
                className="mt-3 text-xs"
              >
                Reset filters
              </Button>
            </>
          ) : (
            <>
              <UsersIcon className="mx-auto size-8 text-ink-faint" />
              <p className="mt-2 text-sm font-medium text-ink">No members in workspace</p>
            </>
          )}
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredMembers.map((m) => (
            <MemberCard
              key={m.userId}
              member={m}
              workspaceId={workspaceId}
              actorRole={actorRole}
              isSelf={m.userId === currentUserId}
            />
          ))}
        </ul>
      )}
    </div>
  );
}