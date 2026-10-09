"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { PaperclipIcon } from "@/components/ui/icons";
import type { Role } from "@/features/authorization/permissions";
import {
  addAttachmentAction,
  deleteAttachmentAction,
} from "@/features/attachments/actions";
import type { AttachmentRecord } from "@/features/attachments/attachment-service";
import { formatDate } from "@/lib/dates";
import { resolveRealTaskId } from "@/features/tasks/pending-task-ids";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function AttachmentRow({
  attachment,
  workspaceId,
  projectId,
  actorRole,
  actorUserId,
}: {
  attachment: AttachmentRecord;
  workspaceId: string;
  projectId: string;
  actorRole: Role;
  actorUserId: string;
}) {
  const isUploader = attachment.userId === actorUserId;
  const canDelete = isUploader || actorRole === "Owner" || actorRole === "Admin";

  const [deleteState, deleteAction, deletePending] = useActionState(
    async (_prev: { error?: string }) =>
      deleteAttachmentAction(workspaceId, projectId, attachment.id),
    {},
  );

  return (
    <li className="flex items-center justify-between gap-3 py-2.5">
      <div className="min-w-0">
        <a
          href={`/api/attachments/${attachment.id}`}
          className="flex items-center gap-2 text-sm font-medium text-primary-deep hover:underline"
        >
          <PaperclipIcon className="size-4 shrink-0" />
          <span className="truncate">{attachment.filename}</span>
        </a>
        <p className="mt-0.5 flex items-center gap-2 text-xs text-ink-faint">
          <span>{formatSize(attachment.size)}</span>
          <span aria-hidden>·</span>
          <span>{attachment.user?.name || attachment.user?.email || "Workspace Member"}</span>
          <span aria-hidden>·</span>
          <time>{formatDate(attachment.createdAt)}</time>
        </p>
        {deleteState.error ? (
          <p role="alert" className="mt-1 text-xs text-danger">
            {deleteState.error}
          </p>
        ) : null}
      </div>
      {canDelete ? (
        <form action={deleteAction}>
          <button
            type="submit"
            disabled={deletePending}
            className="shrink-0 text-xs font-medium text-ink-faint hover:text-danger disabled:opacity-50"
          >
            {deletePending ? "Deleting…" : "Delete"}
          </button>
        </form>
      ) : null}
    </li>
  );
}

export function AttachmentList({
  taskId,
  workspaceId,
  projectId,
  attachments,
  actorRole,
  actorUserId,
}: {
  taskId: string;
  workspaceId: string;
  projectId: string;
  attachments: AttachmentRecord[];
  actorRole: Role;
  actorUserId: string;
}) {
  const [fileName, setFileName] = useState<string>("");

  const [addState, addAction, addPending] = useActionState(
    async (prev: { error?: string }, formData: FormData) => {
      // Await the real id when uploading right after task creation.
      const realTaskId = await resolveRealTaskId(taskId);
      const res = await addAttachmentAction(workspaceId, projectId, realTaskId, formData);
      if (!res.error) setFileName("");
      return res;
    },
    {},
  );

  return (
    <div className="space-y-4">
      <form action={addAction} className="space-y-2">
        <div className="flex items-center gap-2">
          <label className="min-w-0 flex-1 cursor-pointer rounded-md border border-rule bg-paper/50 px-3 py-2 text-sm text-ink-soft hover:border-rule-strong">
            {fileName || "Choose a file…"}
            <input
              type="file"
              name="file"
              required
              aria-label="Attachment file"
              className="sr-only"
              onChange={(e) => setFileName(e.target.files?.[0]?.name ?? "")}
            />
          </label>
          <Button type="submit" size="sm" disabled={addPending}>
            {addPending ? "Uploading…" : "Upload"}
          </Button>
        </div>
        {addState.error ? (
          <p role="alert" className="text-xs text-danger">
            {addState.error}
          </p>
        ) : null}
      </form>

      {attachments.length === 0 ? (
        <p className="py-6 text-center text-xs text-ink-faint">
          No attachments yet. Upload a file to share details with the team.
        </p>
      ) : (
        <ul className="divide-y divide-rule border-t border-rule">
          {attachments.map((attachment) => (
            <AttachmentRow
              key={attachment.id}
              attachment={attachment}
              workspaceId={workspaceId}
              projectId={projectId}
              actorRole={actorRole}
              actorUserId={actorUserId}
            />
          ))}
        </ul>
      )}
    </div>
  );
}