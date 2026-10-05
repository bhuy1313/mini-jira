"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "@/components/theme/theme-provider";
import {
  SearchIcon,
  CloseIcon,
  SettingsIcon,
  UsersIcon,
  BarChartIcon,
  BoardsIcon,
  SunIcon,
  MoonIcon,
  LaptopIcon,
} from "@/components/ui/icons";
import { cn } from "@/lib/cn";

interface CommandItem {
  id: string;
  title: string;
  category: "Navigation" | "Actions" | "Theme";
  icon: React.ReactNode;
  perform: () => void;
  shortcut?: string;
}

export function CommandPalette({ workspaceId }: { workspaceId?: string }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const router = useRouter();
  const { setTheme } = useTheme();

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === "Escape" && open) {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  const items: CommandItem[] = useMemo(() => {
    const list: CommandItem[] = [
      {
        id: "nav-workspaces",
        title: "Go to Workspaces Overview",
        category: "Navigation",
        icon: <BoardsIcon className="size-4 text-primary" />,
        perform: () => router.push("/workspaces"),
        shortcut: "G W",
      },
      {
        id: "nav-account",
        title: "Go to Account Settings",
        category: "Navigation",
        icon: <SettingsIcon className="size-4 text-ink-soft" />,
        perform: () => router.push("/account"),
        shortcut: "G A",
      },
    ];

    if (workspaceId) {
      list.push(
        {
          id: "nav-projects",
          title: "Go to Projects",
          category: "Navigation",
          icon: <BoardsIcon className="size-4 text-primary" />,
          perform: () => router.push(`/workspaces/${workspaceId}/projects`),
          shortcut: "G P",
        },
        {
          id: "nav-members",
          title: "Go to Workspace Members",
          category: "Navigation",
          icon: <UsersIcon className="size-4 text-primary" />,
          perform: () => router.push(`/workspaces/${workspaceId}/members`),
          shortcut: "G M",
        },
        {
          id: "nav-analytics",
          title: "Go to Analytics & Velocity",
          category: "Navigation",
          icon: <BarChartIcon className="size-4 text-primary" />,
          perform: () => router.push(`/workspaces/${workspaceId}/analytics`),
          shortcut: "G V",
        },
        {
          id: "nav-ws-settings",
          title: "Go to Workspace Settings",
          category: "Navigation",
          icon: <SettingsIcon className="size-4 text-ink-soft" />,
          perform: () => router.push(`/workspaces/${workspaceId}/settings`),
          shortcut: "G S",
        },
      );
    }

    list.push(
      {
        id: "theme-light",
        title: "Switch to Light Theme",
        category: "Theme",
        icon: <SunIcon className="size-4 text-amber-500" />,
        perform: () => setTheme("light"),
      },
      {
        id: "theme-dark",
        title: "Switch to Dark Theme",
        category: "Theme",
        icon: <MoonIcon className="size-4 text-primary" />,
        perform: () => setTheme("dark"),
      },
      {
        id: "theme-system",
        title: "Use System Theme",
        category: "Theme",
        icon: <LaptopIcon className="size-4 text-ink-faint" />,
        perform: () => setTheme("system"),
      },
    );

    return list;
  }, [workspaceId, router, setTheme]);

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) =>
      item.title.toLowerCase().includes(q) || item.category.toLowerCase().includes(q)
    );
  }, [items, query]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (filteredItems.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % filteredItems.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredItems.length) % filteredItems.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const current = filteredItems[selectedIndex];
      if (current) {
        current.perform();
        setOpen(false);
      }
    }
  };

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
      className="fixed inset-0 z-50 flex items-start justify-center bg-ink/40 p-4 pt-[15vh] backdrop-blur-[2px] animate-in fade-in duration-150"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) setOpen(false);
      }}
    >
      <div className="flex w-full max-w-lg flex-col overflow-hidden rounded-xl border border-rule bg-panel text-ink shadow-2xl animate-in zoom-in-95 duration-150">
        <div className="flex items-center border-b border-rule px-4 py-3">
          <SearchIcon className="size-4 shrink-0 text-ink-faint mr-2.5" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a command or search destination... (e.g. projects, account)"
            className="w-full bg-transparent text-sm text-ink placeholder:text-ink-faint focus:outline-none"
          />
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close command palette"
            className="ml-2 rounded p-1 text-ink-faint hover:bg-paper hover:text-ink"
          >
            <CloseIcon className="size-4" />
          </button>
        </div>

        <div className="max-h-72 overflow-y-auto p-2">
          {filteredItems.length === 0 ? (
            <div className="p-6 text-center text-xs text-ink-faint">
              No matching commands found.
            </div>
          ) : (
            <ul className="space-y-1">
              {filteredItems.map((item, idx) => {
                const isSelected = idx === selectedIndex;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => {
                        item.perform();
                        setOpen(false);
                      }}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={cn(
                        "flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs font-medium transition-colors",
                        isSelected
                          ? "bg-primary-soft text-primary-ink"
                          : "text-ink hover:bg-paper",
                      )}
                    >
                      <div className="flex items-center gap-2.5">
                        {item.icon}
                        <span>{item.title}</span>
                      </div>
                      {item.shortcut ? (
                        <kbd className="rounded border border-rule bg-paper px-1.5 py-0.5 text-[10px] font-mono text-ink-faint">
                          {item.shortcut}
                        </kbd>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-rule bg-paper/50 px-4 py-2 text-[11px] text-ink-faint">
          <div className="flex items-center gap-2">
            <span>Navigation:</span>
            <kbd className="rounded bg-paper px-1 border border-rule">↑</kbd>
            <kbd className="rounded bg-paper px-1 border border-rule">↓</kbd>
            <span>Select:</span>
            <kbd className="rounded bg-paper px-1 border border-rule">↵</kbd>
          </div>
          <div>
            <span>Close:</span>
            <kbd className="ml-1 rounded bg-paper px-1 border border-rule">Esc</kbd>
          </div>
        </div>
      </div>
    </div>
  );
}

export function CommandPaletteTrigger() {
  return (
    <button
      type="button"
      onClick={() => {
        window.dispatchEvent(
          new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true })
        );
      }}
      className="hidden sm:flex items-center gap-2 rounded-md border border-rule bg-paper px-2.5 py-1.5 text-xs text-ink-faint transition-colors hover:border-rule-strong hover:text-ink"
      aria-label="Quick search (Ctrl+K or Cmd+K)"
      title="Quick search (Ctrl+K)"
    >
      <SearchIcon className="size-3.5 text-ink-faint" />
      <span>Search or jump to...</span>
      <kbd className="ml-2 rounded border border-rule-strong bg-panel px-1.5 py-0.5 text-[10px] font-mono">
        ⌘K
      </kbd>
    </button>
  );
}
