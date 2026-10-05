import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

type Tone = "neutral" | "done" | "urgent" | "danger" | "info";

const TONES: Record<Tone, string> = {
  neutral: "border-rule bg-paper text-ink-soft",
  done: "border-done/25 bg-done-soft text-done",
  urgent: "border-urgent/25 bg-urgent-soft text-urgent",
  danger: "border-danger/25 bg-danger-soft text-danger",
  info: "border-info/25 bg-info-soft text-info",
};

export function Badge({
  tone = "neutral",
  className,
  dot,
  children,
}: {
  tone?: Tone;
  className?: string;
  dot?: boolean;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium",
        TONES[tone],
        className,
      )}
    >
      {dot ? (
        <span aria-hidden className="inline-block size-1.5 rounded-full bg-current" />
      ) : null}
      {children}
    </span>
  );
}