import { test, expect } from "@playwright/test";

import {
  cleanupUsers,
  createWorkspace,
  registerUser,
  signIn,
  uniqueEmail,
} from "./helpers";

test.setTimeout(180_000);

/**
 * UC-011: Project-level membership & roles (Mốc 11)
 *
 * Scenario:
 * 1. Owner tạo workspace, member1 đã đăng ký.
 * 2. Owner add member1 vào workspace.
 * 3. Owner tạo project → tự động trở thành Owner của project.
 * 4. Owner vào project settings → thấy Members panel.
 * 5. Owner thêm member1 vào project với role Member.
 * 6. Kiểm tra member1 xuất hiện trong danh sách.
 * 7. Owner đổi role member1 thành Admin.
 * 8. Owner xoá member1 khỏi project.
 * 9. Kiểm tra member1 không còn trong danh sách.
 */
test.describe("UC-011: Project member management", () => {
  let ownerEmail: string;
  let member1Email: string;
  const wsName = "E2E PM Workspace";
  const projectName = "E2E PM Project";

  test.beforeAll(async () => {
    ownerEmail = uniqueEmail("pm-owner");
    member1Email = uniqueEmail("pm-member1");
  });

  test("owner manages project members through settings page", async ({ page, request }) => {
    // 1. Register both users
    await registerUser(request, "PM Owner", ownerEmail);
    await registerUser(request, "PM Member1", member1Email);

    // 2. Owner signs in and creates workspace
    await signIn(page, ownerEmail);
    await createWorkspace(page, wsName);

    // 3. Add member1 to workspace
    await page.getByRole("link", { name: "Members", exact: true }).click();
    await page.waitForURL(/\/members$/);
    await page.getByRole("button", { name: "Add member" }).click();
    const addMemberDialog = page.getByRole("dialog", { name: "Add Workspace Member" });
    await expect(addMemberDialog).toBeVisible();
    await addMemberDialog.getByLabel("Member email").fill(member1Email);
    await addMemberDialog.getByRole("button", { name: "Add member" }).click();
    await expect(addMemberDialog).toBeHidden();
    const wsMemberRow = page.locator("li").filter({ hasText: member1Email });
    await expect(wsMemberRow).toBeVisible();

    // 4. Navigate to projects and create one
    await page.getByRole("link", { name: "Projects" }).first().click();
    await page.waitForURL(/\/projects$/);
    await page.getByRole("button", { name: "New project" }).click();
    const projectDialog = page.getByRole("dialog", { name: "Create Project" });
    await expect(projectDialog).toBeVisible();
    await projectDialog.getByLabel("Project name").fill(projectName);
    await projectDialog.getByRole("button", { name: "Create project" }).click();
    await page.waitForURL(/\/projects\/[^/]+$/);

    // 5. Navigate to project settings
    await page.getByRole("main").getByRole("link", { name: "Settings" }).click();
    await page.waitForURL(/\/projects\/[^/]+\/settings$/);

    // 6. Owner should appear in Members panel as Owner
    const membersSection = page.getByRole("region").filter({ hasText: "Members" }).first();
    await expect(membersSection).toBeVisible();
    const ownerRow = membersSection.locator("li").filter({ hasText: ownerEmail });
    await expect(ownerRow.locator("span").filter({ hasText: /^Owner$/ })).toBeVisible();

    // 7. Add member1 to the project
    await membersSection.getByLabel("Member email").fill(member1Email);
    await membersSection.getByRole("button", { name: "Add member" }).click();

    // 8. Check member1 appears in project members list
    const projectMemberRow = membersSection.locator("li").filter({ hasText: member1Email });
    await expect(projectMemberRow).toBeVisible();
    await expect(projectMemberRow.locator("span").filter({ hasText: /^Member$/ })).toBeVisible();

    // 9. Change member1's role to Admin
    await projectMemberRow
      .getByRole("combobox", { name: /Change role for/ })
      .selectOption("Admin");
    // Wait for the revalidation to show the Admin badge
    await expect(projectMemberRow.locator("span").filter({ hasText: /^Admin$/ })).toBeVisible({ timeout: 10_000 });

    // 10. Remove member1
    await projectMemberRow.getByRole("button", { name: "Remove" }).click();
    // Confirm removal
    await projectMemberRow.getByRole("button", { name: "Yes" }).click();

    // 11. member1 no longer in list
    await expect(membersSection.locator("li").filter({ hasText: member1Email })).toHaveCount(0, {
      timeout: 10_000,
    });

    await cleanupUsers([ownerEmail, member1Email]);
  });
});
