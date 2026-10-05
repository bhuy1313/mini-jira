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
  await expectTaskInColumn(page, "To Do", title);
}

/** Locator cho một cột Kanban theo tiêu đề (e.g. "In Progress"). */
function column(page: Page, label: string) {
  return page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: new RegExp("^" + label) }) });
}

async function expectTaskInColumn(page: Page, columnLabel: string, title: string): Promise<void> {
  await expect(
    column(page, columnLabel)
      .getByText(title, { exact: true })
      .or(column(page, columnLabel).locator(`input[value="${title}"]`)),
  ).toBeVisible();
}

/** Locator cho thẻ task theo title — matching qua input value (title là input, không phải text). */
function taskCard(page: Page, title: string) {
  return page.locator("li").filter({ has: page.locator(`input[value="${title}"]`) });
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

test.describe("Task board (Owner) — create, move, edit, assign, delete", () => {
  let ownerEmail: string;
  let memberEmail: string;
  const wsName = "E2E Task Workspace";
  const projectName = "E2E Task Project";
  const taskA = "Write spec";
  const taskB = "Write tests";

  test.beforeAll(async () => {
    ownerEmail = uniqueEmail("to");
    memberEmail = uniqueEmail("tm");
  });

  test("creates tasks, moves columns, edits title, assigns, and deletes", async ({
    page,
    request,
  }) => {
    await registerUser(request, "Owner User", ownerEmail);
    await registerUser(request, "Member User", memberEmail);
    await signIn(page, ownerEmail);
    await createWorkspace(page, wsName);
    const workspaceId = /\/workspaces\/([^/]+)$/.exec(page.url())![1];
    await addMember(page, workspaceId, memberEmail);

    await openProjects(page, workspaceId);
    await createProject(page, projectName);

    // Board shows empty To Do column.
    await expect(column(page, "To Do").getByText("No tasks.")).toBeVisible();

    // Create two tasks (FR-040) — appear in To Do (FR-050).
    await createTask(page, taskA);
    await createTask(page, taskB);
    await expectTaskInColumn(page, "To Do", taskA);
    await expectTaskInColumn(page, "To Do", taskB);

    // Move taskA to In Progress (FR-045, FR-051).
    await taskCard(page, taskA).getByLabel(`Move ${taskA}`).selectOption({ label: "In Progress" });
    await expectTaskInColumn(page, "In Progress", taskA);
    await expectTaskInColumn(page, "To Do", taskB);

    // Move taskB to Done, then update its title (FR-042, Owner edits everything).
    await taskCard(page, taskB).getByLabel(`Move ${taskB}`).selectOption({ label: "Done" });
    await expectTaskInColumn(page, "Done", taskB);
    const renamed = "Write tests v2";
    const card = taskCard(page, "Write tests");
    await card.locator('input[name="title"]').fill(renamed);
    await card.locator('input[name="title"]').press("Enter");
    await expectTaskInColumn(page, "Done", renamed);

    // Assign taskA to the member (FR-044).
    const aCard = taskCard(page, taskA);
    await aCard.getByRole("button", { name: "Open details" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("dialog").getByLabel("Assignee").selectOption({ label: "Member User" });
    await page.getByLabel("Close modal").click();
    await expect(taskCard(page, taskA).getByText("Member User", { exact: true })).toBeVisible();

    // Delete taskB (FR-043).
    await taskCard(page, renamed).getByRole("button", { name: "Delete" }).click();
    await expect(page.getByText(renamed, { exact: true })).toHaveCount(0);

    await cleanupUsers([ownerEmail, memberEmail]);
    return Promise.resolve();
  });
});

test.describe("Task authorization — Member", () => {
  let ownerEmail: string;
  let memberEmail: string;
  const wsName = "E2E Auth Workspace";
  const projectName = "E2E Auth Project";
  const taskTitle = "Shared task";

  test.beforeAll(async () => {
    ownerEmail = uniqueEmail("ao");
    memberEmail = uniqueEmail("am");
  });

  test("member can move their assigned task but cannot assign/priority (UI + denied)", async ({
    page,
    request,
  }) => {
    await registerUser(request, "Owner User", ownerEmail);
    await registerUser(request, "Member User", memberEmail);
    await signIn(page, ownerEmail);
    await createWorkspace(page, wsName);
    const workspaceId = /\/workspaces\/([^/]+)$/.exec(page.url())![1];
    await addMember(page, workspaceId, memberEmail);

    await openProjects(page, workspaceId);
    const projectId = await createProject(page, projectName);

    // Owner creates a task and assigns it to the member.
    await createTask(page, taskTitle);
    const card = taskCard(page, taskTitle);
    await card.getByRole("button", { name: "Open details" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("dialog").getByLabel("Assignee").selectOption({ label: "Member User" });
    await page.getByLabel("Close modal").click();
    await expect(taskCard(page, taskTitle).getByText("Member User", { exact: true })).toBeVisible();

    // Sign out owner, sign in as member.
    await page.getByRole("button", { name: "Sign out" }).click();
    await page.waitForURL(/\/auth$/);
    await signIn(page, memberEmail);
    await page.goto(`/workspaces/${workspaceId}/projects/${projectId}`);
    await expect(
      page.getByText(taskTitle, { exact: true }).or(page.locator(`input[value="${taskTitle}"]`)),
    ).toBeVisible();

    // Member's card: no assignee/priority/delete controls (BR-009 UI hiding),
    // and the member's detail modal exposes no assignee/priority selectors.
    await expect(page.locator('select[name="assigneeId"]')).toHaveCount(0);
    await expect(page.locator('select[name="priority"]')).toHaveCount(0);
    await expect(taskCard(page, taskTitle).getByRole("button", { name: "Delete" })).toHaveCount(0);

    await taskCard(page, taskTitle).getByRole("button", { name: "Open details" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByRole("dialog").getByLabel("Assignee")).toHaveCount(0);
    await expect(page.getByRole("dialog").getByLabel("Priority")).toHaveCount(0);
    await page.getByLabel("Close modal").click();

    await page.getByLabel(`Move ${taskTitle}`).selectOption({ label: "In Progress" });
    await expectTaskInColumn(page, "In Progress", taskTitle);

    await cleanupUsers([ownerEmail, memberEmail]);
    return Promise.resolve();
  });
});
