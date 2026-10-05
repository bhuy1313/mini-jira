"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Drawer({
  open,
  onClose,
  labelledBy,
  children,
  side = "right",
  className,
}: {
  open: boolean;
  onClose: () => void;
  labelledBy?: string;
  children: ReactNode;
  side?: "right" | "left";
  className?: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    panelRef.current?.focus();
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
      className="fixed inset-0 z-50 flex bg-ink/40 backdrop-blur-[2px] transition-opacity duration-200 animate-in fade-in"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        className={cn(
          "relative flex h-full w-full max-w-2xl flex-col bg-panel text-ink shadow-2xl border-rule transition-transform duration-300 ease-out outline-none",
          side === "right" ? "ml-auto border-l animate-in slide-in-from-right" : "mr-auto border-r animate-in slide-in-from-left",
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}
