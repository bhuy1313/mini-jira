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

test.describe("Comments & Activity History (UC-009)", () => {
  let ownerEmail: string;
  let memberEmail: string;
  const wsName = "E2E Comment Workspace";
  const projectName = "E2E Comment Project";
  const taskTitle = "Task with discussion";

  test.beforeAll(async () => {
    ownerEmail = uniqueEmail("co");
    memberEmail = uniqueEmail("cm");
  });

  test("collaborates via comments and tracks immutable activities", async ({
    page,
    request,
  }) => {
    // 1. Register users & setup workspace
    await registerUser(request, "Owner User", ownerEmail);
    await registerUser(request, "Member User", memberEmail);
    await signIn(page, ownerEmail);
    await createWorkspace(page, wsName);
    const workspaceId = /\/workspaces\/([^/]+)$/.exec(page.url())![1];
    await addMember(page, workspaceId, memberEmail);

    await openProjects(page, workspaceId);
    const projectId = await createProject(page, projectName);

    // 2. Create task
    await createTask(page, taskTitle);

    // 3. Open task detail modal
    await page.getByRole("button", { name: "Open details" }).first().click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.locator("#task-detail-title")).toHaveValue(taskTitle);

    // 4. Add comment as Owner
    await page.getByLabel("Comment content").fill("First comment from owner");
    await page.getByRole("button", { name: "Post comment" }).click();
    await expect(page.getByText("First comment from owner")).toBeVisible();
    await expect(page.getByRole("dialog").locator("li").filter({ hasText: "First comment from owner" }).getByText("Owner User")).toBeVisible();

    // 5. Edit own comment as Owner
    const ownerCommentItem = page.getByRole("dialog").locator("li").filter({ hasText: "First comment from owner" });
    await ownerCommentItem.getByRole("button", { name: "Edit" }).click();
    await ownerCommentItem.locator('textarea[name="content"]').fill("First comment edited by owner");
    await ownerCommentItem.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("First comment edited by owner")).toBeVisible();

    // 6. Check Activity History tab
    await page.getByRole("button", { name: /Activity/ }).click();
    await expect(page.getByText("created this task")).toBeVisible();

    // Close modal
    await page.getByLabel("Close modal").click();
    await expect(page.getByRole("dialog")).toHaveCount(0);

    // 7. Sign out Owner and sign in as Member
    await page.getByRole("button", { name: "Sign out" }).click();
    await page.waitForURL(/\/auth$/);
    await signIn(page, memberEmail);

    // Navigate to project
    await page.goto(`/workspaces/${workspaceId}/projects/${projectId}`);
    await page.getByRole("button", { name: "Open details" }).first().click();
    await expect(page.getByRole("dialog")).toBeVisible();

    // Member sees Owner's comment
    await expect(page.getByText("First comment edited by owner")).toBeVisible();

    // Member CANNOT edit or delete Owner's comment (FR-062, FR-063)
    const commentItem = page.locator("li").filter({ hasText: "First comment edited by owner" });
    await expect(commentItem.getByRole("button", { name: "Edit" })).toHaveCount(0);
    await expect(commentItem.getByRole("button", { name: "Delete" })).toHaveCount(0);

    // Member adds a comment
    await page.getByLabel("Comment content").fill("Member reply");
    await page.getByRole("button", { name: "Post comment" }).click();
    await expect(page.getByText("Member reply")).toBeVisible();

    // Member CAN edit own comment
    const memberCommentItem = page.locator("li").filter({ hasText: "Member reply" });
    await expect(memberCommentItem.getByRole("button", { name: "Edit" })).toBeVisible();

    // Close modal & sign out Member
    await page.getByLabel("Close modal").click();
    await page.getByRole("button", { name: "Sign out" }).click();
    await page.waitForURL(/\/auth$/);

    // 8. Sign back in as Owner to verify Owner can delete Member's comment (FR-063)
    await signIn(page, ownerEmail);
    await page.goto(`/workspaces/${workspaceId}/projects/${projectId}`);
    await page.getByRole("button", { name: "Open details" }).first().click();

    const memberCommentFromOwnerView = page.locator("li").filter({ hasText: "Member reply" });
    await expect(memberCommentFromOwnerView).toBeVisible();
    // Owner CANNOT edit Member's comment (FR-062)
    await expect(memberCommentFromOwnerView.getByRole("button", { name: "Edit" })).toHaveCount(0);
    // Owner CAN delete Member's comment (FR-063)
    await expect(memberCommentFromOwnerView.getByRole("button", { name: "Delete" })).toBeVisible();
    await memberCommentFromOwnerView.getByRole("button", { name: "Delete" }).click();
    await expect(page.getByText("Member reply")).toHaveCount(0);

    // Cleanup
    await cleanupUsers([ownerEmail, memberEmail]);
    return Promise.resolve();
  });
});
