import { test, expect } from "@playwright/test";
import { cleanupUsers, createWorkspace, registerUser, signIn, uniqueEmail } from "./helpers";

test.setTimeout(180_000);

test.describe("Time Tracking & Worklogs (Priority 5)", () => {
  let ownerEmail: string;
  const wsName = "E2E TimeTracking Workspace";
  const projectName = "E2E TimeTracking Project";

  test.beforeAll(async () => {
    ownerEmail = uniqueEmail("timetracking-owner");
  });

  test.afterAll(async () => {
    await cleanupUsers([ownerEmail]);
  });

  test("creates task with estimate, logs work, edits worklog, verifies tracking bar and kanban badge", async ({
    page,
    request,
  }) => {
    // 1. Register and sign in
    await registerUser(request, "TimeTracker Owner", ownerEmail);
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

    // 3. Create a task with an initial estimate of "2d" (16 hours)
    await page.getByRole("button", { name: "Create task" }).click();
    const taskDialog = page.getByRole("dialog", { name: "Create Task" });
    await expect(taskDialog).toBeVisible();
    await taskDialog.getByLabel("Task title").fill("Task with Time Tracking");
    await taskDialog.getByLabel("Original estimate").fill("2d");
    await taskDialog.getByRole("button", { name: "Create task" }).click();
    await expect(taskDialog).toBeHidden();

    // 4. Open Task Detail Drawer
    const card = page.locator("li").filter({
      has: page.getByLabel("Title: Task with Time Tracking").or(page.getByText("Task with Time Tracking")),
    });
    await expect(card).toBeVisible();
    await card.getByRole("button", { name: "Open details" }).click();
    const drawer = page.getByRole("dialog");
    await expect(drawer).toBeVisible();

    // Verify Time Tracking section exists with Estimate "2d"
    await expect(drawer.getByText("Time Tracking")).toBeVisible();
    await expect(drawer.getByTitle("2 days")).toBeVisible();
    await expect(drawer.getByText("0m logged")).toBeVisible();

    // 5. Log work of 1d 2h (10 hours)
    await drawer.getByRole("button", { name: "Log work" }).first().click();
    const logModal = page.getByRole("dialog", { name: "Log Work" });
    await expect(logModal).toBeVisible();

    await logModal.getByLabel("Time spent").fill("1d 2h");
    await expect(logModal.getByText("✓ 1 day 2 hours (600 minutes)")).toBeVisible();
    await logModal.getByLabel("Work description").fill("Implemented core database schema & tests");
    await logModal.getByRole("button", { name: "Log work" }).click();
    await expect(logModal).toBeHidden();

    // 6. Verify Time Tracking bar is updated (1d 2h logged, 6h remaining, 63%)
    await expect(drawer.getByText("1d 2h logged")).toBeVisible();
    await expect(drawer.getByText("63%")).toBeVisible();
    await expect(drawer.getByText("6h")).toBeVisible();

    // 7. Check the Work Log tab
    await drawer.getByRole("button", { name: /Work Log/ }).click();
    await expect(drawer.getByText("Total logged: 1d 2h")).toBeVisible();
    await expect(drawer.getByText("Implemented core database schema & tests")).toBeVisible();
    await expect(drawer.getByRole("list").getByText("1d 2h")).toBeVisible();

    // 8. Close drawer and verify badge on Kanban card
    await page.getByLabel("Close modal").click();
    await expect(drawer).toBeHidden();

    // Card should display time tracking badge "1d 2h / 2d"
    await expect(card.getByText("1d 2h / 2d")).toBeVisible();

    // 9. Re-open Drawer and edit the worklog entry
    await card.getByRole("button", { name: "Open details" }).click();
    const reOpenedDrawer = page.getByRole("dialog");
    await expect(reOpenedDrawer).toBeVisible();
    await reOpenedDrawer.getByRole("button", { name: /Work Log/ }).click();

    // Click edit on the worklog
    await reOpenedDrawer.getByLabel("Edit worklog").click();
    const editModal = page.getByRole("dialog", { name: "Edit Work Log" });
    await expect(editModal).toBeVisible();

    await editModal.getByLabel("Time spent").fill("1d 4h");
    await expect(editModal.getByText("✓ 1 day 4 hours (720 minutes)")).toBeVisible();
    await editModal.getByRole("button", { name: "Save changes" }).click();
    await expect(editModal).toBeHidden();

    // Verify updated duration (1d 4h) in Work Log tab
    await expect(reOpenedDrawer.getByText("Total logged: 1d 4h")).toBeVisible();

    // 10. Test deleting the worklog
    page.once("dialog", (dialog) => dialog.accept());
    await reOpenedDrawer.getByLabel("Delete worklog").click();

    // Verify empty state is displayed
    await expect(reOpenedDrawer.getByText("No work logged yet")).toBeVisible();
    await expect(reOpenedDrawer.getByText("Total logged: 0m")).toBeVisible();
  });
});
