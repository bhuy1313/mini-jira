import { test, expect } from "@playwright/test";
import { cleanupUsers, createWorkspace, registerUser, signIn, uniqueEmail } from "./helpers";

test.setTimeout(180_000);

test.describe("Sprints (Milestone 15) — CRUD, board filter, progress", () => {
  let ownerEmail: string;
  const wsName = "E2E Sprint Workspace";
  const projectName = "E2E Sprint Project";

  test.beforeAll(async () => {
    ownerEmail = uniqueEmail("sprint-owner");
  });

  test("manages sprints, assigns tasks, filters board, shows progress", async ({ page, request }) => {
    await registerUser(request, "Sprint Owner", ownerEmail);
    await signIn(page, ownerEmail);
    await createWorkspace(page, wsName);
    const workspaceId = /\/workspaces\/([^/]+)$/.exec(page.url())![1];

    // Create a project
    await page.goto(`/workspaces/${workspaceId}/projects`);
    await page.getByRole("button", { name: "New project" }).click();
    const projDialog = page.getByRole("dialog", { name: "Create Project" });
    await projDialog.getByLabel("Project name").fill(projectName);
    await projDialog.getByRole("button", { name: "Create project" }).click();
    await page.waitForURL(/\/projects\/[^/]+$/);
    const projectId = /\/projects\/([^/]+)$/.exec(page.url())![1];

    // 1. Settings -> Sprints panel: create two sprints
    await page.goto(`/workspaces/${workspaceId}/projects/${projectId}/settings`);
    await expect(page.getByRole("heading", { name: "Sprints", exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Add sprint" }).click();
    const sprintDialog1 = page.getByRole("dialog", { name: "Add Sprint" });
    await expect(sprintDialog1).toBeVisible();
    await sprintDialog1.getByLabel("Sprint name").fill("Sprint 1");
    await sprintDialog1.getByLabel("Sprint goal").fill("Ship the sprint feature");
    await sprintDialog1.getByRole("button", { name: "Add sprint" }).click();
    await expect(sprintDialog1).toBeHidden();
    await expect(page.getByText("Sprint 1", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Ship the sprint feature")).toBeVisible();

    await page.getByRole("button", { name: "Add sprint" }).click();
    const sprintDialog2 = page.getByRole("dialog", { name: "Add Sprint" });
    await expect(sprintDialog2).toBeVisible();
    await sprintDialog2.getByLabel("Sprint name").fill("Sprint 2");
    await sprintDialog2.getByRole("button", { name: "Add sprint" }).click();
    await expect(sprintDialog2).toBeHidden();
    await expect(page.getByText("Sprint 2", { exact: true }).first()).toBeVisible();

    // 2. Board shows SprintSwitcher with All / Backlog / Sprint 1 / Sprint 2 → all 0/0
    await page.goto(`/workspaces/${workspaceId}/projects/${projectId}`);
    await expect(page.getByRole("button", { name: /^Sprint 1/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Sprint 2/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Backlog/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /^All/ })).toBeVisible();

    // 3. Create a task and assign it to Sprint 1 via the detail modal
    await page.getByRole("button", { name: "Create task" }).click();
    const createDialog = page.getByRole("dialog", { name: "Create Task" });
    await expect(createDialog).toBeVisible();
    await createDialog.getByLabel("Task title").fill("Sprint Feature Task");
    await createDialog.getByRole("button", { name: "Create task" }).click();
    await expect(createDialog).toBeHidden();
    await expect(page.locator('input[value="Sprint Feature Task"]')).toBeVisible();

    const card = page.locator("li").filter({ has: page.locator('input[value="Sprint Feature Task"]') });
    await card.getByRole("button", { name: "Open details" }).click();
    const detailDialog = page.getByRole("dialog");
    await expect(detailDialog).toBeVisible();
    await expect(page.locator("#task-detail-title")).toHaveValue("Sprint Feature Task");
    await detailDialog.getByLabel("Sprint", { exact: true }).selectOption({ label: "Sprint 1" });
    await expect(
      page.getByRole("button", { name: /^Sprint 1/ }).first(),
    ).toBeVisible();
    await detailDialog.getByRole("button", { name: "Close modal" }).click();

    // 4. Board filtered to Sprint 1 shows the task; Backlog does not
    await page.getByRole("button", { name: /^Sprint 1/ }).click();
    await expect(page.locator('input[value="Sprint Feature Task"]')).toBeVisible();

    await page.getByRole("button", { name: /^Backlog/ }).click();
    await expect(page.locator('input[value="Sprint Feature Task"]')).toHaveCount(0);

    // 5. Back to All, move task to Done → Sprint 1 progress = 1/1 (Done status is isDone)
    await page.getByRole("button", { name: /^All/ }).click();
    await expect(page.locator('input[value="Sprint Feature Task"]')).toBeVisible();
    await page
      .locator("li")
      .filter({ has: page.locator('input[value="Sprint Feature Task"]') })
      .getByLabel("Move Sprint Feature Task")
      .selectOption({ label: "Done" });
    await expect(page.getByTitle("1/1 done").first()).toBeVisible();

    // 6. Reorder sprints in settings (Sprint 2 above Sprint 1)
    await page.goto(`/workspaces/${workspaceId}/projects/${projectId}/settings`);
    const sprint2Row = page.locator("li", { hasText: "Sprint 2" }).first();
    await sprint2Row.getByRole("button", { name: "Move Sprint 2 up" }).click();

    await page.goto(`/workspaces/${workspaceId}/projects/${projectId}`);
    const sprintNav = page.locator("nav[aria-label='Sprint view']");
    // Index 0=All, 1=Backlog, so Sprint 2 should now be first sprint (index 2)
    await expect(sprintNav.getByRole("button").nth(2)).toHaveText(/^Sprint 2/);
    await expect(sprintNav.getByRole("button").nth(3)).toHaveText(/^Sprint 1/);

    await page.goto(`/workspaces/${workspaceId}/projects/${projectId}/settings`);

    // 7. Delete "Sprint 1" → task falls back to Backlog (SetNull)
    await page.getByRole("button", { name: "Delete sprint Sprint 1" }).click();
    await expect(page.getByText("Delete?")).toBeVisible();
    await page.getByRole("button", { name: "Yes" }).click();
    await expect(page.getByText("Sprint 1", { exact: true })).toHaveCount(0);

    await page.goto(`/workspaces/${workspaceId}/projects/${projectId}`);
    await expect(page.getByRole("button", { name: /^Sprint 1/ })).toHaveCount(0);
    await page.getByRole("button", { name: /^Backlog/ }).click();
    await expect(page.locator('input[value="Sprint Feature Task"]')).toBeVisible();

    await cleanupUsers([ownerEmail]);
  });
});