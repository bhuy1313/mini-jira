"use client";

import { useState } from "react";

import {
  BellIcon,
  BoardsIcon,
  KeyIcon,
  LaptopIcon,
  SunIcon,
  UserIcon,
} from "@/components/ui/icons";
import { ThemeAppearanceSection } from "@/components/theme/theme-toggle";
import type { AccountOverview } from "@/features/account/account-service";
import { NotificationPreferencesForm } from "@/features/notifications/components/notification-preferences-form";
import { AccountHeader } from "@/features/account/components/account-header";
import { PasswordForm } from "@/features/account/components/password-form";
import { ProfileForm } from "@/features/account/components/profile-form";
import { SessionsList } from "@/features/account/components/sessions-list";
import { WorkspacesSummary } from "@/features/account/components/workspaces-summary";
import { cn } from "@/lib/cn";

type TabKey = "profile" | "appearance" | "notifications" | "security" | "sessions" | "workspaces";

export function AccountPageView({ overview }: { overview: AccountOverview }) {
  const [activeTab, setActiveTab] = useState<TabKey>("profile");

  const tabs: Array<{
    key: TabKey;
    label: string;
    icon: typeof UserIcon;
    badge?: number;
  }> = [
    { key: "profile", label: "Profile", icon: UserIcon },
    { key: "appearance", label: "Appearance", icon: SunIcon },
    { key: "notifications", label: "Notifications", icon: BellIcon },
    { key: "security", label: "Security & Password", icon: KeyIcon },
    {
      key: "sessions",
      label: "Active Sessions",
      icon: LaptopIcon,
      badge: overview.sessions.length,
    },
    {
      key: "workspaces",
      label: "My Workspaces",
      icon: BoardsIcon,
      badge: overview.workspaces.length,
    },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <AccountHeader user={overview.user} />

      {/* Modern Tabs navigation */}
      <div className="overflow-x-auto pb-1">
        <div
          className="inline-flex gap-1.5 rounded-xl border border-rule bg-panel p-1.5 shadow-2xs"
          role="tablist"
        >
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-medium transition-all whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                  isActive
                    ? "bg-primary text-white shadow-2xs font-semibold"
                    : "text-ink-soft hover:bg-paper hover:text-ink",
                )}
              >
                <Icon
                  className={cn(
                    "size-3.5 shrink-0",
                    isActive ? "text-white" : "text-ink-faint",
                  )}
                />
                <span>{tab.label}</span>
                {tab.badge !== undefined && (
                  <span
                    className={cn(
                      "grid min-w-4 px-1 place-items-center rounded-full text-[10px] font-bold leading-none py-0.5",
                      isActive
                        ? "bg-white/20 text-white"
                        : "bg-panel-muted text-ink-faint border border-rule",
                    )}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Panels */}
      <div>
        {activeTab === "profile" && <ProfileForm user={overview.user} />}
        {activeTab === "appearance" && <ThemeAppearanceSection />}
        {activeTab === "notifications" && (
          <NotificationPreferencesForm
            initialPreferences={
              overview.notificationPreferences ?? {
                TaskAssigned: true,
                NewComment: true,
                WorkspaceInvited: true,
                ProjectArchived: true,
              }
            }
          />
        )}
        {activeTab === "security" && <PasswordForm />}
        {activeTab === "sessions" && <SessionsList sessions={overview.sessions} />}
        {activeTab === "workspaces" && (
          <WorkspacesSummary workspaces={overview.workspaces} />
        )}
      </div>
    </div>
  );
}
