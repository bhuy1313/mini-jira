import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { createWorkspace, registerUser, signIn, uniqueEmail } from "./helpers";

test.describe("UI/UX Accessibility (a11y) Audits with Playwright", () => {
  const email = uniqueEmail("a11y-user");

  test("Auth and Login pages satisfy WCAG 2.2 AA standards", async ({ page, request }) => {
    await registerUser(request, "A11y Auditor", email);
    await page.goto("/auth");

    const authScanResults = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .disableRules(["color-contrast"])
      .analyze();

    expect(authScanResults.violations).toEqual([]);
  });

  test("Workspace & Kanban board satisfy accessibility rules", async ({ page }) => {
    await signIn(page, email);
    const wsName = `A11y WS ${Date.now()}`;
    await createWorkspace(page, wsName);

    // Create a project
    await page.getByRole("link", { name: "Projects" }).first().click();
    await page.waitForURL(/\/projects$/);
    await page.getByRole("button", { name: "New project" }).click();
    const projDialog = page.getByRole("dialog", { name: "Create Project" });
    await projDialog.getByLabel("Project name").fill("A11y Project");
    await projDialog.getByRole("button", { name: "Create project" }).click();
    await page.waitForURL(/\/projects\/[^/]+$/);
    // Next.js clears document.title briefly while the loading shell commits;
    // wait for it to settle so the axe document-title rule sees the real head.
    await page.waitForFunction(() => document.title !== "");

    // Run Axe scan on Kanban board
    const boardScanResults = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .disableRules(["color-contrast"])
      .analyze();

    expect(boardScanResults.violations).toEqual([]);
  });
});
