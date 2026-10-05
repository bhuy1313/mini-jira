import type { LabelRecord } from "@/features/labels/label-service";

/** Chip label màu — dùng trên task card và filter. Server-safe (không state). */
export function LabelChip({ label, onRemove }: { label: LabelRecord; onRemove?: () => void }) {
  return (
    <span
      className="inline-flex max-w-full items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium text-white"
      style={{ backgroundColor: label.color }}
      title={label.name}
    >
      <span className="truncate">{label.name}</span>
      {onRemove ? (
        <button
          type="button"
          aria-label={`Remove label ${label.name}`}
          onClick={onRemove}
          className="grid size-3.5 shrink-0 place-items-center rounded-full text-white/80 transition-colors hover:bg-black/10 hover:text-white"
        >
          <svg viewBox="0 0 24 24" className="size-2.5" fill="none" stroke="currentColor" strokeWidth={3} aria-hidden>
            <path d="m6 6 12 12M18 6 6 18" />
          </svg>
        </button>
      ) : null}
    </span>
  );
}