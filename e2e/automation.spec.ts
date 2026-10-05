import { test, expect } from "@playwright/test";
import { cleanupUsers, createWorkspace, registerUser, signIn, uniqueEmail } from "./helpers";

test.setTimeout(180_000);

test.describe("Automation / Rules Engine (Milestone 19)", () => {
  let ownerEmail: string;
  const wsName = "E2E Automation Workspace";
  const projectName = "E2E Automation Project";

  test.beforeAll(async () => {
    ownerEmail = uniqueEmail("auto-owner");
  });

  test.afterAll(async () => {
    await cleanupUsers([ownerEmail]);
  });

  test("creates rule, triggers automation on status change, and verifies priority update + execution log", async ({
    page,
    request,
  }) => {
    // 1. Register and sign in as Owner
    await registerUser(request, "Auto Owner", ownerEmail);
    await signIn(page, ownerEmail);

    // 2. Create workspace & project
    await createWorkspace(page, wsName);
    const workspaceId = /\/workspaces\/([^/]+)$/.exec(page.url())![1];

    await page.goto(`/workspaces/${workspaceId}/projects`);
    await page.getByRole("button", { name: "New project" }).click();
    const projDialog = page.getByRole("dialog", { name: "Create Project" });
    await projDialog.getByLabel("Project name").fill(projectName);
    await projDialog.getByRole("button", { name: "Create project" }).click();
    await page.waitForURL(/\/projects\/[^/]+$/);
    const projectId = /\/projects\/([^/]+)$/.exec(page.url())![1];

    // 3. Go to Project Settings -> Automation Panel
    await page.goto(`/workspaces/${workspaceId}/projects/${projectId}/settings`);
    await expect(
      page.getByRole("heading", { name: "Automation / Rules Engine" }),
    ).toBeVisible();

    // 4. Click "Add rule"
    await page.getByRole("button", { name: "Add rule" }).click();
    const ruleDialog = page.getByRole("dialog", { name: "New Automation Rule" });
    await expect(ruleDialog).toBeVisible();

    // Fill rule form
    await ruleDialog.getByLabel("Rule Name").fill("Urgent when In Progress");
    await ruleDialog.getByLabel("Trigger Event").selectOption("StatusChanged");

    // Select To Status -> In Progress
    await ruleDialog.getByLabel("To Status").selectOption({ label: "In Progress" });

    // Select Action -> Change Priority to Urgent
    await ruleDialog.getByLabel("Action Type").selectOption("ChangePriority");
    await ruleDialog.getByLabel("Set Priority to").selectOption("Urgent");

    // Submit rule
    await ruleDialog.getByRole("button", { name: "Create rule" }).click();
    await expect(ruleDialog).toBeHidden();

    // Verify rule listed
    await expect(page.getByText("Urgent when In Progress")).toBeVisible();
    await expect(page.getByText("Active", { exact: true })).toBeVisible();

    // 5. Go to Board and create a task
    await page.goto(`/workspaces/${workspaceId}/projects/${projectId}`);
    await page.getByRole("button", { name: "Create task" }).click();
    const createDialog = page.getByRole("dialog", { name: "Create Task" });
    await expect(createDialog).toBeVisible();
    await createDialog.getByLabel("Task title").fill("Automation Test Task");
    await createDialog.getByLabel("Priority").selectOption("Low");
    await createDialog.getByRole("button", { name: "Create task" }).click();
    await expect(createDialog).toBeHidden();

    // Wait for task on board
    await expect(
      page.locator('input[value="Automation Test Task"]'),
    ).toBeVisible();

    // Open task details
    await page.getByRole("button", { name: "Open details" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel("Priority")).toHaveValue("Low");

    // 6. Change status to In Progress
    await dialog.getByLabel("Status").selectOption({ label: "In Progress" });

    // Wait for automation evaluation and reload
    await page.waitForTimeout(1000);
    await page.reload();

    // Reopen task detail to verify Priority was automatically updated to Urgent
    await page.getByRole("button", { name: "Open details" }).click();
    await expect(page.getByRole("dialog").getByLabel("Priority")).toHaveValue("Urgent");
    await page.getByRole("button", { name: "Close modal" }).click();

    // 7. Go to Project Settings -> Execution Logs tab
    await page.goto(`/workspaces/${workspaceId}/projects/${projectId}/settings`);
    await page.getByRole("button", { name: /Execution Logs/i }).click();

    // Verify log has Success entry for this rule
    await expect(page.getByText("Success").first()).toBeVisible();
    await expect(page.getByText("Urgent when In Progress").first()).toBeVisible();
  });
});
