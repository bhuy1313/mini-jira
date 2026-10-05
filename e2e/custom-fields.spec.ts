import { test, expect } from "@playwright/test";
import { cleanupUsers, createWorkspace, registerUser, signIn, uniqueEmail } from "./helpers";

test.setTimeout(180_000);

test.describe("Custom Fields (Milestone 18) — CRUD & Task Detail integration", () => {
  let ownerEmail: string;
  let memberEmail: string;
  const wsName = "E2E Custom Fields Workspace";
  const projectName = "E2E Custom Fields Project";

  test.beforeAll(async () => {
    ownerEmail = uniqueEmail("cf-owner");
    memberEmail = uniqueEmail("cf-member");
  });

  test("manages custom fields and edits field values on tasks", async ({ page, request }) => {
    // 1. Register Owner and Member
    await registerUser(request, "CF Owner", ownerEmail);
    await registerUser(request, "CF Member", memberEmail);

    // 2. Sign in as Owner and create workspace + project
    await signIn(page, ownerEmail);
    await createWorkspace(page, wsName);
    const workspaceId = /\/workspaces\/([^/]+)$/.exec(page.url())![1];

    // Invite member to workspace
    await page.goto(`/workspaces/${workspaceId}/members`);
    await page.getByRole("button", { name: "Add member" }).click();
    const addMemberDialog = page.getByRole("dialog", { name: "Add Workspace Member" });
    await expect(addMemberDialog).toBeVisible();
    await addMemberDialog.getByLabel("Member email").fill(memberEmail);
    await addMemberDialog.getByRole("button", { name: "Add member" }).click();
    await expect(addMemberDialog).toBeHidden();
    await expect(page.getByText(memberEmail)).toBeVisible();

    // Create project
    await page.goto(`/workspaces/${workspaceId}/projects`);
    await page.getByRole("button", { name: "New project" }).click();
    const projectDialog = page.getByRole("dialog", { name: "Create Project" });
    await expect(projectDialog).toBeVisible();
    await projectDialog.getByLabel("Project name").fill(projectName);
    await projectDialog.getByRole("button", { name: "Create project" }).click();
    await page.waitForURL(/\/projects\/[^/]+$/);
    const projectId = /\/projects\/([^/]+)$/.exec(page.url())![1];

    // 3. Go to Project Settings -> Custom Fields panel
    await page.goto(`/workspaces/${workspaceId}/projects/${projectId}/settings`);
    await expect(page.getByRole("heading", { name: "Custom Fields", exact: true })).toBeVisible();

    // 4. Create Text Custom Field: "Customer Name"
    await page.getByRole("button", { name: "Add custom field" }).click();
    const cfDialog1 = page.getByRole("dialog", { name: "Add Custom Field" });
    await expect(cfDialog1).toBeVisible();
    await cfDialog1.getByLabel("Custom field name").fill("Customer Name");
    await cfDialog1.getByLabel("Custom field type").selectOption("Text");
    await cfDialog1.getByRole("button", { name: "Add custom field" }).click();
    await expect(cfDialog1).toBeHidden();
    await expect(page.getByText("Customer Name", { exact: true })).toBeVisible();

    // 5. Create Select Custom Field: "Environment" with options "Staging, Production"
    await page.getByRole("button", { name: "Add custom field" }).click();
    const cfDialog2 = page.getByRole("dialog", { name: "Add Custom Field" });
    await expect(cfDialog2).toBeVisible();
    await cfDialog2.getByLabel("Custom field name").fill("Environment");
    await cfDialog2.getByLabel("Custom field type").selectOption("Select");
    await cfDialog2.getByLabel("Dropdown options").fill("Development, Staging, Production");
    await cfDialog2.getByRole("button", { name: "Add custom field" }).click();
    await expect(cfDialog2).toBeHidden();
    await expect(page.getByText("Environment", { exact: true })).toBeVisible();

    // 6. Create Number Custom Field: "Story Points"
    await page.getByRole("button", { name: "Add custom field" }).click();
    const cfDialog3 = page.getByRole("dialog", { name: "Add Custom Field" });
    await expect(cfDialog3).toBeVisible();
    await cfDialog3.getByLabel("Custom field name").fill("Story Points");
    await cfDialog3.getByLabel("Custom field type").selectOption("Number");
    await cfDialog3.getByRole("button", { name: "Add custom field" }).click();
    await expect(cfDialog3).toBeHidden();
    await expect(page.getByText("Story Points", { exact: true })).toBeVisible();

    // 7. Go to Board and create a task
    await page.goto(`/workspaces/${workspaceId}/projects/${projectId}`);
    await page.getByRole("button", { name: "Create task" }).click();
    const createDialog = page.getByRole("dialog", { name: "Create Task" });
    await expect(createDialog).toBeVisible();
    await createDialog.getByLabel("Task title").fill("Task with Custom Fields");
    await createDialog.getByRole("button", { name: "Create task" }).click();
    await expect(createDialog).toBeHidden();
    await expect(page.locator('input[value="Task with Custom Fields"]')).toBeVisible();

    // 8. Open Task Detail Modal
    const card = page.locator("li").filter({ has: page.locator('input[value="Task with Custom Fields"]') });
    await card.getByRole("button", { name: "Open details" }).click();
    const detailModal = page.getByRole("dialog");
    await expect(detailModal).toBeVisible();
    await expect(detailModal.getByRole("heading", { name: "Custom Fields", exact: true })).toBeVisible();

    // 9. Fill in custom field values
    await detailModal.getByLabel("Customer Name").fill("Acme Global Corp");
    await detailModal.getByLabel("Customer Name").press("Enter");

    await detailModal.getByLabel("Environment").selectOption("Staging");

    await detailModal.getByLabel("Story Points").fill("8");
    await detailModal.getByLabel("Story Points").press("Enter");

    // 10. Close and reopen modal to verify values persisted
    await page.waitForTimeout(800);
    await detailModal.getByRole("button", { name: "Close modal" }).click();
    await page.reload();

    await card.getByRole("button", { name: "Open details" }).click();
    const detailModalReopened = page.getByRole("dialog");
    await expect(detailModalReopened).toBeVisible();
    await expect(detailModalReopened.getByLabel("Customer Name")).toHaveValue("Acme Global Corp");
    await expect(detailModalReopened.getByLabel("Environment")).toHaveValue("Staging");
    await expect(detailModalReopened.getByLabel("Story Points")).toHaveValue("8");
    await detailModalReopened.getByRole("button", { name: "Close modal" }).click();

    // 11. Sign out owner, sign in as Member and check permissions
    await page.getByRole("button", { name: "Sign out" }).click();
    await page.waitForURL(/\/auth$/);
    await signIn(page, memberEmail);

    // Member visits Project Settings -> Should not see "Add a custom field" button
    await page.goto(`/workspaces/${workspaceId}/projects/${projectId}/settings`);
    await expect(page.getByRole("button", { name: "Add custom field" })).toHaveCount(0);

    // Cleanup users
    await cleanupUsers([ownerEmail, memberEmail]);
  });
});
