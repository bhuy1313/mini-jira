import { test, expect, type Page } from "@playwright/test";
import { cleanupUsers, createWorkspace, registerUser, signIn, uniqueEmail } from "./helpers";

test.setTimeout(180_000);

async function createProject(page: Page, name: string): Promise<string> {
  await page.getByRole("button", { name: "New project" }).click();
  const dialog = page.getByRole("dialog", { name: "Create Project" });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Project name").fill(name);
  await dialog.getByRole("button", { name: "Create project" }).click();
  await page.waitForURL(/\/projects\/[^/]+$/);
  return /\/projects\/([^/]+)$/.exec(page.url())![1];
}

async function createTaskWithDescription(page: Page, title: string, description: string): Promise<void> {
  await page.getByRole("button", { name: "Create task" }).click();
  const dialog = page.getByRole("dialog", { name: "Create Task" });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Task title").fill(title);
  await dialog.getByLabel("Task description").fill(description);
  await dialog.getByRole("button", { name: "Create task" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.locator(`input[value="${title}"]`)).toBeVisible();
}

test.describe("Markdown Authoring & @Mentions (Milestone 24)", () => {
  let ownerEmail: string;
  let memberEmail: string;
  const wsName = "E2E Markdown Workspace";
  const projectName = "E2E Markdown Project";
  const taskTitle = "Markdown Task Test";

  test.beforeAll(async () => {
    ownerEmail = uniqueEmail("md-owner");
    memberEmail = uniqueEmail("md-member");
  });

  test("renders formatted markdown, prevents XSS, and supports @mention in comments", async ({
    page,
    request,
  }) => {
    // 1. Register Owner & Member
    await registerUser(request, "Markdown Owner", ownerEmail);
    await registerUser(request, "Alice Member", memberEmail);

    // 2. Sign in as Owner and setup workspace + member
    await signIn(page, ownerEmail);
    await createWorkspace(page, wsName);
    const workspaceId = /\/workspaces\/([^/]+)$/.exec(page.url())![1];

    // Add member
    await page.goto(`/workspaces/${workspaceId}/members`);
    await page.getByRole("button", { name: "Add member" }).click();
    const addMemberDialog = page.getByRole("dialog", { name: "Add Workspace Member" });
    await expect(addMemberDialog).toBeVisible();
    await addMemberDialog.getByLabel("Member email").fill(memberEmail);
    await addMemberDialog.getByRole("button", { name: "Add member" }).click();
    await expect(addMemberDialog).toBeHidden();

    // Create Project
    await page.goto(`/workspaces/${workspaceId}/projects`);
    const projectId = await createProject(page, projectName);

    // 3. Create Task with Markdown Description
    const markdownDesc = "## Feature Overview\n**Important:** Please review the following checklist:\n- Item 1\n- Item 2\n\n```ts\nconst x: number = 42;\n```\n[Malicious Link](javascript:alert(1))";
    await createTaskWithDescription(page, taskTitle, markdownDesc);

    // 4. Open Task Detail Drawer & Switch to Preview to Verify Rendered Elements
    const card = page.locator("li").filter({ has: page.locator(`input[value="${taskTitle}"]`) });
    await card.getByRole("button", { name: "Open details" }).click();
    const drawer = page.getByRole("dialog");
    await expect(drawer).toBeVisible();

    // Click Preview button on the description editor
    await drawer.getByRole("button", { name: "Preview" }).first().click();

    // Verify Heading, Bold, List, and Code block are rendered as React elements
    await expect(drawer.getByRole("heading", { name: "Feature Overview" })).toBeVisible();
    await expect(drawer.locator("strong").filter({ hasText: "Important:" })).toBeVisible();
    await expect(drawer.locator("li").filter({ hasText: "Item 1" })).toBeVisible();
    await expect(drawer.locator("pre").filter({ hasText: "const x: number = 42;" })).toBeVisible();

    // Verify XSS Safety: javascript: URL is stripped (no executable <a> link with javascript: protocol)
    await expect(drawer.locator('a[href^="javascript:"]')).toHaveCount(0);

    // 5. Test @mention in comments
    const commentEditor = drawer.getByLabel("Comment content");
    await commentEditor.fill("Hello @Ali");

    // Verify mention listbox opens with filtered candidate
    const listbox = drawer.getByRole("listbox", { name: "Mention a workspace member" });
    await expect(listbox).toBeVisible();
    await expect(listbox.getByText("@Alice Member")).toBeVisible();

    // Select candidate via keyboard (Enter)
    await commentEditor.press("Enter");
    await expect(listbox).toBeHidden();

    // Submit comment
    await drawer.getByRole("button", { name: "Post comment" }).click();

    // Verify mention is rendered with highlight chip
    const commentItem = drawer.locator("li").filter({ hasText: "Hello @Alice Member" });
    await expect(commentItem).toBeVisible();
    await expect(commentItem.locator("span").filter({ hasText: "@Alice Member" })).toBeVisible();

    // Cleanup
    await cleanupUsers([ownerEmail, memberEmail]);
  });
});
