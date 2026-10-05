"use client";

import { useState, useRef, useEffect } from "react";
import { LaptopIcon, MoonIcon, SunIcon, CheckIcon } from "@/components/ui/icons";
import { useTheme, type Theme } from "@/components/theme/theme-provider";
import { cn } from "@/lib/cn";

/** Quick 1-click or dropdown Theme Toggle for Header & Topbars */
export function ThemeQuickToggle() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open]);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label={`Toggle theme (Current: ${theme})`}
        title={`Theme: ${theme}`}
        className="grid size-8 place-items-center rounded-md border border-rule bg-paper text-ink-soft transition-colors hover:bg-panel hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        {resolvedTheme === "dark" ? (
          <MoonIcon className="size-4 text-primary" />
        ) : (
          <SunIcon className="size-4 text-amber-500" />
        )}
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Select theme"
          className="absolute right-0 mt-1.5 w-36 origin-top-right rounded-lg border border-rule bg-panel p-1 shadow-lg ring-1 ring-black/5 z-50 animate-in fade-in zoom-in-95 duration-100"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setTheme("light");
              setOpen(false);
            }}
            className={cn(
              "flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
              theme === "light"
                ? "bg-primary-soft text-primary-ink font-semibold"
                : "text-ink-soft hover:bg-paper hover:text-ink",
            )}
          >
            <span className="flex items-center gap-2">
              <SunIcon className="size-3.5 text-amber-500" />
              Light
            </span>
            {theme === "light" && <CheckIcon className="size-3 text-primary" />}
          </button>

          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setTheme("dark");
              setOpen(false);
            }}
            className={cn(
              "flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
              theme === "dark"
                ? "bg-primary-soft text-primary-ink font-semibold"
                : "text-ink-soft hover:bg-paper hover:text-ink",
            )}
          >
            <span className="flex items-center gap-2">
              <MoonIcon className="size-3.5 text-primary" />
              Dark
            </span>
            {theme === "dark" && <CheckIcon className="size-3 text-primary" />}
          </button>

          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setTheme("system");
              setOpen(false);
            }}
            className={cn(
              "flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
              theme === "system"
                ? "bg-primary-soft text-primary-ink font-semibold"
                : "text-ink-soft hover:bg-paper hover:text-ink",
            )}
          >
            <span className="flex items-center gap-2">
              <LaptopIcon className="size-3.5 text-ink-faint" />
              System
            </span>
            {theme === "system" && <CheckIcon className="size-3 text-primary" />}
          </button>
        </div>
      )}
    </div>
  );
}

/** Rich Appearance Settings Card for Account Page (`/account`) */
export function ThemeAppearanceSection() {
  const { theme, setTheme } = useTheme();

  const options: {
    id: Theme;
    name: string;
    description: string;
    icon: typeof SunIcon;
    previewBg: string;
    previewBorder: string;
    accentBg: string;
  }[] = [
    {
      id: "light",
      name: "Light Mode",
      description: "Crisp, bright palette with high contrast for daytime work.",
      icon: SunIcon,
      previewBg: "bg-[#f4faf8]",
      previewBorder: "border-[#ddebe9]",
      accentBg: "bg-[#0f766e]",
    },
    {
      id: "dark",
      name: "Dark Mode",
      description: "Deep charcoal palette designed to reduce eye strain at night.",
      icon: MoonIcon,
      previewBg: "bg-[#0b1514]",
      previewBorder: "border-[#1d302d]",
      accentBg: "bg-[#2dd4bf]",
    },
    {
      id: "system",
      name: "System Default",
      description: "Automatically match your operating system display theme.",
      icon: LaptopIcon,
      previewBg: "bg-gradient-to-r from-[#f4faf8] via-[#e7efed] to-[#0b1514]",
      previewBorder: "border-rule",
      accentBg: "bg-primary",
    },
  ];

  return (
    <section
      aria-label="Theme appearance settings"
      className="rounded-xl border border-rule bg-panel p-5 shadow-xs transition-shadow"
    >
      <div className="flex flex-col gap-1">
        <h2 className="text-sm font-semibold text-ink flex items-center gap-2">
          <span>Appearance & Theme</span>
        </h2>
        <p className="text-xs text-ink-soft">
          Customize how Mini Jira looks for your personal workspace session.
        </p>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3" role="radiogroup" aria-label="Theme options">
        {options.map((opt) => {
          const isSelected = theme === opt.id;
          const Icon = opt.icon;

          return (
            <button
              key={opt.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => setTheme(opt.id)}
              className={cn(
                "group relative flex flex-col items-start rounded-lg border p-3.5 text-left transition-all",
                isSelected
                  ? "border-primary bg-primary-soft/30 ring-2 ring-primary ring-offset-1"
                  : "border-rule bg-paper/50 hover:border-rule-strong hover:bg-paper",
              )}
            >
              {/* Visual preview box */}
              <div
                className={cn(
                  "relative mb-3 flex h-20 w-full overflow-hidden rounded-md border p-2",
                  opt.previewBg,
                  opt.previewBorder,
                )}
              >
                {/* Mock UI elements */}
                <div className="flex flex-col gap-1.5 w-full">
                  <div className="flex items-center justify-between">
                    <div className={cn("h-2 w-10 rounded-xs", opt.accentBg)} />
                    <div className="h-2 w-4 rounded-xs bg-ink-faint/30" />
                  </div>
                  <div className="h-6 w-full rounded border border-rule/50 bg-panel/70 p-1">
                    <div className="h-1.5 w-16 rounded-xs bg-ink/40" />
                  </div>
                </div>

                {isSelected && (
                  <div className="absolute right-2 bottom-2 grid size-5 place-items-center rounded-full bg-primary text-white shadow-xs">
                    <CheckIcon className="size-3" />
                  </div>
                )}
              </div>

              <div className="flex w-full items-center justify-between">
                <div className="flex items-center gap-1.5 font-medium text-xs text-ink">
                  <Icon className="size-3.5 text-ink-soft group-hover:text-ink" />
                  <span>{opt.name}</span>
                </div>
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-ink-faint">
                {opt.description}
              </p>
            </button>
          );
        })}
      </div>
    </section>
  );
}
