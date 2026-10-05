import { test, expect, type BrowserContext, type Page } from "@playwright/test";

import { cleanupUsers, createWorkspace, registerUser, signIn, uniqueEmail } from "./helpers";

test.setTimeout(240_000);

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

async function addMember(page: Page, workspaceId: string, email: string): Promise<void> {
  await page.goto(`/workspaces/${workspaceId}/members`);
  await page.getByRole("button", { name: "Add member" }).click();
  const dialog = page.getByRole("dialog", { name: "Add Workspace Member" });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Member email").fill(email);
  await dialog.getByRole("button", { name: "Add member" }).click();
  await expect(dialog).toBeHidden();
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
  ).toBeVisible({ timeout: 10_000 });
}

/** Locator cho thẻ task theo title — matching qua input value (title là input, không phải text). */
function taskCard(page: Page, title: string) {
  return page.locator("li").filter({ has: page.locator(`input[value="${title}"]`) });
}

const bell = (page: Page) => page.getByRole("button", { name: /Notifications/ });

async function expectUnread(page: Page, count: number): Promise<void> {
  const label = count > 0 ? `Notifications, ${count} unread` : "Notifications";
  await expect(bell(page)).toHaveAttribute("aria-label", label, { timeout: 10_000 });
}

/**
 * UC-015: Real-time sync (Mốc 14)
 *
 * Dùng SSE in-process giữa 2 browser context (2 user khác nhau) + 2 tab của
 * cùng user:
 * 1. Owner mở board; member mở board (context riêng). Owner tạo task "Alpha" →
 *    board của member hiện "Alpha" KHÔNG reload.
 * 2. Owner move "Alpha" sang In Progress → board member cập nhật vị trí.
 * 3. Owner gán Alpha cho member → member nhận TaskAssigned real-time (badge 1).
 * 4. Member comment → owner nhận NewComment real-time (badge 1).
 * 5. Member mở tab thứ 2, "Mark all as read" ở tab 2 → badge tab 1 về 0
 *    (notifyRead real-time).
 */
test.describe("UC-015: Real-time sync", () => {
  let ownerEmail: string;
  let memberEmail: string;
  const wsName = "E2E Live Workspace";
  const projectName = "E2E Live Project";
  const taskA = "Alpha";

  test.beforeAll(async () => {
    ownerEmail = uniqueEmail("lo");
    memberEmail = uniqueEmail("lm");
  });

  test("board + notifications sync across users and tabs without reload", async ({
    page,
    request,
    browser,
  }) => {
    // Setup: owner + workspace + member + project
    await registerUser(request, "Owner User", ownerEmail);
    await registerUser(request, "Member User", memberEmail);
    await signIn(page, ownerEmail);
    await createWorkspace(page, wsName);
    const workspaceId = /\/workspaces\/([^/]+)$/.exec(page.url())![1];
    await addMember(page, workspaceId, memberEmail);

    await openProjects(page, workspaceId);
    const projectId = await createProject(page, projectName);
    const boardUrl = `/workspaces/${workspaceId}/projects/${projectId}`;

    // 2. Member mở board trên context riêng (session riêng).
    const memberCtx: BrowserContext = await browser.newContext();
    const memberPage = await memberCtx.newPage();
    await signIn(memberPage, memberEmail);
    await memberPage.goto(boardUrl);
    await memberPage.waitForURL(/\/projects\/[^/]+$/);

    // 1. Owner tạo task → board member update real-time.
    await createTask(page, taskA);
    await expectTaskInColumn(memberPage, "To Do", taskA);

    // 2. Owner move sang In Progress → board member theo sau.
    await taskCard(page, taskA).getByLabel(`Move ${taskA}`).selectOption({ label: "In Progress" });
    await expectTaskInColumn(memberPage, "In Progress", taskA);

    // 3. Owner assign cho member → member nhận TaskAssigned real-time (badge 2:
    //    WorkspaceInvited trước đó + TaskAssigned vừa có).
    await taskCard(page, taskA).getByRole("button", { name: "Open details" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("dialog").getByLabel("Assignee").selectOption({ label: "Member User" });
    await page.waitForTimeout(500);
    await page.getByLabel("Close modal").click();
    await expectUnread(memberPage, 2);

    // 4. Member comment → owner (creator) nhận NewComment real-time (badge 1).
    await taskCard(memberPage, taskA).getByRole("button", { name: "Open details" }).click();
    await expect(memberPage.getByRole("dialog")).toBeVisible();
    await memberPage.getByLabel("Comment content").fill("Live reply");
    await memberPage.getByRole("button", { name: "Post comment" }).click();
    await expect(memberPage.getByText("Live reply")).toBeVisible();
    await page.waitForTimeout(500);
    await memberPage.getByLabel("Close modal").click();
    await expectUnread(page, 1);

    // 5. Member mở tab thứ 2 → mark all read ở tab 2 → badge tab 1 về 0.
    const memberTab2 = await memberCtx.newPage();
    await memberTab2.goto(boardUrl);
    await memberTab2.waitForURL(/\/projects\/[^/]+$/);
    await expectUnread(memberTab2, 2);
    await bell(memberTab2).click();
    await memberTab2.getByRole("button", { name: "Mark all as read" }).click();
    await expectUnread(memberTab2, 0);
    await expectUnread(memberPage, 0);

    await memberCtx.close();
    await cleanupUsers([ownerEmail, memberEmail]);
  });
});