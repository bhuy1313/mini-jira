import { test, expect } from "@playwright/test";
import { cleanupUsers, createWorkspace, registerUser, signIn, uniqueEmail } from "./helpers";

test.setTimeout(180_000);

test.describe("Webhooks & Integrations (Priority 3)", () => {
  let ownerEmail: string;
  const wsName = "E2E Webhooks Workspace";
  const projectName = "E2E Webhooks Project";

  test.beforeAll(async () => {
    ownerEmail = uniqueEmail("wh-owner");
  });

  test.afterAll(async () => {
    await cleanupUsers([ownerEmail]);
  });

  test("creates webhook, configures events, tests ping, and manages lifecycle", async ({
    page,
    request,
  }) => {
    // 1. Register and sign in as Owner
    await registerUser(request, "Webhook Owner", ownerEmail);
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

    // 3. Go to Project Settings -> Webhooks Panel
    await page.goto(`/workspaces/${workspaceId}/projects/${projectId}/settings`);
    await expect(
      page.getByRole("heading", { name: "Webhooks & Integrations" }),
    ).toBeVisible();

    // 4. Click "Add webhook"
    await page.getByRole("button", { name: "Add webhook" }).click();
    const whDialog = page.getByRole("dialog", { name: "Add Project Webhook" });
    await expect(whDialog).toBeVisible();

    // Fill webhook form
    await whDialog.getByLabel("Webhook Name").fill("Slack Dev Alerts");
    await whDialog.getByLabel("Payload Format").selectOption("Slack");
    await whDialog.getByLabel("Endpoint URL").fill("https://hooks.slack.com/services/T000/B000/XXXXX");

    await whDialog.getByRole("button", { name: "Add webhook" }).click();
    await expect(whDialog).toBeHidden();

    // 5. Verify created webhook is displayed
    await expect(page.getByText("Slack Dev Alerts")).toBeVisible();
    await expect(page.getByText("Slack", { exact: true })).toBeVisible();
    await expect(page.getByText("Active")).toBeVisible();

    // 6. Test Ping button
    await page.getByRole("button", { name: "Test" }).first().click();
    // Test execution attempts delivery and returns status feedback
    await expect(
      page.getByText(/Test Passed|Test Failed/),
    ).toBeVisible({ timeout: 10_000 });

    // 7. Toggle Disable / Enable
    await page.getByRole("button", { name: "Disable" }).first().click();
    await expect(page.getByText("Disabled")).toBeVisible();

    await page.getByRole("button", { name: "Enable" }).first().click();
    await expect(page.getByText("Active")).toBeVisible();

    // 8. Delete Webhook
    page.on("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Delete webhook Slack Dev Alerts" }).click();
    await expect(page.getByText("Slack Dev Alerts")).toHaveCount(0);
  });
});
