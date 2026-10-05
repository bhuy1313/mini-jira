"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { CloseIcon, SearchIcon } from "@/components/ui/icons";
import { Spinner } from "@/components/ui/spinner";
import { PRIORITIES } from "@/features/authorization/permissions";
import type { LabelRecord } from "@/features/labels/label-service";
import type { StatusRecord } from "@/features/statuses/status-service";
import type { TaskFilterInput } from "@/features/tasks/task-service";
import type { MemberWithUser } from "@/features/workspaces/workspace-service";
import { PRIORITY_LABEL } from "@/features/tasks/task-meta";

export function TaskFilterToolbar({
  statuses = [],
  members,
  projectLabels,
  activeFilters,
}: {
  statuses?: StatusRecord[];
  members: MemberWithUser[];
  projectLabels: LabelRecord[];
  activeFilters: TaskFilterInput;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const searchInputRef = useRef<HTMLInputElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Render-phase sync pattern for search term from URL query prop
  const currentQuery = activeFilters.query ?? "";
  const [prevQueryProp, setPrevQueryProp] = useState(currentQuery);
  const [searchTerm, setSearchTerm] = useState(currentQuery);

  if (prevQueryProp !== currentQuery) {
    setPrevQueryProp(currentQuery);
    setSearchTerm(currentQuery);
  }

  const updateParam = useCallback(
    (name: string, value: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value && value.trim().length > 0) {
        params.set(name, value.trim());
      } else {
        params.delete(name);
      }
      startTransition(() => {
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
      });
    },
    [pathname, router, searchParams],
  );

  const handleSearchChange = (val: string) => {
    setSearchTerm(val);
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      updateParam("q", val);
    }, 250);
  };

  const handleClearSearch = () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    setSearchTerm("");
    updateParam("q", null);
    searchInputRef.current?.focus();
  };

  const clearFilters = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    setSearchTerm("");
    startTransition(() => {
      router.replace(pathname, { scroll: false });
    });
  }, [pathname, router]);

  // Keyboard shortcut: Press "/" to focus search input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === "/" &&
        !["INPUT", "TEXTAREA", "SELECT"].includes((e.target as HTMLElement)?.tagName) &&
        !(e.target as HTMLElement)?.isContentEditable
      ) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const hasActiveFilters = Boolean(
    activeFilters.query ||
      activeFilters.statusId ||
      activeFilters.priority ||
      activeFilters.assigneeId ||
      activeFilters.labelId,
  );

  return (
    <div className="flex flex-wrap lg:flex-nowrap items-center gap-2 rounded-xl border border-rule bg-panel/90 p-2 shadow-2xs backdrop-blur-xs">
      {/* Search Input Box */}
      <div className="relative min-w-[200px] flex-1">
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-faint transition-colors" />
        <input
          ref={searchInputRef}
          type="text"
          value={searchTerm}
          placeholder="Search tasks… (Press /)"
          aria-label="Search tasks"
          onChange={(e) => handleSearchChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              handleClearSearch();
              e.currentTarget.blur();
            }
          }}
          className="h-9 w-full rounded-lg border border-rule bg-paper/70 pl-9 pr-10 text-xs sm:text-sm text-ink placeholder:text-ink-faint transition-all hover:border-rule-strong hover:bg-paper focus:border-primary focus:bg-paper focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs"
        />

        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {isPending ? (
            <Spinner className="size-3.5 text-primary" />
          ) : searchTerm ? (
            <button
              type="button"
              onClick={handleClearSearch}
              className="grid size-5 place-items-center rounded-sm text-ink-faint transition-colors hover:bg-panel-muted hover:text-ink"
              aria-label="Clear search text"
              title="Clear search (Esc)"
            >
              <CloseIcon className="size-3.5" />
            </button>
          ) : (
            <kbd className="pointer-events-none hidden sm:inline-block rounded border border-rule bg-panel-muted px-1.5 py-0.5 text-[10px] font-mono font-medium text-ink-faint shadow-2xs">
              /
            </kbd>
          )}
        </div>
      </div>

      {/* Filter Dropdowns - Inline Group */}
      <div className="flex flex-wrap items-center gap-1.5 shrink-0">
        {/* Status Filter */}
        <select
          defaultValue={activeFilters.statusId ?? ""}
          aria-label="Filter by status"
          onChange={(e) => updateParam("status", e.target.value || null)}
          className="h-9 w-auto shrink-0 cursor-pointer rounded-lg border border-rule bg-paper/70 px-2.5 text-xs font-medium text-ink hover:border-rule-strong hover:bg-paper focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs"
        >
          <option value="">All statuses</option>
          {statuses.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>

        {/* Priority Filter */}
        <select
          defaultValue={activeFilters.priority ?? ""}
          aria-label="Filter by priority"
          onChange={(e) => updateParam("priority", e.target.value || null)}
          className="h-9 w-auto shrink-0 cursor-pointer rounded-lg border border-rule bg-paper/70 px-2.5 text-xs font-medium text-ink hover:border-rule-strong hover:bg-paper focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs"
        >
          <option value="">All priorities</option>
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {PRIORITY_LABEL[p]}
            </option>
          ))}
        </select>

        {/* Assignee Filter */}
        <select
          defaultValue={activeFilters.assigneeId ?? ""}
          aria-label="Filter by assignee"
          onChange={(e) => updateParam("assignee", e.target.value || null)}
          className="h-9 w-auto shrink-0 cursor-pointer rounded-lg border border-rule bg-paper/70 px-2.5 text-xs font-medium text-ink hover:border-rule-strong hover:bg-paper focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs"
        >
          <option value="">All assignees</option>
          <option value="unassigned">Unassigned</option>
          {members.map((m) => (
            <option key={m.userId} value={m.userId}>
              {m.name}
            </option>
          ))}
        </select>

        {/* Label Filter */}
        <select
          defaultValue={activeFilters.labelId ?? ""}
          aria-label="Filter by label"
          onChange={(e) => updateParam("label", e.target.value || null)}
          className="h-9 w-auto shrink-0 cursor-pointer rounded-lg border border-rule bg-paper/70 px-2.5 text-xs font-medium text-ink hover:border-rule-strong hover:bg-paper focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs"
        >
          <option value="">All labels</option>
          {projectLabels.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>

        {/* Clear Filters Button */}
        {hasActiveFilters ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            disabled={isPending}
            className="h-9 shrink-0 px-2.5 text-xs font-medium text-ink-soft hover:text-ink hover:bg-panel-muted"
            aria-label="Clear filters"
          >
            Clear filters
          </Button>
        ) : null}
      </div>
    </div>
  );
}