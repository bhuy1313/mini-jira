"use client";

import { useState } from "react";

import { LoginForm } from "@/features/auth/components/login-form";
import { RegisterForm } from "@/features/auth/components/register-form";
import { cn } from "@/lib/cn";

type AuthMode = "login" | "register";

const content: Record<AuthMode, { description: string; title: string }> = {
  login: {
    description: "Sign in to get back to your boards.",
    title: "Welcome back",
  },
  register: {
    description: "Set up a workspace and start tracking your work.",
    title: "Create your account",
  },
};

const tabs: Array<{ mode: AuthMode; label: string }> = [
  { mode: "login", label: "Sign in" },
  { mode: "register", label: "Create account" },
];

export function AuthSwitcher() {
  const [mode, setMode] = useState<AuthMode>("login");
  const activeContent = content[mode];

  return (
    <>
      <div
        aria-label="Authentication"
        role="group"
        className="mb-9 flex border-b border-rule"
      >
        {tabs.map((tab) => (
          <button
            key={tab.mode}
            type="button"
            aria-pressed={mode === tab.mode}
            onClick={() => setMode(tab.mode)}
            className={cn(
              "-mb-px border-b-2 px-4 pb-2.5 text-sm font-medium transition-colors",
              mode === tab.mode
                ? "border-primary text-primary-ink"
                : "border-transparent text-ink-faint hover:text-ink-soft",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {activeContent.title}
        </h1>
        <p className="mt-1.5 text-sm leading-6 text-ink-soft">
          {activeContent.description}
        </p>
      </div>

      <div className="mt-7">
        {mode === "login" ? <LoginForm /> : <RegisterForm />}
      </div>
    </>
  );
}