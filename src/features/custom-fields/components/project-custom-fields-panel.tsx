"use client";

import { useActionState, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/inputs";
import { TrashIcon } from "@/components/ui/icons";
import { canManageCustomFields, type Role } from "@/features/authorization/permissions";
import {
  deleteCustomFieldAction,
  reorderCustomFieldsAction,
  updateCustomFieldAction,
} from "@/features/custom-fields/actions";
import { CreateCustomFieldButton } from "@/features/custom-fields/components/create-custom-field-modal";
import {
  CUSTOM_FIELD_TYPES,
  type CustomFieldRecord,
  type CustomFieldType,
} from "@/features/custom-fields/custom-field-service";

function CustomFieldRow({
  field,
  fields,
  index,
  workspaceId,
  projectId,
  canManage,
}: {
  field: CustomFieldRecord;
  fields: CustomFieldRecord[];
  index: number;
  workspaceId: string;
  projectId: string;
  canManage: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editType, setEditType] = useState<CustomFieldType>(field.type);
  const [isPending, startTransition] = useTransition();
  const [editError, setEditError] = useState<string | undefined>();

  const [deleteState, doDeleteAction, deletePending] = useActionState(
    (_prev: { error?: string }) =>
      deleteCustomFieldAction(workspaceId, projectId, field.id),
    {},
  );

  function handleMove(direction: "up" | "down") {
    const targetIdx = direction === "up" ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= fields.length) return;

    const newOrder = [...fields];
    const [moved] = newOrder.splice(index, 1);
    newOrder.splice(targetIdx, 0, moved);

    startTransition(async () => {
      await reorderCustomFieldsAction(
        workspaceId,
        projectId,
        newOrder.map((f) => f.id),
      );
    });
  }

  async function handleSaveEdit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setEditError(undefined);
    const formData = new FormData(e.currentTarget);
    const res = await updateCustomFieldAction(workspaceId, projectId, field.id, formData);
    if (res.error) {
      setEditError(res.error);
    } else {
      setEditing(false);
    }
  }

  return (
    <li className="flex flex-wrap items-center gap-3 py-3 border-b border-rule last:border-b-0">
      <div className="min-w-0 flex-1">
        {editing ? (
          <form onSubmit={handleSaveEdit} className="space-y-3 rounded-md border border-rule bg-paper/60 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <Input
                name="name"
                defaultValue={field.name}
                required
                maxLength={50}
                aria-label={`Edit name for ${field.name}`}
                className="h-8 text-xs flex-1 min-w-32"
              />
              <select
                name="type"
                value={editType}
                onChange={(e) => setEditType(e.target.value as CustomFieldType)}
                aria-label="Field type"
                className="h-8 rounded-md border border-rule bg-panel px-2 text-xs font-medium text-ink focus:border-primary focus:outline-none"
              >
                {CUSTOM_FIELD_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <label className="inline-flex items-center gap-1.5 text-xs text-ink cursor-pointer">
                <input
                  type="checkbox"
                  name="required"
                  defaultChecked={field.required}
                  className="accent-primary"
                />
                Required
              </label>
            </div>

            {editType === "Select" ? (
              <div>
                <Input
                  name="options"
                  defaultValue={field.options ? field.options.join(", ") : ""}
                  placeholder="Comma-separated options (e.g., Staging, Production, QA)"
                  aria-label="Select options"
                  className="h-8 text-xs w-full"
                />
              </div>
            ) : null}

            <div className="flex items-center gap-2">
              <Button type="submit" size="sm">
                Save
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setEditing(false);
                  setEditError(undefined);
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-ink">{field.name}</span>
            <span className="rounded bg-paper px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-ink-soft border border-rule">
              {field.type}
            </span>
            {field.required ? (
              <span className="rounded bg-danger-soft px-1.5 py-0.5 text-[10px] font-medium text-danger">
                Required
              </span>
            ) : null}
            {field.type === "Select" && field.options && field.options.length > 0 ? (
              <span className="text-xs text-ink-faint">
                ({field.options.join(", ")})
              </span>
            ) : null}
          </div>
        )}
      </div>

      {canManage && !editing && (
        <div className="flex shrink-0 items-center gap-1.5">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={index === 0 || isPending}
            onClick={() => handleMove("up")}
            aria-label={`Move ${field.name} up`}
            className="h-7 px-2 text-xs"
          >
            ↑
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={index === fields.length - 1 || isPending}
            onClick={() => handleMove("down")}
            aria-label={`Move ${field.name} down`}
            className="h-7 px-2 text-xs"
          >
            ↓
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setEditType(field.type);
              setEditing(true);
            }}
            className="h-7 px-2 text-xs"
          >
            Edit
          </Button>

          {!deleting ? (
            <button
              type="button"
              onClick={() => setDeleting(true)}
              aria-label={`Delete custom field ${field.name}`}
              className="grid size-7 place-items-center rounded-md text-ink-faint transition-colors hover:bg-danger-soft hover:text-danger"
              title="Delete field"
            >
              <TrashIcon className="size-3.5" />
            </button>
          ) : (
            <form action={doDeleteAction} className="flex items-center gap-1">
              <span className="text-xs text-danger">Delete?</span>
              <Button
                type="submit"
                variant="danger"
                size="sm"
                disabled={deletePending}
                className="h-7 px-2 text-xs"
              >
                Yes
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setDeleting(false)}
                className="h-7 px-2 text-xs"
              >
                Cancel
              </Button>
            </form>
          )}
        </div>
      )}

      {editError ? (
        <p role="alert" className="w-full text-xs text-danger">
          {editError}
        </p>
      ) : null}
      {deleteState.error ? (
        <p role="alert" className="w-full text-xs text-danger">
          {deleteState.error}
        </p>
      ) : null}
    </li>
  );
}

export function ProjectCustomFieldsPanel({
  workspaceId,
  projectId,
  customFields,
  actorProjectRole,
}: {
  workspaceId: string;
  projectId: string;
  customFields: CustomFieldRecord[];
  actorProjectRole: Role;
}) {
  const canManage = canManageCustomFields(actorProjectRole);

  return (
    <section
      aria-labelledby="project-custom-fields-heading"
      className="rounded-md border border-rule bg-panel p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2
            id="project-custom-fields-heading"
            className="text-lg font-semibold tracking-tight text-ink"
          >
            Custom Fields
          </h2>
          <p className="mt-1 text-sm text-ink-soft">
            Configure custom fields (Text, Number, Date, Select, Checkbox) to track metadata on tasks.
          </p>
        </div>

        {canManage && (
          <CreateCustomFieldButton workspaceId={workspaceId} projectId={projectId} />
        )}
      </div>

      {customFields.length === 0 ? (
        <p className="mt-4 text-sm text-ink-soft italic">No custom fields configured yet.</p>
      ) : (
        <ul className="mt-4 divide-y divide-rule" aria-label="Project custom fields">
          {customFields.map((f, index) => (
            <CustomFieldRow
              key={f.id}
              field={f}
              fields={customFields}
              index={index}
              workspaceId={workspaceId}
              projectId={projectId}
              canManage={canManage}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
