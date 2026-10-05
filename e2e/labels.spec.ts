import { test, expect, type Page } from "@playwright/test";

import { cleanupUsers, createWorkspace, registerUser, signIn, uniqueEmail } from "./helpers";

test.setTimeout(180_000);

async function openProjects(page: Page, workspaceId: string): Promise<void> {
  await page.goto(`/workspaces/${workspaceId}/projects`);
  await page.waitForURL(/\/projects$/);
}

async function createProject(page: Page, name: string): Promise<string> {
  await page.getByRole("button", { name: "New project" }).click();
  const dialog = page.getByRole("dialog", { name: "Create Project" });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Project name").fill(name);
  await dialog.getByRole("button", { name: "Create project" }).click();
  await page.waitForURL(/\/projects\/[^/]+$/);
  return /\/projects\/([^/]+)$/.exec(page.url())![1];
}

async function createTask(page: Page, title: string): Promise<void> {
  await page.getByRole("button", { name: "Create task" }).click();
  const dialog = page.getByRole("dialog", { name: "Create Task" });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Task title").fill(title);
  await dialog.getByRole("button", { name: "Create task" }).click();
  await expect(dialog).toBeHidden();
}

/** Locator cho thẻ task — Owner render title là input (có value), Member render là button. */
function taskCard(page: Page, title: string) {
  return page
    .locator("li")
    .filter({ has: page.locator(`input[value="${title}"]`) })
    .or(page.locator("li").filter({ has: page.getByRole("button", { name: title }) }));
}

test.describe("Labels (Mốc 10)", () => {
  let ownerEmail: string;
  let memberEmail: string;
  const wsName = "E2E Label Workspace";
  const projectName = "E2E Label Project";
  const taskTitle = "Labeled task";

  test.beforeAll(async () => {
    ownerEmail = uniqueEmail("lo");
    memberEmail = uniqueEmail("lm");
  });

  test("owner manages labels, member attaches/detaches, filter by label", async ({ page, request }) => {
    await registerUser(request, "Owner User", ownerEmail);
    await registerUser(request, "Member User", memberEmail);
    await signIn(page, ownerEmail);
    await createWorkspace(page, wsName);
    const workspaceId = /\/workspaces\/([^/]+)$/.exec(page.url())![1];

    await page.goto(`/workspaces/${workspaceId}/members`);
    await page.getByRole("button", { name: "Add member" }).click();
    const addMemberDialog = page.getByRole("dialog", { name: "Add Workspace Member" });
    await expect(addMemberDialog).toBeVisible();
    await addMemberDialog.getByLabel("Member email").fill(memberEmail);
    await addMemberDialog.getByRole("button", { name: "Add member" }).click();
    await expect(addMemberDialog).toBeHidden();

    await openProjects(page, workspaceId);
    const projectId = await createProject(page, projectName);

    // Owner creates a label (Owner/Admin only). Default labels like "Bug" are already present.
    await page.getByRole("button", { name: /Labels/ }).click();
    const manager = page.getByRole("dialog", { name: "Manage Project Labels" });
    await expect(manager.getByText("Bug", { exact: true })).toBeVisible();
    await manager.getByLabel("New label name").fill("Frontend");
    await manager.getByRole("button", { name: "Add label" }).click();
    await expect(manager.getByText("Frontend", { exact: true })).toBeVisible();
    await manager.getByRole("button", { name: "Done", exact: true }).click();

    // Create a task, then attach the label via detail modal.
    await createTask(page, taskTitle);
    await taskCard(page, taskTitle).getByRole("button", { name: "Open details" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("dialog").getByRole("button", { name: "Labels" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Add label Frontend" }).click();
    await expect(page.getByRole("dialog").getByText("Frontend", { exact: true })).toBeVisible();
    await page.getByLabel("Close modal").click();

    // Card shows the label chip.
    await expect(taskCard(page, taskTitle).getByText("Frontend", { exact: true })).toBeVisible();

    // Filter by label keeps the task (URL param `label`).
    await page.getByLabel("Filter by label").selectOption({ label: "Frontend" });
    await page.waitForURL(/label=/);
    await expect(taskCard(page, taskTitle).getByText("Frontend", { exact: true })).toBeVisible();

    // Clear filter, sign in as member.
    await page.getByRole("button", { name: "Clear filters" }).click();
    await page.waitForURL((url) => !url.searchParams.has("label"));

    await page.getByRole("button", { name: "Sign out" }).click();
    await page.waitForURL(/\/auth$/);
    await signIn(page, memberEmail);
    await page.goto(`/workspaces/${workspaceId}/projects/${projectId}`);
    await expect(taskCard(page, taskTitle).getByText("Frontend", { exact: true })).toBeVisible();

    // Member sees label in modal, can detach, and cannot see manage labels button.
    await expect(page.getByRole("button", { name: /Labels \(\d+\)/ })).toHaveCount(0);
    await taskCard(page, taskTitle).getByRole("button", { name: "Open details" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Labels" }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Remove label Frontend" })
      .click();
    await expect(page.getByText("No labels attached yet.")).toBeVisible();
    await page.getByLabel("Close modal").click();
    await expect(taskCard(page, taskTitle).getByText("Frontend", { exact: true })).toHaveCount(0);

    // Member cannot create/edit labels (no manage region) — verified above.
    // Owner deletes the label in cleanup below.
    await page.getByRole("button", { name: "Sign out" }).click();
    await page.waitForURL(/\/auth$/);
    await signIn(page, ownerEmail);
    await page.goto(`/workspaces/${workspaceId}/projects/${projectId}`);
    await page.getByRole("button", { name: /Labels/ }).click();
    const cleanupManager = page.getByRole("dialog", { name: "Manage Project Labels" });
    await cleanupManager.getByRole("button", { name: "Delete label Frontend" }).click();
    await expect(cleanupManager.getByText("Frontend", { exact: true })).toHaveCount(0);

    await cleanupUsers([ownerEmail, memberEmail]);
    return Promise.resolve();
  });
});