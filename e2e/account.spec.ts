import { expect, test } from "@playwright/test";

import {
  cleanupUsers,
  createWorkspace,
  registerUser,
  signIn,
  TEST_PASSWORD,
  uniqueEmail,
} from "./helpers";

test.describe("Account Management (Milestone 21)", () => {
  const emails: string[] = [];

  test.afterAll(async () => {
    await cleanupUsers(emails);
  });

  test("updates display name and persists on reload", async ({ page, request }) => {
    const email = uniqueEmail("account-profile");
    emails.push(email);

    await registerUser(request, "Original Name", email);
    await signIn(page, email);
    await createWorkspace(page, "Profile WS");

    // Navigate to /account
    await page.goto("/account");
    await expect(page.getByRole("heading", { name: "Original Name" })).toBeVisible();

    // Fill new name in Profile tab
    const nameInput = page.getByLabel(/^Display Name/);
    await nameInput.fill("Updated Display Name");
    await page.getByRole("button", { name: "Save Changes" }).click();

    // Verify success message and updated header
    await expect(page.getByText("Profile updated successfully!")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Updated Display Name" })).toBeVisible();

    // Reload page to verify persistence
    await page.reload();
    await expect(page.getByRole("heading", { name: "Updated Display Name" })).toBeVisible();
    await expect(page.getByLabel(/^Display Name/)).toHaveValue("Updated Display Name");
  });

  test("changes password and allows sign in with new password", async ({ page, request }) => {
    const email = uniqueEmail("account-password");
    emails.push(email);

    await registerUser(request, "Password User", email);
    await signIn(page, email);
    await createWorkspace(page, "Pass WS");

    await page.goto("/account");

    // Switch to Security & Password tab
    await page.getByRole("tab", { name: /Security & Password/i }).click();

    // Fill password form
    const NEW_PASSWORD = "NewStrongPass999!";
    await page.locator("#current-password").fill(TEST_PASSWORD);
    await page.locator("#new-password").fill(NEW_PASSWORD);
    await page.locator("#confirm-password").fill(NEW_PASSWORD);

    await page.getByRole("button", { name: "Update Password" }).click();
    await expect(page.getByText("Password changed successfully!")).toBeVisible();

    // Sign out directly from /account
    await page.getByRole("button", { name: "Sign out" }).click();
    await page.waitForURL(/\/auth$/);

    // Sign in with new password
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(NEW_PASSWORD);
    await page.locator("form").getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL(/\/workspaces/);
    expect(page.url()).toContain("/workspaces");
  });

  test("displays active sessions and workspaces summary tabs", async ({ page, request }) => {
    const email = uniqueEmail("account-tabs");
    emails.push(email);

    await registerUser(request, "Tabs User", email);
    await signIn(page, email);
    await createWorkspace(page, "Summary WS");

    await page.goto("/account");

    // Check Active Sessions tab
    await page.getByRole("tab", { name: /Active Sessions/i }).click();
    await expect(page.getByText("Current device").first()).toBeVisible();
    await expect(page.getByText(/Active since:/i).first()).toBeVisible();

    // Check My Workspaces tab
    await page.getByRole("tab", { name: /My Workspaces/i }).click();
    await expect(page.getByRole("heading", { name: "Summary WS" })).toBeVisible();
    await expect(page.getByText("Owner", { exact: true })).toBeVisible();
  });

  test("password reset request succeeds without a configured mailer (log-only mode)", async ({
    request,
  }) => {
    const email = uniqueEmail("account-reset");
    emails.push(email);
    await registerUser(request, "Reset User", email);

    const res = await request.post("/api/auth/request-password-reset", {
      headers: { Origin: "http://localhost:3000" },
      data: { email, redirectTo: "/auth/reset-password" },
    });
    expect(res.ok()).toBe(true);
  });
});
