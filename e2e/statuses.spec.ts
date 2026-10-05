import { test, expect } from "@playwright/test";
import { cleanupUsers, createWorkspace, registerUser, signIn, uniqueEmail } from "./helpers";

test.setTimeout(180_000);

test.describe("Custom Statuses (Milestone 12) — CRUD & Kanban integration", () => {
  let ownerEmail: string;
  const wsName = "E2E Status Workspace";
  const projectName = "E2E Status Project";

  test.beforeAll(async () => {
    ownerEmail = uniqueEmail("stat-owner");
  });

  test("manages custom statuses and reflects on Kanban board", async ({ page, request }) => {
    await registerUser(request, "Status Owner", ownerEmail);
    await signIn(page, ownerEmail);
    await createWorkspace(page, wsName);
    const workspaceId = /\/workspaces\/([^/]+)$/.exec(page.url())![1];

    // Go to projects and create a project
    await page.goto(`/workspaces/${workspaceId}/projects`);
    await page.getByRole("button", { name: "New project" }).click();
    const projDialog = page.getByRole("dialog", { name: "Create Project" });
    await projDialog.getByLabel("Project name").fill(projectName);
    await projDialog.getByRole("button", { name: "Create project" }).click();
    await page.waitForURL(/\/projects\/[^/]+$/);
    const projectId = /\/projects\/([^/]+)$/.exec(page.url())![1];

    // 1. Initial board has 3 default columns: To Do, In Progress, Done
    await expect(page.getByRole("heading", { name: /^To Do/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: /^In Progress/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: /^Done/ })).toBeVisible();

    // 2. Go to Project Settings -> Statuses panel
    await page.goto(`/workspaces/${workspaceId}/projects/${projectId}/settings`);
    // Panel heading is "Statuses (Kanban Columns)"
    await expect(page.getByRole("heading", { name: "Statuses (Kanban Columns)" })).toBeVisible();

    // Verify existing default status names shown as text spans
    await expect(page.getByText("To Do", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("In Progress", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Done", { exact: true }).first()).toBeVisible();

    // 3. Add a new status "QA Review"
    await page.getByRole("button", { name: "Add status" }).click();
    const statusDialog = page.getByRole("dialog", { name: "Add Workflow Status" });
    await expect(statusDialog).toBeVisible();
    await statusDialog.getByLabel("Status name").fill("QA Review");
    await statusDialog.getByRole("button", { name: "Add status" }).click();
    await expect(statusDialog).toBeHidden();
    await expect(page.getByText("QA Review", { exact: true })).toBeVisible();

    // 4. Return to Board and check for "QA Review" column
    await page.goto(`/workspaces/${workspaceId}/projects/${projectId}`);
    await expect(page.getByRole("heading", { name: /^QA Review/ })).toBeVisible();

    // 5. Create a task and move it to "QA Review"
    await page.getByRole("button", { name: "Create task" }).click();
    const createDialog = page.getByRole("dialog", { name: "Create Task" });
    await expect(createDialog).toBeVisible();
    await createDialog.getByLabel("Task title").fill("Status Test Task");
    await createDialog.getByRole("button", { name: "Create task" }).click();
    await expect(createDialog).toBeHidden();
    await expect(page.locator('input[value="Status Test Task"]')).toBeVisible();

    await page
      .locator("li")
      .filter({ has: page.locator('input[value="Status Test Task"]') })
      .getByLabel("Move Status Test Task")
      .selectOption({ label: "QA Review" });

    // Verify task is now under QA Review section
    const qaSection = page
      .locator("section")
      .filter({ has: page.getByRole("heading", { name: /^QA Review/ }) });
    await expect(
      qaSection
        .getByText("Status Test Task", { exact: true })
        .or(qaSection.locator('input[value="Status Test Task"]')),
    ).toBeVisible();

    // 6. Go to Settings, click delete on "QA Review" -> confirm shows "Delete?" (two-step)
    await page.goto(`/workspaces/${workspaceId}/projects/${projectId}/settings`);

    // QA Review row: click the trash icon button (aria-label = "Delete status QA Review")
    await page.getByRole("button", { name: "Delete status QA Review" }).click();
    // Two-step: "Delete?" text appears, then "Yes" button
    await expect(page.getByText("Delete?")).toBeVisible();
    // Click Yes -> should show error because task still assigned
    await page.getByRole("button", { name: "Yes" }).click();
    // Error: "Cannot delete status "QA Review" because it contains ... task(s). Move them first."
    await expect(page.getByRole("alert").filter({ hasText: /Move them first/i })).toBeVisible();

    // 7. Move task back to "To Do" first
    await page.goto(`/workspaces/${workspaceId}/projects/${projectId}`);
    await page
      .locator("li")
      .filter({ has: page.locator('input[value="Status Test Task"]') })
      .getByLabel("Move Status Test Task")
      .selectOption({ label: "To Do" });

    // 8. Now delete "QA Review" from settings (no tasks assigned)
    await page.goto(`/workspaces/${workspaceId}/projects/${projectId}/settings`);
    await page.getByRole("button", { name: "Delete status QA Review" }).click();
    await expect(page.getByText("Delete?")).toBeVisible();
    await page.getByRole("button", { name: "Yes" }).click();
    // "QA Review" should disappear from the list
    await expect(page.getByText("QA Review", { exact: true })).toHaveCount(0);

    // 9. Board no longer has "QA Review" column
    await page.goto(`/workspaces/${workspaceId}/projects/${projectId}`);
    await expect(page.getByRole("heading", { name: /^QA Review/ })).toHaveCount(0);

    await cleanupUsers([ownerEmail]);
  });
});
