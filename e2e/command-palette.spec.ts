import { test, expect } from "@playwright/test";
import { cleanupUsers, createWorkspace, registerUser, signIn, uniqueEmail } from "./helpers";

test.describe("UI/UX Command Palette & Slide-over Drawer", () => {
  const emails: string[] = [];

  test.afterAll(async () => {
    await cleanupUsers(emails);
  });

  test("can trigger Command Palette and navigate to destinations", async ({ page, request }) => {
    const email = uniqueEmail("ux-cmd");
    emails.push(email);

    await registerUser(request, "Cmd Tester", email);
    await signIn(page, email);
    await createWorkspace(page, "Cmd WS");

    // Open Command Palette via search trigger button
    await page.getByRole("button", { name: /Quick search/i }).click();
    const palette = page.getByRole("dialog", { name: "Command palette" });
    await expect(palette).toBeVisible();

    // Type filter for Account
    await page.getByPlaceholder("Type a command or search destination...").fill("Account");
    await expect(page.getByText("Go to Account Settings")).toBeVisible();

    // Press Enter to navigate
    await page.keyboard.press("Enter");
    await page.waitForURL(/\/account$/);
    await expect(page.getByRole("heading", { name: "Cmd Tester" })).toBeVisible();
  });

  test("can open task detail in Slide-over Drawer and close with Escape", async ({ page, request }) => {
    const email = uniqueEmail("ux-drawer");
    emails.push(email);

    await registerUser(request, "Drawer Tester", email);
    await signIn(page, email);
    await createWorkspace(page, "Drawer WS");

    // Navigate to projects
    await page.getByRole("link", { name: "Projects" }).first().click();
    await page.waitForURL(/\/projects$/);

    // Create a project
    await page.getByRole("button", { name: "New project" }).click();
    const projDialog = page.getByRole("dialog", { name: "Create Project" });
    await expect(projDialog).toBeVisible();
    await projDialog.getByLabel("Project name").fill("Drawer Project");
    await projDialog.getByRole("button", { name: "Create project" }).click();
    await page.waitForURL(/\/projects\/[^/]+$/);

    // Create a task
    await page.getByRole("button", { name: "Create task" }).click();
    const createDialog = page.getByRole("dialog", { name: "Create Task" });
    await expect(createDialog).toBeVisible();
    await createDialog.getByLabel("Task title").fill("Verify Slide-over Drawer");
    await createDialog.getByRole("button", { name: "Create task" }).click();
    await expect(createDialog).toBeHidden();

    // Open task details via Open details button
    const card = page.locator("li").filter({ has: page.locator('input[value="Verify Slide-over Drawer"]') });
    await expect(card).toBeVisible();
    await card.getByRole("button", { name: "Open details" }).click();

    // Verify Drawer dialog is open
    const drawer = page.getByRole("dialog");
    await expect(drawer).toBeVisible();
    await expect(drawer.getByLabel("Task title")).toHaveValue("Verify Slide-over Drawer");

    // Close with Escape key
    await page.keyboard.press("Escape");
    await expect(drawer).not.toBeVisible();
  });
});
