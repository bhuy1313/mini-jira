"use client";

import * as Dialog from "@radix-ui/react-dialog";
import type { ReactNode } from "react";

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
  // Non-modal: the slide-over preserves board context — background stays
  // interactive (same as the pre-Radix drawer). A modal dialog would mark
  // the board aria-hidden and break workflows that read board state while
  // the drawer is open. Escape/backdrop-close still work via onOpenChange.
  return (
    <Dialog.Root
      modal={false}
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/40 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=open]:fade-in data-[state=closed]:animate-out data-[state=closed]:fade-out" />
        <Dialog.Content
          aria-labelledby={labelledBy}
          className={cn(
            "fixed inset-y-0 z-50 flex h-full w-full max-w-2xl flex-col bg-panel text-ink shadow-2xl outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out",
            side === "right"
              ? "right-0 border-l border-rule data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right"
              : "left-0 border-r border-rule data-[state=open]:slide-in-from-left data-[state=closed]:slide-out-to-left",
            className,
          )}
        >
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
