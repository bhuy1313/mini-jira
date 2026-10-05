"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

import { BoardsIcon, SettingsIcon } from "@/components/ui/icons";
import { LogoutButton } from "@/features/auth/components/logout-button";
import { cn } from "@/lib/cn";

export function UserMenu({
  userName,
  userEmail,
  userInitial,
  variant = "sidebar",
}: {
  userName?: string | null;
  userEmail?: string | null;
  userInitial: string;
  variant?: "sidebar" | "header";
}) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        className={cn(
          "flex items-center gap-2 rounded-lg p-1.5 transition-colors focus:outline-none focus:ring-2 focus:ring-primary",
          variant === "sidebar"
            ? "w-full hover:bg-paper"
            : "hover:bg-panel text-ink-soft hover:text-ink",
        )}
      >
        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary-soft text-xs font-bold text-primary-ink ring-1 ring-primary/20">
          {userInitial}
        </span>
        {variant === "sidebar" && (
          <div className="min-w-0 flex-1 text-left">
            <p className="truncate text-xs font-medium text-ink">{userName || "My Account"}</p>
            {userEmail && <p className="truncate text-[10px] text-ink-faint">{userEmail}</p>}
          </div>
        )}
      </button>

      {isOpen && (
        <div
          role="menu"
          className={cn(
            "absolute z-50 w-56 rounded-lg border border-rule bg-panel p-1.5 shadow-lg animate-in fade-in zoom-in-95",
            variant === "sidebar" ? "bottom-full left-0 mb-2" : "right-0 top-full mt-2",
          )}
        >
          <div className="border-b border-rule px-3 py-2">
            <p className="truncate text-xs font-semibold text-ink">{userName || "User"}</p>
            {userEmail && <p className="truncate text-[11px] text-ink-soft">{userEmail}</p>}
          </div>

          <div className="py-1">
            <Link
              href="/account"
              onClick={() => setIsOpen(false)}
              role="menuitem"
              className="flex items-center gap-2.5 rounded-md px-3 py-2 text-xs font-medium text-ink transition-colors hover:bg-paper"
            >
              <SettingsIcon className="size-4 text-ink-soft" />
              <span>Account Settings</span>
            </Link>

            <Link
              href="/workspaces"
              onClick={() => setIsOpen(false)}
              role="menuitem"
              className="flex items-center gap-2.5 rounded-md px-3 py-2 text-xs font-medium text-ink transition-colors hover:bg-paper"
            >
              <BoardsIcon className="size-4 text-ink-soft" />
              <span>All Workspaces</span>
            </Link>
          </div>

          <div className="border-t border-rule pt-1">
            <div className="px-1 py-1">
              <LogoutButton />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
