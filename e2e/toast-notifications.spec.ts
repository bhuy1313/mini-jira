// Toast feedback (sonner) — text cố định, không tên động (bẫy public-api.spec).
import { test, expect, type Page } from "@playwright/test";

import { cleanupUsers, createWorkspace, registerUser, signIn, uniqueEmail } from "./helpers";

test.setTimeout(180_000);

const toaster = (page: Page) => page.locator("[data-sonner-toaster]");

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

async function createTask(page: Page, title: string): Promise<void> {
  await page.getByRole("button", { name: "Create task" }).click();
  const dialog = page.getByRole("dialog", { name: "Create Task" });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Task title").fill(title);
  await dialog.getByRole("button", { name: "Create task" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.locator(`input[value="${title}"]`)).toBeVisible();
}

function taskCard(page: Page, title: string) {
  return page.locator("li").filter({ has: page.locator(`input[value="${title}"]`) });
}

test.describe("Toast notifications", () => {
  const emails: string[] = [];

  test.afterAll(async () => {
    await cleanupUsers(emails);
  });

  test("task create/move cho toast text cố định, không rò tên task", async ({
    page,
    request,
  }) => {
    const email = uniqueEmail("toast");
    emails.push(email);
    const title = "Toast Probe Task Name";

    await registerUser(request, "Toast User", email);
    await signIn(page, email);
    await createWorkspace(page, "Toast WS");
    const workspaceId = /\/workspaces\/([^/]+)$/.exec(page.url())![1];
    await openProjects(page, workspaceId);
    await createProject(page, "Toast Project");

    // Create → "Task created", tên task không lọt vào vùng toast
    await createTask(page, title);
    await expect(toaster(page).getByText("Task created", { exact: true })).toBeVisible();
    await expect(toaster(page).getByText(title)).toHaveCount(0);

    // Move cột → "Task moved"
    await taskCard(page, title).getByLabel(`Move ${title}`).selectOption({ label: "In Progress" });
    await expect(toaster(page).getByText("Task moved", { exact: true })).toBeVisible();
  });

  test("tạo label cho toast cố định", async ({ page, request }) => {
    const email = uniqueEmail("toast-label");
    emails.push(email);

    await registerUser(request, "Toast Label User", email);
    await signIn(page, email);
    await createWorkspace(page, "Toast Label WS");
    const workspaceId = /\/workspaces\/([^/]+)$/.exec(page.url())![1];
    await openProjects(page, workspaceId);
    await createProject(page, "Toast Label Project");

    await page.getByRole("button", { name: /Labels/ }).click();
    const modal = page.getByRole("dialog", { name: "Manage Project Labels" });
    await expect(modal).toBeVisible();
    await modal.getByLabel("New label name").fill("Toast Label Name");
    await modal.getByRole("button", { name: "Add label" }).click();
    await expect(toaster(page).getByText("Label created", { exact: true })).toBeVisible();
    await expect(toaster(page).getByText("Toast Label Name")).toHaveCount(0);
  });
});
