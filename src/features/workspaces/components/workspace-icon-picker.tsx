"use client";

import { useMemo, useState } from "react";

import { CloseIcon, SearchIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import {
  getWorkspaceIcon,
  WORKSPACE_ICON_CATEGORIES,
  WORKSPACE_ICONS,
} from "@/features/workspaces/workspace-icons";

export interface WorkspaceIconPickerProps {
  selectedIconId: string | null;
  workspaceName?: string;
  onSelect: (iconId: string | null) => void;
}

export function WorkspaceIconPicker({
  selectedIconId,
  workspaceName = "Workspace",
  onSelect,
}: WorkspaceIconPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const selectedDef = getWorkspaceIcon(selectedIconId);
  const initial = workspaceName?.trim() ? workspaceName.trim().charAt(0).toUpperCase() : "W";

  const filteredIcons = useMemo(() => {
    return WORKSPACE_ICONS.filter((item) => {
      const matchCat = activeCategory === "all" || item.category === activeCategory;
      const matchQuery =
        !searchQuery.trim() ||
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.id.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchQuery;
    });
  }, [activeCategory, searchQuery]);

  return (
    <div className="space-y-2">
      <label className="block text-xs font-semibold text-ink">
        Workspace Avatar / Icon
      </label>

      <div className="flex items-center gap-3">
        {/* Trigger Button showing current icon */}
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          aria-expanded={isOpen}
          aria-label="Choose workspace icon"
          className="group flex items-center gap-3 rounded-xl border border-rule bg-paper p-2 text-left transition-all hover:border-primary/50 hover:bg-panel shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          {selectedDef ? (
            <span
              className={cn(
                "grid size-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br border shadow-2xs text-2xl transition-transform group-hover:scale-105",
                selectedDef.bgGradient,
              )}
            >
              {selectedDef.emoji}
            </span>
          ) : (
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary-soft text-lg font-bold text-primary-ink border border-primary/20 shadow-2xs transition-transform group-hover:scale-105">
              {initial}
            </span>
          )}

          <div className="pr-2">
            <p className="text-xs font-semibold text-ink">
              {selectedDef ? selectedDef.name : "Default Letter Avatar"}
            </p>
            <p className="text-[11px] text-primary hover:underline mt-0.5">
              {isOpen ? "Close icon picker" : "Change icon…"}
            </p>
          </div>
        </button>

        {selectedIconId && (
          <button
            type="button"
            onClick={() => onSelect(null)}
            className="text-[11px] text-ink-soft hover:text-ink underline"
          >
            Reset to letter
          </button>
        )}
      </div>

      {/* Hidden input to pass value in standard HTML forms */}
      <input type="hidden" name="icon" value={selectedIconId || ""} />

      {/* Dropdown / Accordion Icon Selector Grid */}
      {isOpen && (
        <div className="mt-3 rounded-xl border border-rule bg-panel p-3.5 shadow-md space-y-3">
          {/* Category Tabs & Search Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 border-b border-rule/70 pb-3">
            <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
              <button
                type="button"
                onClick={() => setActiveCategory("all")}
                className={cn(
                  "rounded-lg px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap",
                  activeCategory === "all"
                    ? "bg-primary text-white font-semibold"
                    : "text-ink-soft hover:bg-paper hover:text-ink",
                )}
              >
                All ({WORKSPACE_ICONS.length})
              </button>
              {WORKSPACE_ICON_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setActiveCategory(cat.id)}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap",
                    activeCategory === cat.id
                      ? "bg-primary text-white font-semibold"
                      : "text-ink-soft hover:bg-paper hover:text-ink",
                  )}
                >
                  <span>{cat.icon}</span>
                  <span>{cat.label}</span>
                </button>
              ))}
            </div>

            <div className="relative shrink-0 sm:w-44">
              <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-3 -translate-y-1/2 text-ink-faint" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter icons…"
                className="h-7 w-full rounded-md border border-rule bg-paper pl-7 pr-6 text-xs text-ink placeholder:text-ink-faint focus:border-primary focus:outline-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-faint hover:text-ink"
                >
                  <CloseIcon className="size-3" />
                </button>
              )}
            </div>
          </div>

          {/* Icons Grid */}
          <div className="max-h-52 overflow-y-auto pr-1">
            <div className="grid grid-cols-6 sm:grid-cols-8 gap-2">
              {/* Option 0: Initial Letter Fallback */}
              <button
                type="button"
                onClick={() => {
                  onSelect(null);
                  setIsOpen(false);
                }}
                title="Default initial letter"
                className={cn(
                  "flex flex-col items-center justify-center p-2 rounded-xl border transition-all text-center group",
                  selectedIconId === null
                    ? "border-primary bg-primary/10 ring-2 ring-primary/40"
                    : "border-rule/70 bg-paper hover:border-primary/40 hover:bg-panel hover:scale-105",
                )}
              >
                <span className="grid size-9 place-items-center rounded-lg bg-primary-soft text-sm font-bold text-primary-ink border border-primary/20">
                  {initial}
                </span>
                <span className="mt-1 truncate text-[10px] text-ink-faint group-hover:text-ink">
                  Letter
                </span>
              </button>

              {/* Curated Icons */}
              {filteredIcons.map((item) => {
                const isSelected = selectedIconId === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      onSelect(item.id);
                      setIsOpen(false);
                    }}
                    title={item.name}
                    className={cn(
                      "flex flex-col items-center justify-center p-2 rounded-xl border transition-all text-center group",
                      isSelected
                        ? "border-primary bg-primary/10 ring-2 ring-primary/40"
                        : "border-rule/70 bg-paper hover:border-primary/40 hover:bg-panel hover:scale-105",
                    )}
                  >
                    <span
                      className={cn(
                        "grid size-9 place-items-center rounded-lg bg-gradient-to-br border text-xl shadow-2xs select-none",
                        item.bgGradient,
                      )}
                    >
                      {item.emoji}
                    </span>
                    <span className="mt-1 truncate max-w-full text-[10px] text-ink-soft group-hover:text-ink">
                      {item.name.split(" ")[0]}
                    </span>
                  </button>
                );
              })}
            </div>

            {filteredIcons.length === 0 && (
              <p className="py-6 text-center text-xs text-ink-faint">
                No icons found matching &ldquo;{searchQuery}&rdquo;
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
