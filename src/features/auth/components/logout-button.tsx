"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { LogoutIcon } from "@/components/ui/icons";
import { Spinner } from "@/components/ui/spinner";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/cn";

export function LogoutButton({
  className,
  variant = "ghost",
  size = "sm",
  iconOnly = false,
  children,
}: {
  className?: string;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  iconOnly?: boolean;
  children?: React.ReactNode;
}) {
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function handleSignOut() {
    setIsSigningOut(true);
    try {
      const { error } = await authClient.signOut();
      if (error) return;
      router.replace("/auth");
      router.refresh();
    } finally {
      setIsSigningOut(false);
    }
  }

  if (iconOnly) {
    return (
      <button
        type="button"
        disabled={isSigningOut}
        onClick={handleSignOut}
        aria-label="Sign out"
        title="Sign out"
        className={cn(
          "grid size-8 shrink-0 place-items-center rounded-lg text-ink-soft hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 transition-colors disabled:opacity-50",
          className,
        )}
      >
        {isSigningOut ? (
          <Spinner className="size-4" />
        ) : (
          <LogoutIcon className="size-4" />
        )}
      </button>
    );
  }

  return (
    <Button
      variant={variant}
      size={size}
      disabled={isSigningOut}
      onClick={handleSignOut}
      className={className}
    >
      {isSigningOut ? "Signing out…" : children || "Sign out"}
    </Button>
  );
}