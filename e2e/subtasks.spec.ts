import { test, expect } from "@playwright/test";
import { cleanupUsers, createWorkspace, registerUser, signIn, uniqueEmail } from "./helpers";

test.setTimeout(180_000);

test.describe("Sub-tasks & Hierarchical Issues (Priority 4)", () => {
  let ownerEmail: string;
  const wsName = "E2E Subtasks Workspace";
  const projectName = "E2E Subtasks Project";

  test.beforeAll(async () => {
    ownerEmail = uniqueEmail("subtask-owner");
  });

  test.afterAll(async () => {
    await cleanupUsers([ownerEmail]);
  });

  test("creates parent task, adds subtasks, tracks completion progress, and verifies badge on Kanban card", async ({
    page,
    request,
  }) => {
    // 1. Register and sign in
    await registerUser(request, "Subtask Owner", ownerEmail);
    await signIn(page, ownerEmail);

    // 2. Create workspace & project
    await createWorkspace(page, wsName);
    const workspaceId = /\/workspaces\/([^/]+)$/.exec(page.url())![1];

    await page.goto(`/workspaces/${workspaceId}/projects`);
    await page.getByRole("button", { name: "New project" }).click();
    const projDialog = page.getByRole("dialog", { name: "Create Project" });
    await projDialog.getByLabel("Project name").fill(projectName);
    await projDialog.getByRole("button", { name: "Create project" }).click();
    await page.waitForURL(/\/projects\/[^/]+$/);

    // 3. Create a parent task
    await page.getByRole("button", { name: "Create task" }).click();
    const taskDialog = page.getByRole("dialog", { name: "Create Task" });
    await expect(taskDialog).toBeVisible();
    await taskDialog.getByLabel("Task title").fill("Parent Feature: OAuth Support");
    await taskDialog.getByRole("button", { name: "Create task" }).click();
    await expect(taskDialog).toBeHidden();

    // 4. Open Task Detail Drawer
    const card = page.locator("li").filter({ has: page.locator('input[value="Parent Feature: OAuth Support"]') });
    await card.getByRole("button", { name: "Open details" }).click();
    const drawer = page.getByRole("dialog");
    await expect(drawer).toBeVisible();

    // Verify Sub-tasks section exists
    await expect(drawer.getByText("Sub-tasks (0/0)")).toBeVisible();

    // 5. Add 1st Sub-task
    await drawer.getByRole("button", { name: "+ Add sub-task" }).click();
    await drawer.getByPlaceholder("What needs to be done? (Press Enter to add)").fill("Create Google OAuth Provider");
    await drawer.getByRole("button", { name: "Add Sub-task" }).click();

    // Verify 1st sub-task created
    await expect(drawer.getByText("Create Google OAuth Provider")).toBeVisible();
    await expect(drawer.getByText("Sub-tasks (0/1)")).toBeVisible();
    await expect(drawer.getByText("0 of 1 completed")).toBeVisible();

    // 6. Add 2nd Sub-task
    await drawer.getByRole("button", { name: "+ Add sub-task" }).click();
    await drawer.getByPlaceholder("What needs to be done? (Press Enter to add)").fill("Add GitHub OAuth Provider");
    await drawer.getByRole("button", { name: "Add Sub-task" }).click();

    // Verify 2nd sub-task created
    await expect(drawer.getByText("Add GitHub OAuth Provider")).toBeVisible();
    await expect(drawer.getByText("Sub-tasks (0/2)")).toBeVisible();
    await expect(drawer.getByText("0 of 2 completed")).toBeVisible();

    // 7. Toggle 1st sub-task as Done
    const checkbox = drawer.getByLabel("Toggle subtask Create Google OAuth Provider");
    await checkbox.check();

    // Verify progress updates to 1/2 completed (50%)
    await expect(drawer.getByText("Sub-tasks (1/2)")).toBeVisible();
    await expect(drawer.getByText("1 of 2 completed")).toBeVisible();
    await expect(drawer.getByText("50%")).toBeVisible();

    // 8. Close Drawer and verify Kanban card displays 1/2 badge
    await page.getByLabel("Close modal").click();
    await expect(drawer).toBeHidden();

    // Verify subtask badge on Kanban card
    await expect(page.getByText("1/2")).toBeVisible();

    // 9. Re-open Drawer and test unlinking a subtask
    await card.getByRole("button", { name: "Open details" }).click();
    const reOpenedDrawer = page.getByRole("dialog");
    await expect(reOpenedDrawer).toBeVisible();

    // Click unlink on 2nd subtask
    await reOpenedDrawer.getByLabel("Unlink subtask").last().click();

    // Verify remaining is 1 sub-task (1/1 completed - 100%)
    await expect(reOpenedDrawer.getByText("Sub-tasks (1/1)")).toBeVisible();
    await expect(reOpenedDrawer.getByText("100%")).toBeVisible();
  });
});
