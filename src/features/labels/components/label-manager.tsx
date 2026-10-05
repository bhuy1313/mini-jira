"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { CheckIcon, CloseIcon, TrashIcon } from "@/components/ui/icons";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/cn";
import {
  createLabelAction,
  deleteLabelAction,
  updateLabelAction,
} from "@/features/labels/actions";
import { LABEL_COLOR_OPTIONS } from "@/features/labels/label-service";
import type { LabelRecord } from "@/features/labels/label-service";

function ColorSwatchPicker({
  name,
  value,
  onChange,
}: {
  name: string;
  value: string;
  onChange: (hex: string) => void;
}) {
  return (
    <div className="flex items-center gap-1.5 py-1">
      <input type="hidden" name={name} value={value} />
      <div className="flex flex-wrap items-center gap-1.5" role="radiogroup" aria-label="Label color picker">
        {LABEL_COLOR_OPTIONS.map((opt) => {
          const isSelected = opt.hex.toLowerCase() === value.toLowerCase();
          return (
            <button
              key={opt.hex}
              type="button"
              role="radio"
              aria-checked={isSelected}
              title={opt.name}
              aria-label={opt.name}
              onClick={() => onChange(opt.hex)}
              className={cn(
                "grid size-6 place-items-center rounded-full transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1",
                isSelected && "ring-2 ring-primary ring-offset-1 scale-105 shadow-xs",
              )}
              style={{ backgroundColor: opt.hex }}
            >
              {isSelected ? (
                <CheckIcon className="size-3.5 text-white drop-shadow-sm" />
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function LabelRow({
  label,
  workspaceId,
  projectId,
  onDeleted,
}: {
  label: LabelRecord;
  workspaceId: string;
  projectId: string;
  onDeleted?: (id: string) => void;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [editColor, setEditColor] = useState(label.color);
  const [state, formAction, pending] = useActionState(
    async (_prev: { error?: string }, formData: FormData) => {
      const res = await updateLabelAction(workspaceId, projectId, label.id, formData);
      if (!res?.error) {
        setEditing(false);
        router.refresh();
      }
      return res;
    },
    {},
  );
  const [deleteState, deleteAction, deletePending] = useActionState(
    async (_prev: { error?: string }) => {
      onDeleted?.(label.id);
      const res = await deleteLabelAction(workspaceId, projectId, label.id);
      router.refresh();
      return res;
    },
    {},
  );

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-2.5">
      {editing ? (
        <form action={formAction} className="flex w-full flex-col gap-2 sm:flex-row sm:items-center">
          <input
            name="name"
            defaultValue={label.name}
            maxLength={50}
            aria-label="Label name"
            required
            className="h-8 w-40 rounded-md border border-rule bg-paper px-2 text-xs text-ink focus:border-primary focus:outline-none"
          />
          <ColorSwatchPicker name="color" value={editColor} onChange={setEditColor} />
          <div className="flex items-center gap-1.5">
            <Button type="submit" size="sm" variant="secondary" disabled={pending}>
              {pending ? "Saving…" : "Save"}
            </Button>
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setEditColor(label.color);
              }}
              className="px-2 text-xs text-ink-faint hover:text-ink"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <span
              className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium text-white shadow-xs"
              style={{ backgroundColor: label.color }}
            >
              {label.name}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setEditing(true);
                setEditColor(label.color);
              }}
              aria-label={`Edit label ${label.name}`}
              className="text-xs font-medium text-ink-soft hover:text-ink transition-colors"
            >
              Edit
            </button>
            <form action={deleteAction}>
              <button
                type="submit"
                disabled={deletePending}
                aria-label={`Delete label ${label.name}`}
                title={`Delete label ${label.name}`}
                className="grid size-6 place-items-center rounded-md text-ink-faint transition-colors hover:bg-danger-soft hover:text-danger disabled:opacity-50"
              >
                <TrashIcon className="size-3.5" />
              </button>
            </form>
          </div>
        </>
      )}

      {state.error ? (
        <p role="alert" className="w-full text-xs text-danger">
          {state.error}
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

/** Manage project labels inside a modern modal popup (Mốc 10, 22, 23). */
export function ManageLabelsModal({
  open,
  onClose,
  workspaceId,
  projectId,
  labels: initialLabels,
}: {
  open: boolean;
  onClose: () => void;
  workspaceId: string;
  projectId: string;
  labels: LabelRecord[];
}) {
  const router = useRouter();
  const [localLabels, setLocalLabels] = useState(initialLabels);
  const [selectedColor, setSelectedColor] = useState(LABEL_COLOR_OPTIONS[0].hex);
  const [name, setName] = useState("");

  useEffect(() => {
    setLocalLabels(initialLabels);
  }, [initialLabels]);

  const [state, formAction, pending] = useActionState(
    async (_prev: { error?: string }, formData: FormData) => {
      const labelName = String(formData.get("name") || "").trim();
      const labelColor = String(formData.get("color") || "");
      if (labelName) {
        setLocalLabels((prev) => [
          ...prev,
          {
            id: `temp-${Date.now()}`,
            projectId,
            workspaceId,
            name: labelName,
            color: labelColor || selectedColor,
          },
        ]);
      }
      const res = await createLabelAction(workspaceId, projectId, formData);
      if (!res?.error) {
        setName("");
        router.refresh();
      } else {
        setLocalLabels(initialLabels);
      }
      return res;
    },
    {},
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      labelledBy="manage-labels-heading"
      panelClassName="max-w-xl p-0 overflow-hidden"
    >
      <div className="flex items-center justify-between border-b border-rule bg-paper/50 px-5 py-3.5">
        <div>
          <h2 id="manage-labels-heading" className="text-sm font-semibold text-ink">
            Manage Project Labels
          </h2>
          <p className="text-xs text-ink-soft">
            Create, customize colors, and organize task tags.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close dialog"
          className="rounded p-1 text-ink-faint transition-colors hover:bg-paper hover:text-ink"
        >
          <CloseIcon className="size-4" />
        </button>
      </div>

      <div className="p-5">
        <section aria-label="Manage labels" className="space-y-4">
          <form action={formAction} className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2">
              <input
                name="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={50}
                placeholder="New label name..."
                aria-label="New label name"
                className="h-8 w-44 rounded-md border border-rule bg-paper px-2.5 text-xs text-ink placeholder:text-ink-faint focus:border-primary focus:outline-none"
              />
            </div>

            <ColorSwatchPicker
              name="color"
              value={selectedColor}
              onChange={setSelectedColor}
            />

            <Button type="submit" size="sm" disabled={pending} className="shrink-0">
              {pending ? "Adding…" : "Add label"}
            </Button>

            {state.error ? (
              <span role="alert" className="text-xs text-danger">
                {state.error}
              </span>
            ) : null}
          </form>

          <div className="border-t border-rule pt-2">
            <h3 className="text-xs font-semibold text-ink-soft uppercase tracking-wider mb-1">
              Existing Labels ({localLabels.length})
            </h3>
            {localLabels.length > 0 ? (
              <ul className="divide-y divide-rule max-h-60 overflow-y-auto pr-1">
                {localLabels.map((label) => (
                  <LabelRow
                    key={label.id}
                    label={label}
                    workspaceId={workspaceId}
                    projectId={projectId}
                    onDeleted={(id) => setLocalLabels((prev) => prev.filter((l) => l.id !== id))}
                  />
                ))}
              </ul>
            ) : (
              <p className="py-3 text-xs text-ink-faint">No labels yet.</p>
            )}
          </div>
        </section>
      </div>

      <div className="flex justify-end border-t border-rule bg-paper/30 px-5 py-3">
        <Button variant="secondary" size="sm" onClick={onClose}>
          Done
        </Button>
      </div>
    </Modal>
  );
}

/** Legacy / Wrapper export for backwards compatibility */
export function LabelManager({
  workspaceId,
  projectId,
  labels,
}: {
  workspaceId: string;
  projectId: string;
  labels: LabelRecord[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={() => setOpen(true)}
        className="gap-1.5"
      >
        <span>🏷️</span>
        <span>Labels ({labels.length})</span>
      </Button>
      {open ? (
        <ManageLabelsModal
          open={open}
          onClose={() => setOpen(false)}
          workspaceId={workspaceId}
          projectId={projectId}
          labels={labels}
        />
      ) : null}
    </div>
  );
}