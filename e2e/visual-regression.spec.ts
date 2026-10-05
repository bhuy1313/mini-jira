import { test, expect } from "@playwright/test";
import { cleanupUsers, createWorkspace, registerUser, signIn, uniqueEmail } from "./helpers";

test.describe("UI/UX Visual Regression Testing", () => {
  const emails: string[] = [];

  test.afterAll(async () => {
    await cleanupUsers(emails);
  });

  test("Auth Landing page matches visual snapshot", async ({ page }) => {
    await page.goto("/auth");
    await page.waitForLoadState("networkidle");

    // Mask dynamic text or time if any
    const main = page.getByRole("main");
    await expect(main).toBeVisible();

    await expect(page).toHaveScreenshot("auth-landing.png", {
      maxDiffPixelRatio: 0.05,
    });
  });

  test("Command Palette and Slide-over Drawer match visual snapshot", async ({ page, request }) => {
    const email = uniqueEmail("visual-user");
    emails.push(email);

    await registerUser(request, "Visual Tester", email);
    await signIn(page, email);
    await createWorkspace(page, "Visual WS");

    // Open projects
    await page.getByRole("link", { name: "Projects" }).first().click();
    await page.waitForURL(/\/projects$/);
    await page.getByRole("button", { name: "New project" }).click();
    const projDialog = page.getByRole("dialog", { name: "Create Project" });
    await projDialog.getByLabel("Project name").fill("Visual Project");
    await projDialog.getByRole("button", { name: "Create project" }).click();
    await page.waitForURL(/\/projects\/[^/]+$/);

    // Create a task
    await page.getByRole("button", { name: "Create task" }).click();
    const createDialog = page.getByRole("dialog", { name: "Create Task" });
    await expect(createDialog).toBeVisible();
    await createDialog.getByLabel("Task title").fill("Design Review Task");
    await createDialog.getByRole("button", { name: "Create task" }).click();
    await expect(createDialog).toBeHidden();

    // Verify Board visually
    const boardContainer = page.locator("div.space-y-4").first();
    await expect(boardContainer).toBeVisible();

    // Open Task Detail Drawer
    const card = page.locator("li").filter({ has: page.locator('input[value="Design Review Task"]') });
    await card.getByRole("button", { name: "Open details" }).click();
    const drawer = page.getByRole("dialog");
    await expect(drawer).toBeVisible();

    // Take screenshot of drawer
    await expect(drawer).toHaveScreenshot("task-drawer.png", {
      maxDiffPixelRatio: 0.05,
    });
  });
});
