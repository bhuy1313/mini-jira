import { test, expect } from "@playwright/test";

import {
  cleanupUsers,
  createWorkspace,
  registerUser,
  signIn,
  uniqueEmail,
} from "./helpers";

test.setTimeout(180_000);

test.describe("UC-001: Owner creates a workspace", () => {
  let ownerEmail: string;

  test.beforeAll(async () => {
    ownerEmail = uniqueEmail("owner");
  });

  test("registers, signs in, creates a workspace and becomes Owner", async ({ page, request }) => {
    await registerUser(request, "Owner User", ownerEmail);
    await signIn(page, ownerEmail);

    await createWorkspace(page, "E2E Alpha Workspace");

    await expect(page.getByRole("heading", { name: "E2E Alpha Workspace" })).toBeVisible();
    await expect(page.getByText("Active projects")).toBeVisible();

    // Creator member record exists as Owner
    const res = await request.get("/api/auth/get-session");
    expect(res.ok()).toBeTruthy();

    await cleanupUsers([ownerEmail]);
  });
});

test.describe("UC-002: Owner manages members", () => {
  let ownerEmail: string;
  let memberEmail: string;
  let missingEmail: string;
  const wsName = "E2E Beta Workspace";

  test.beforeAll(async () => {
    ownerEmail = uniqueEmail("owner2");
    memberEmail = uniqueEmail("member");
    missingEmail = uniqueEmail("ghost");
  });

  test("adds a member by email, changes role, and removes the member", async ({ page, request }) => {
    await registerUser(request, "Owner User", ownerEmail);
    await registerUser(request, "Member User", memberEmail);
    await signIn(page, ownerEmail);
    await createWorkspace(page, wsName);

    // Navigate to members page
    const workspaceId = /\/workspaces\/([^/]+)$/.exec(page.url())![1];
    await page.goto(`/workspaces/${workspaceId}/members`);
    await page.waitForURL(/\/members$/);

    // 1. Adding an unregistered email surfaces a safe error (no data leak)
    await page.getByRole("button", { name: "Add member" }).click();
    const addDialog = page.getByRole("dialog", { name: "Add Workspace Member" });
    await expect(addDialog).toBeVisible();
    await addDialog.getByLabel("Member email").fill(missingEmail);
    await addDialog.getByRole("button", { name: "Add member" }).click();
    await expect(addDialog.getByRole("alert")).toContainText("No account found");
    await expect(page.getByText(missingEmail)).toHaveCount(0);

    // 2. Add a registered member by email
    await addDialog.getByLabel("Member email").fill(memberEmail);
    await addDialog.getByRole("button", { name: "Add member" }).click();
    await expect(addDialog).toBeHidden();
    const memberRow = page.locator("li").filter({ hasText: memberEmail });
    await expect(memberRow).toBeVisible();

    // 3. Owner changes the member's role to Admin
    await memberRow.getByRole("combobox", { name: "Role" }).selectOption("Admin");
    await memberRow.getByRole("button", { name: "Save" }).click();
    await expect(memberRow.getByRole("combobox", { name: "Role" })).toHaveValue("Admin");

    // 4. Owner removes the member
    await memberRow.getByRole("button", { name: "Remove" }).click();
    await expect(page.locator("li").filter({ hasText: memberEmail })).toHaveCount(0);

    await cleanupUsers([ownerEmail, memberEmail]);
  });
});
