"use client";

import { useState, useEffect, useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Markdown } from "@/components/ui/markdown";
import { MarkdownEditor } from "@/components/ui/markdown-editor";
import type { Role } from "@/features/authorization/permissions";
import { addCommentAction, deleteCommentAction, updateCommentAction } from "@/features/comments/actions";
import type { CommentRecord } from "@/features/comments/comment-service";
import type { MemberWithUser } from "@/features/workspaces/workspace-service";
import { formatDateTime } from "@/lib/dates";

import { useRouter } from "next/navigation";

function CommentItem({
  comment,
  workspaceId,
  projectId,
  actorRole,
  actorUserId,
  onDeleted,
  members = [],
}: {
  comment: CommentRecord;
  workspaceId: string;
  projectId: string;
  actorRole: Role;
  actorUserId: string;
  onDeleted?: (commentId: string) => void;
  members?: MemberWithUser[];
}) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [localContent, setLocalContent] = useState(comment.content);
  const isAuthor = comment.authorId === actorUserId;
  const canDelete = isAuthor || actorRole === "Owner" || actorRole === "Admin";

  const [updateState, updateAction, updatePending] = useActionState(
    async (_prev: { error?: string }, formData: FormData) => {
      const newText = String(formData.get("content") || "").trim();
      const prevText = localContent;
      setLocalContent(newText);
      setIsEditing(false);
      const res = await updateCommentAction(workspaceId, projectId, comment.id, formData);
      if (res.error) {
        setLocalContent(prevText);
        setIsEditing(true);
      } else {
        router.refresh();
      }
      return res;
    },
    {},
  );

  const [deleteState, deleteAction, deletePending] = useActionState(
    async (_prev: { error?: string }) => {
      onDeleted?.(comment.id);
      return deleteCommentAction(workspaceId, projectId, comment.id);
    },
    {},
  );

  const formattedDate = formatDateTime(comment.createdAt);

  return (
    <li className="border-b border-rule py-3.5 last:border-0 last:pb-0">
      <div className="flex items-baseline justify-between gap-2">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-medium text-ink">
            {comment.author?.name || comment.author?.email || "Workspace Member"}
          </span>
          {isAuthor ? (
            <span className="text-xs text-ink-faint">you</span>
          ) : null}
          <time className="text-xs text-ink-faint">{formattedDate}</time>
        </div>
        <div className="flex items-center gap-3">
          {isAuthor && !isEditing ? (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="text-xs font-medium text-ink-faint hover:text-ink"
            >
              Edit
            </button>
          ) : null}
          {canDelete && !isEditing ? (
            <form action={deleteAction}>
              <button
                type="submit"
                disabled={deletePending}
                className="text-xs font-medium text-ink-faint hover:text-danger disabled:opacity-50"
              >
                {deletePending ? "Deleting…" : "Delete"}
              </button>
            </form>
          ) : null}
        </div>
      </div>

      {deleteState.error ? (
        <p role="alert" className="mt-1 text-xs text-danger">
          {deleteState.error}
        </p>
      ) : null}

      {isEditing ? (
        <form action={updateAction} className="mt-2 space-y-2">
          <MarkdownEditor
            name="content"
            defaultValue={comment.content}
            required
            compact
            rows={2}
            ariaLabel="Edit comment"
            members={members}
          />
          {updateState.error ? (
            <p role="alert" className="text-xs text-danger">
              {updateState.error}
            </p>
          ) : null}
          <div className="flex items-center gap-2">
            <Button type="submit" variant="secondary" size="sm" disabled={updatePending}>
              {updatePending ? "Saving…" : "Save"}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setIsEditing(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <div className="mt-1">
          <Markdown source={localContent} members={members} />
        </div>
      )}
    </li>
  );
}

export function CommentList({
  taskId,
  workspaceId,
  projectId,
  comments: initialComments,
  actorRole,
  actorUserId,
  members = [],
}: {
  taskId: string;
  workspaceId: string;
  projectId: string;
  comments: CommentRecord[];
  actorRole: Role;
  actorUserId: string;
  members?: MemberWithUser[];
}) {
  const router = useRouter();
  const [comments, setComments] = useState(initialComments);

  useEffect(() => {
    setComments(initialComments);
  }, [initialComments]);

  const [addState, addAction, addPending] = useActionState(
    async (_prev: { error?: string }, formData: FormData) => {
      const res = await addCommentAction(workspaceId, projectId, taskId, formData);
      if (!res?.error) {
        router.refresh();
      }
      return res;
    },
    {},
  );

  return (
    <div className="space-y-4">
      <form action={addAction} className="space-y-2">
        <MarkdownEditor
          name="content"
          placeholder="Write a comment… Markdown is supported, @ mentions a member."
          required
          compact
          rows={2}
          ariaLabel="Comment content"
          members={members}
        />
        {addState.error ? (
          <p role="alert" className="text-xs text-danger">
            {addState.error}
          </p>
        ) : null}
        <div className="flex justify-end">
          <Button type="submit" size="sm" disabled={addPending}>
            {addPending ? "Posting…" : "Post comment"}
          </Button>
        </div>
      </form>

      {comments.length === 0 ? (
        <p className="py-6 text-center text-xs text-ink-faint">
          No comments yet. Start the conversation.
        </p>
      ) : (
        <ul className="border-t border-rule">
          {comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              workspaceId={workspaceId}
              projectId={projectId}
              actorRole={actorRole}
              actorUserId={actorUserId}
              members={members}
              onDeleted={(id) => setComments((prev) => prev.filter((c) => c.id !== id))}
            />
          ))}
        </ul>
      )}
    </div>
  );
}