"use client";

import { useState, useTransition } from "react";

import { CheckIcon } from "@/components/ui/icons";
import { changePasswordAction } from "@/features/account/actions";
import { cn } from "@/lib/cn";

export function PasswordForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [revokeOtherSessions, setRevokeOtherSessions] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const lengthValid = newPassword.length >= 8 && newPassword.length <= 128;
  const uppercaseValid = /[A-Z]/.test(newPassword);
  const lowercaseValid = /[a-z]/.test(newPassword);
  const digitValid = /\d/.test(newPassword);
  const matchValid = newPassword.length > 0 && newPassword === confirmPassword;

  const isFormValid =
    currentPassword.length > 0 &&
    lengthValid &&
    uppercaseValid &&
    lowercaseValid &&
    digitValid &&
    matchValid;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!isFormValid) {
      setError("Please ensure all password requirements are met and passwords match.");
      return;
    }

    startTransition(async () => {
      const res = await changePasswordAction({
        currentPassword,
        newPassword,
        confirmPassword,
        revokeOtherSessions,
      });

      if (!res.success) {
        setError(res.error || "Failed to change password");
      } else {
        setSuccess("Password changed successfully!");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setRevokeOtherSessions(false);
      }
    });
  };

  return (
    <div className="rounded-lg border border-rule bg-panel p-6 shadow-xs">
      <div className="border-b border-rule pb-4">
        <h2 className="text-base font-semibold text-ink">Security & Password</h2>
        <p className="mt-1 text-xs text-ink-soft">
          Change your account password. Choose a strong password to keep your account secure.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mt-6 space-y-6">
        {error && (
          <div
            role="alert"
            className="rounded-md border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300"
          >
            {error}
          </div>
        )}

        {success && (
          <div
            role="status"
            className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300"
          >
            <CheckIcon className="size-4 shrink-0 text-emerald-600" />
            <span>{success}</span>
          </div>
        )}

        <div className="max-w-md space-y-4">
          <div>
            <label htmlFor="current-password" className="block text-xs font-medium text-ink">
              Current Password <span className="text-rose-500">*</span>
            </label>
            <input
              id="current-password"
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Enter your current password"
              className="mt-1.5 w-full rounded-md border border-rule bg-paper px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div>
            <label htmlFor="new-password" className="block text-xs font-medium text-ink">
              New Password <span className="text-rose-500">*</span>
            </label>
            <input
              id="new-password"
              type="password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter your new password"
              className="mt-1.5 w-full rounded-md border border-rule bg-paper px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div>
            <label htmlFor="confirm-password" className="block text-xs font-medium text-ink">
              Confirm New Password <span className="text-rose-500">*</span>
            </label>
            <input
              id="confirm-password"
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter your new password"
              className="mt-1.5 w-full rounded-md border border-rule bg-paper px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Password policy checklist */}
          <div className="rounded-md border border-rule bg-paper p-3.5">
            <p className="text-[11px] font-medium text-ink">Password Requirements:</p>
            <ul className="mt-2 space-y-1.5 text-xs">
              <li
                className={cn(
                  "flex items-center gap-2 transition-colors",
                  lengthValid ? "text-emerald-600 dark:text-emerald-400" : "text-ink-faint",
                )}
              >
                <span
                  className={cn(
                    "grid size-4 place-items-center rounded-full text-[10px]",
                    lengthValid ? "bg-emerald-100 text-emerald-700" : "bg-panel text-ink-faint",
                  )}
                >
                  ✓
                </span>
                <span>8 to 128 characters</span>
              </li>
              <li
                className={cn(
                  "flex items-center gap-2 transition-colors",
                  uppercaseValid ? "text-emerald-600 dark:text-emerald-400" : "text-ink-faint",
                )}
              >
                <span
                  className={cn(
                    "grid size-4 place-items-center rounded-full text-[10px]",
                    uppercaseValid ? "bg-emerald-100 text-emerald-700" : "bg-panel text-ink-faint",
                  )}
                >
                  ✓
                </span>
                <span>At least one uppercase letter (A–Z)</span>
              </li>
              <li
                className={cn(
                  "flex items-center gap-2 transition-colors",
                  lowercaseValid ? "text-emerald-600 dark:text-emerald-400" : "text-ink-faint",
                )}
              >
                <span
                  className={cn(
                    "grid size-4 place-items-center rounded-full text-[10px]",
                    lowercaseValid ? "bg-emerald-100 text-emerald-700" : "bg-panel text-ink-faint",
                  )}
                >
                  ✓
                </span>
                <span>At least one lowercase letter (a–z)</span>
              </li>
              <li
                className={cn(
                  "flex items-center gap-2 transition-colors",
                  digitValid ? "text-emerald-600 dark:text-emerald-400" : "text-ink-faint",
                )}
              >
                <span
                  className={cn(
                    "grid size-4 place-items-center rounded-full text-[10px]",
                    digitValid ? "bg-emerald-100 text-emerald-700" : "bg-panel text-ink-faint",
                  )}
                >
                  ✓
                </span>
                <span>At least one digit (0–9)</span>
              </li>
              {confirmPassword.length > 0 && (
                <li
                  className={cn(
                    "flex items-center gap-2 transition-colors",
                    matchValid ? "text-emerald-600 dark:text-emerald-400" : "text-rose-500",
                  )}
                >
                  <span
                    className={cn(
                      "grid size-4 place-items-center rounded-full text-[10px]",
                      matchValid ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700",
                    )}
                  >
                    {matchValid ? "✓" : "×"}
                  </span>
                  <span>Passwords match</span>
                </li>
              )}
            </ul>
          </div>

          <div className="pt-1">
            <label className="flex items-start gap-2 text-xs text-ink cursor-pointer">
              <input
                type="checkbox"
                checked={revokeOtherSessions}
                onChange={(e) => setRevokeOtherSessions(e.target.checked)}
                className="mt-0.5 rounded border-rule text-primary focus:ring-primary"
              />
              <span>Sign out of all other devices and sessions upon changing password</span>
            </label>
          </div>
        </div>

        <div className="flex justify-end border-t border-rule pt-4">
          <button
            type="submit"
            disabled={isPending || !isFormValid}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-primary-ink focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending ? "Updating password..." : "Update Password"}
          </button>
        </div>
      </form>
    </div>
  );
}
