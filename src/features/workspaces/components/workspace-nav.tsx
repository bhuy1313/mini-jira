"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  BarChartIcon,
  BoardsIcon,
  ClockIcon,
  ColumnsIcon,
  SettingsIcon,
  UsersIcon,
} from "@/components/ui/icons";
import { cn } from "@/lib/cn";

export function WorkspaceNav({
  workspaceId,
  variant = "horizontal",
}: {
  workspaceId: string;
  variant?: "horizontal" | "vertical";
}) {
  const pathname = usePathname();

  const items = [
    { href: `/workspaces/${workspaceId}`, label: "Overview", icon: ColumnsIcon },
    { href: `/workspaces/${workspaceId}/projects`, label: "Projects", icon: BoardsIcon },
    { href: `/workspaces/${workspaceId}/members`, label: "Members", icon: UsersIcon },
    { href: `/workspaces/${workspaceId}/timesheet`, label: "Timesheet", icon: ClockIcon },
    { href: `/workspaces/${workspaceId}/analytics`, label: "Analytics", icon: BarChartIcon },
    { href: `/workspaces/${workspaceId}/settings`, label: "Settings", icon: SettingsIcon },
  ];

  return (
    <nav
      className={cn(
        "flex",
        variant === "horizontal"
          ? "items-center gap-1 overflow-x-auto text-sm"
          : "flex-col gap-1 text-xs",
      )}
    >
      {items.map((item) => {
        const active = pathname === item.href || (item.href !== `/workspaces/${workspaceId}` && pathname.startsWith(item.href));
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group inline-flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2 font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
              variant === "vertical" &&
                active &&
                "bg-primary/10 text-primary font-semibold shadow-2xs",
              variant === "vertical" &&
                !active &&
                "text-ink-soft hover:bg-paper hover:text-ink",
              variant === "horizontal" &&
                active &&
                "border-b-2 border-primary text-primary-ink font-semibold",
              variant === "horizontal" &&
                !active &&
                "text-ink-soft hover:text-ink",
            )}
          >
            <Icon
              className={cn(
                "size-4 shrink-0 transition-colors",
                active ? "text-primary" : "text-ink-faint group-hover:text-ink",
              )}
            />
            <span className="truncate">{item.label}</span>
            {active && variant === "vertical" ? (
              <span
                aria-hidden
                className="ml-auto size-1.5 rounded-full bg-primary"
              />
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}