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
  await expect(page.locator(`input[value="${title}"]`)).toBeVisible();
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

const bell = (page: Page) => page.getByRole("button", { name: /Notifications/ });

async function expectUnread(page: Page, count: number): Promise<void> {
  const label = count > 0 ? `Notifications, ${count} unread` : "Notifications";
  await expect(bell(page)).toHaveAttribute("aria-label", label, { timeout: 10_000 });
}

/**
 * UC-014: In-app notifications (Mốc 13)
 *
 * Scenario:
 * 1. Owner tạo workspace, add member → member nhận WorkspaceInvited.
 * 2. Owner tạo project, task, gán task cho member → member nhận TaskAssigned.
 * 3. Member đăng nhập: bell hiện 2 chưa đọc; click TaskAssigned → điều hướng tới
 *    project, badge còn 1; "Mark all as read" → badge tắt.
 * 4. Member comment lên task (creator = Owner) → Owner nhận NewComment.
 * 5. Owner đăng nhập lại: bell hiện 1 chưa đọc, dropdown thấy "New comment on".
 */
test.describe("UC-014: Notifications", () => {
  let ownerEmail: string;
  let memberEmail: string;
  const wsName = "E2E Notify Workspace";
  const projectName = "E2E Notify Project";
  const taskTitle = "Spec task";

  test.beforeAll(async () => {
    ownerEmail = uniqueEmail("no");
    memberEmail = uniqueEmail("nm");
  });

  test("assignments, invites and comments surface as badge + dropdown", async ({
    page,
    request,
  }) => {
    // 1. Setup users, workspace, member
    await registerUser(request, "Owner User", ownerEmail);
    await registerUser(request, "Member User", memberEmail);
    await signIn(page, ownerEmail);
    await createWorkspace(page, wsName);
    const workspaceId = /\/workspaces\/([^/]+)$/.exec(page.url())![1];
    await addMember(page, workspaceId, memberEmail);

    // 2. Project + task assigned to member
    await openProjects(page, workspaceId);
    const projectId = await createProject(page, projectName);
    await createTask(page, taskTitle);

    const ownerTaskCard = page.locator("li").filter({ has: page.locator(`input[value="${taskTitle}"]`) });
    await ownerTaskCard.getByRole("button", { name: "Open details" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("dialog").getByLabel("Assignee").selectOption({ label: "Member User" });
    await page.getByLabel("Close modal").click();

    // 3. Member: sees WorkspaceInvited + TaskAssigned (unread 2)
    await page.getByRole("button", { name: "Sign out" }).click();
    await page.waitForURL(/\/auth$/);
    await signIn(page, memberEmail);

    await page.goto(`/workspaces/${workspaceId}/projects/${projectId}`);
    await page.waitForURL(/\/projects\/[^/]+$/);
    await expectUnread(page, 2);

    // Open dropdown: both notifications present
    await bell(page).click();
    await expect(page.getByText("You were added to the workspace")).toBeVisible();
    await expect(page.getByText(/You were assigned to/)).toBeVisible();

    // Click TaskAssigned → navigates to project board, badge decrements to 1
    await page.getByText(/You were assigned to/).click();
    await page.waitForURL(/\/projects\/[^/]+$/);
    await expectUnread(page, 1);

    // "Mark all as read" clears the badge
    await bell(page).click();
    await page.getByRole("button", { name: "Mark all as read" }).click();
    await expectUnread(page, 0);
    // Dropdown vẫn mở: nút "Mark all as read" đã ẩn; đóng dropdown bằng backdrop.
    await expect(page.getByRole("button", { name: "Mark all as read" })).toHaveCount(0);
    await page.locator("div.fixed.inset-0").click();

    // 4. Member comments on the task → owner (creator) gets NewComment
    await page.getByRole("button", { name: "Open details" }).first().click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByLabel("Comment content").fill("Notification reply");
    await page.getByRole("button", { name: "Post comment" }).click();
    await expect(page.getByText("Notification reply")).toBeVisible();
    await page.getByLabel("Close modal").click();

    // 5. Owner: NewComment unread
    await page.getByRole("button", { name: "Sign out" }).click();
    await page.waitForURL(/\/auth$/);
    await signIn(page, ownerEmail);

    await page.goto(`/workspaces/${workspaceId}/projects/${projectId}`);
    await page.waitForURL(/\/projects\/[^/]+$/);
    await expectUnread(page, 1);
    await bell(page).click();
    await expect(page.getByText(/New comment on/)).toBeVisible();

    await cleanupUsers([ownerEmail, memberEmail]);
  });
});