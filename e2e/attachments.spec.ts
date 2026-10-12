import { test, expect, type Page } from "@playwright/test";

import { cleanupUsers, createWorkspace, registerUser, signIn, uniqueEmail } from "./helpers";

// Yêu cầu storage thật: chạy trên dev server (local disk) hoặc prod có R2 /
// ATTACHMENT_UPLOAD_DIR. Prod build trần (driver noop) fail là đúng —
// tab đính kèm bị ẩn, không phải bug.
// Đặt E2E_STORAGE=0 để skip khi chạy suite trên server đóng băng (xem docs/frozen-features.md).
test.skip(process.env.E2E_STORAGE === "0", "attachments frozen on this server");
test.setTimeout(180_000);

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
}

function taskCard(page: Page, title: string) {
  return page.locator("li").filter({ has: page.locator(`input[value="${title}"]`) });
}

test.describe("Attachments (Mốc 9)", () => {
  let ownerEmail: string;
  const wsName = "E2E Attachment Workspace";
  const projectName = "E2E Attachment Project";
  const taskTitle = "Task with files";

  test.beforeAll(async () => {
    ownerEmail = uniqueEmail("at");
  });

  test("owner uploads, downloads, and deletes an attachment", async ({ page, request }) => {
    await registerUser(request, "Owner User", ownerEmail);
    await signIn(page, ownerEmail);
    await createWorkspace(page, wsName);
    const workspaceId = /\/workspaces\/([^/]+)$/.exec(page.url())![1];

    await openProjects(page, workspaceId);
    await createProject(page, projectName);
    await createTask(page, taskTitle);
    await taskCard(page, taskTitle).getByRole("button", { name: "Open details" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();

    // Mở tab Attachments
    await page.getByRole("button", { name: /Attachments/ }).click();

    // Upload file (FR-090)
    await page.getByLabel("Attachment file").setInputFiles({
      name: "spec.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("hello attachment"),
    });
    await page.getByRole("button", { name: "Upload" }).click();
    await expect(page.getByText("spec.txt", { exact: true })).toBeVisible();
    await expect(page.getByText("16 B", { exact: true })).toBeVisible();

    // Download qua route authenticated (FR-091)
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("link", { name: /spec\.txt/ }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe("spec.txt");

    // Xoá attachment — uploader (FR-092)
    await page.getByRole("dialog").getByRole("button", { name: "Delete", exact: true }).click();
    await expect(
      page.getByRole("dialog").getByRole("link", { name: /spec\.txt/ }),
    ).toHaveCount(0);
    await expect(page.getByText(/No attachments yet\./)).toBeVisible();

    await page.getByLabel("Close modal").click();
    await cleanupUsers([ownerEmail]);
  });
});