import { test, expect, type Page } from "@playwright/test";

import { cleanupUsers, createWorkspace, registerUser, signIn, uniqueEmail } from "./helpers";

test.setTimeout(180_000);

/** Go to the projects page of the current workspace (user is on /workspaces/<id>). */
async function openProjects(page: Page, workspaceId: string): Promise<void> {
  await page.goto(`/workspaces/${workspaceId}/projects`);
  await page.waitForURL(/\/projects$/);
}

async function createProject(page: Page, name: string): Promise<void> {
  await page.getByRole("button", { name: "New project" }).click();
  const dialog = page.getByRole("dialog", { name: "Create Project" });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Project name").fill(name);
  await dialog.getByRole("button", { name: "Create project" }).click();
  await page.waitForURL(/\/projects\/[^/]+$/);
}

test.describe("Project lifecycle (Owner)", () => {
  let ownerEmail: string;
  const wsName = "E2E Projects Workspace";
  const projectName = "E2E Alpha Project";

  test.beforeAll(async () => {
    ownerEmail = uniqueEmail("po");
  });

  test("creates, updates, archives, and restores a project; archive is soft", async ({
    page,
    request,
  }) => {
    await registerUser(request, "Owner User", ownerEmail);
    await signIn(page, ownerEmail);
    await createWorkspace(page, wsName);
    const workspaceId = /\/workspaces\/([^/]+)$/.exec(page.url())![1];

    // 1. Create a project (FR-030) -> redirected to project detail
    await openProjects(page, workspaceId);
    await createProject(page, projectName);
    await expect(page.getByRole("heading", { name: projectName })).toBeVisible();
    await expect(page.getByText("Active", { exact: true })).toBeVisible();

    // 2. Update the project name (FR-033)
    await page.getByRole("main").getByRole("link", { name: "Settings" }).click();
    await page.waitForURL(/\/projects\/[^/]+\/settings$/);
    await page.getByLabel("Project name").fill(`${projectName} v2`);
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByLabel("Project name")).toHaveValue(`${projectName} v2`);

    // 3. Archive -> gone from active, appears in Archived (FR-034, soft: data retained)
    await openProjects(page, workspaceId);
    await page.getByRole("button", { name: "Archive" }).click();
    await expect(page.getByRole("heading", { name: /^Archived/ })).toBeVisible();
    const archivedRow = page.locator("li", { hasText: `${projectName} v2` });
    await expect(archivedRow.getByRole("button", { name: "Restore" })).toBeVisible();

    // 4. Restore -> back in active (FR-035)
    await archivedRow.getByRole("button", { name: "Restore" }).click();
    await expect(page.getByRole("button", { name: "Archive" })).toBeVisible();

    await cleanupUsers([ownerEmail]);
  });

  test("project key assigns sequential task keys shown on cards and drawer", async ({
    page,
    request,
  }) => {
    const email = uniqueEmail("pk");
    await registerUser(request, "Key Owner", email);
    await signIn(page, email);
    await createWorkspace(page, "E2E Keys Workspace");
    const workspaceId = /\/workspaces\/([^/]+)$/.exec(page.url())![1];

    await openProjects(page, workspaceId);
    await page.getByRole("button", { name: "New project" }).click();
    const dialog = page.getByRole("dialog", { name: "Create Project" });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel("Project name").fill("Key Test Project");
    await dialog.getByLabel("Project key").fill("QKX");
    await dialog.getByRole("button", { name: "Create project" }).click();
    await page.waitForURL(/\/projects\/[^/]+$/);

    for (const title of ["First keyed task", "Second keyed task"]) {
      await page.getByRole("button", { name: "Create task" }).click();
      const taskDialog = page.getByRole("dialog", { name: "Create Task" });
      await expect(taskDialog).toBeVisible();
      await taskDialog.getByLabel("Task title").fill(title);
      await taskDialog.getByRole("button", { name: "Create task" }).click();
      await expect(taskDialog).toBeHidden();
      await expect(page.locator(`input[value="${title}"]`)).toBeVisible();
    }

    // Cards show sequential keys
    await expect(page.getByText("QKX-1", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("QKX-2", { exact: true }).first()).toBeVisible();

    // Drawer header shows the key
    const card = page.locator("li").filter({ has: page.locator('input[value="First keyed task"]') });
    await card.getByRole("button", { name: "Open details" }).click();
    const drawer = page.getByRole("dialog");
    await expect(drawer).toBeVisible();
    await expect(drawer.getByText("QKX-1", { exact: true })).toBeVisible();

    await cleanupUsers([email]);
  });
});
