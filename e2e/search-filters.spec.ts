// FTS backend (Mốc 17): search_vector @@ websearch_to_tsquery
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

async function createTask(
  page: Page,
  title: string,
  priority?: string,
  assigneeName?: string,
): Promise<void> {
  await page.getByRole("button", { name: "Create task" }).click();
  const dialog = page.getByRole("dialog", { name: "Create Task" });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Task title").fill(title);
  if (priority) {
    await dialog.getByLabel("Priority").selectOption(priority);
  }
  if (assigneeName) {
    await dialog.getByLabel("Assignee").selectOption({ label: assigneeName });
  }
  await dialog.getByRole("button", { name: "Create task" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.locator("li").filter({ has: page.locator(`input[value="${title}"]`) })).toBeVisible();
}

async function addMember(page: Page, workspaceId: string, email: string): Promise<void> {
  await page.goto(`/workspaces/${workspaceId}/members`);
  await page.getByRole("button", { name: "Add member" }).click();
  const dialog = page.getByRole("dialog", { name: "Add Workspace Member" });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Member email").fill(email);
  await dialog.getByRole("button", { name: "Add member" }).click();
  await expect(dialog).toBeHidden();
}

function taskCard(page: Page, title: string) {
  return page.locator("li").filter({ has: page.locator(`input[value="${title}"]`) });
}

test.describe("Search & Filters (Mốc 6 — FR-080..FR-085)", () => {
  let ownerEmail: string;
  let memberEmail: string;
  const wsName = "E2E Search Workspace";
  const projectName = "E2E Search Project";
  const task1 = "Implement authentication flow";
  const task2 = "Design database schema";
  const task3 = "Write deployment guide";

  test.beforeAll(async () => {
    ownerEmail = uniqueEmail("so");
    memberEmail = uniqueEmail("sm");
  });

  test("searches by title case-insensitively, filters by status, priority, assignee, and handles URL query params", async ({
    page,
    request,
  }) => {
    // 1. Setup workspace & member
    await registerUser(request, "Owner User", ownerEmail);
    await registerUser(request, "Member User", memberEmail);
    await signIn(page, ownerEmail);
    await createWorkspace(page, wsName);
    const workspaceId = /\/workspaces\/([^/]+)$/.exec(page.url())![1];
    await addMember(page, workspaceId, memberEmail);

    await openProjects(page, workspaceId);
    await createProject(page, projectName);

    // 2. Create tasks with distinct metadata
    await createTask(page, task1, "High", "Member User");
    await createTask(page, task2, "Urgent", "Owner User");
    await createTask(page, task3, "Low"); // Unassigned

    // Move task2 to InProgress, task3 to Done
    await taskCard(page, task2).getByLabel(`Move ${task2}`).selectOption({ label: "In Progress" });
    await taskCard(page, task3).getByLabel(`Move ${task3}`).selectOption({ label: "Done" });

    // All 3 tasks should be visible initially
    await expect(taskCard(page, task1)).toBeVisible();
    await expect(taskCard(page, task2)).toBeVisible();
    await expect(taskCard(page, task3)).toBeVisible();

    // 3. Search case-insensitive substring (FR-080, FR-085)
    const search = page.getByLabel("Search tasks");
    await search.fill("AUTHENTICATION");
    await page.waitForURL(/\?q=AUTHENTICATION/);
    await expect(taskCard(page, task1)).toBeVisible();
    await expect(taskCard(page, task2)).toHaveCount(0);
    await expect(taskCard(page, task3)).toHaveCount(0);

    // Clear search
    await search.fill("");
    await page.waitForURL((url) => !url.searchParams.has("q"));
    await expect(taskCard(page, task1)).toBeVisible();
    await expect(taskCard(page, task2)).toBeVisible();
    await expect(taskCard(page, task3)).toBeVisible();

    // 4. Filter by Status (FR-082)
    await page.getByLabel("Filter by status").selectOption({ label: "In Progress" });
    await page.waitForURL(/\?status=/);
    await expect(taskCard(page, task2)).toBeVisible();
    await expect(taskCard(page, task1)).toHaveCount(0);
    await expect(taskCard(page, task3)).toHaveCount(0);

    // Reset status filter
    await page.getByLabel("Filter by status").selectOption("");
    await page.waitForURL((url) => !url.searchParams.has("status"));

    // 5. Filter by Priority (FR-083)
    await page.getByLabel("Filter by priority").selectOption("Urgent");
    await page.waitForURL(/\?priority=Urgent/);
    await expect(taskCard(page, task2)).toBeVisible();
    await expect(taskCard(page, task1)).toHaveCount(0);
    await expect(taskCard(page, task3)).toHaveCount(0);

    // Reset priority filter
    await page.getByLabel("Filter by priority").selectOption("");
    await page.waitForURL((url) => !url.searchParams.has("priority"));

    // 6. Filter by Assignee: Unassigned (FR-084)
    await page.getByLabel("Filter by assignee").selectOption("unassigned");
    await page.waitForURL(/\?assignee=unassigned/);
    await expect(taskCard(page, task3)).toBeVisible();
    await expect(taskCard(page, task1)).toHaveCount(0);
    await expect(taskCard(page, task2)).toHaveCount(0);

    // 7. Clear filters button
    await page.getByRole("button", { name: "Clear filters" }).click();
    await page.waitForURL((url) => url.search === "");
    await expect(taskCard(page, task1)).toBeVisible();
    await expect(taskCard(page, task2)).toBeVisible();
    await expect(taskCard(page, task3)).toBeVisible();

    // 8. Empty filter result state
    await search.fill("NonExistentTaskKeyword");
    await expect(page.getByText("No tasks match your filters.")).toBeVisible();

    // Cleanup
    await cleanupUsers([ownerEmail, memberEmail]);
    return Promise.resolve();
  });

  test("finds tasks by key (KEY-123) even when the title does not match", async ({
    page,
    request,
  }) => {
    const email = uniqueEmail("sk");
    await registerUser(request, "Key Searcher", email);
    await signIn(page, email);
    await createWorkspace(page, "E2E Key Search Workspace");
    const workspaceId = /\/workspaces\/([^/]+)$/.exec(page.url())![1];

    await openProjects(page, workspaceId);
    await page.getByRole("button", { name: "New project" }).click();
    const projDialog = page.getByRole("dialog", { name: "Create Project" });
    await expect(projDialog).toBeVisible();
    await projDialog.getByLabel("Project name").fill("Key Search Project");
    await projDialog.getByLabel("Project key").fill("SKX");
    await projDialog.getByRole("button", { name: "Create project" }).click();
    await page.waitForURL(/\/projects\/[^/]+$/);

    await createTask(page, "Completely unrelated title words");

    const search = page.getByLabel("Search tasks");
    await search.fill("SKX-1");
    await page.waitForURL(/\?q=SKX-1/);
    await expect(taskCard(page, "Completely unrelated title words")).toBeVisible();

    await search.fill("SKX-9");
    await page.waitForURL(/\?q=SKX-9/);
    await expect(page.getByText("No tasks match your filters.")).toBeVisible();

    await cleanupUsers([email]);
  });
});
