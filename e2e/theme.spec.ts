import { test, expect } from "@playwright/test";
import { registerUser, signIn, uniqueEmail, createWorkspace, cleanupUsers } from "./helpers";

test.setTimeout(180_000);

test.describe("Theme System (Light / Dark / System)", () => {
  let userEmail: string;
  const wsName = "Theme Test Workspace";

  test.beforeAll(async () => {
    userEmail = uniqueEmail("theme");
  });

  test("can toggle theme via Header, Command Palette, and Account Appearance page", async ({
    page,
    request,
  }) => {
    await registerUser(request, "Theme User", userEmail);
    await signIn(page, userEmail);
    await createWorkspace(page, wsName);

    // 1. Test Quick Toggle in Workspace Header
    const themeBtn = page.getByRole("button", { name: /Toggle theme/i });
    await expect(themeBtn).toBeVisible();
    await themeBtn.click();

    // Select Dark
    await page.getByRole("menuitem", { name: /Dark/i }).click();
    await expect(page.locator("html")).toHaveClass(/dark/);

    // Select Light
    await themeBtn.click();
    await page.getByRole("menuitem", { name: /Light/i }).click();
    await expect(page.locator("html")).toHaveClass(/light/);

    // 2. Test via Command Palette (⌘K)
    await page.keyboard.press("Control+k");
    const palette = page.getByRole("dialog", { name: "Command palette" });
    await expect(palette).toBeVisible();
    await page.keyboard.type("Dark Theme");
    await page.keyboard.press("Enter");
    await expect(page.locator("html")).toHaveClass(/dark/);

    // 3. Test via Account Settings Appearance Tab
    await page.goto("/account");
    await page.getByRole("tab", { name: "Appearance" }).click();
    const appearanceSection = page.getByRole("region", { name: "Theme appearance settings" });
    await expect(appearanceSection).toBeVisible();

    // Click Light Mode card
    await appearanceSection.getByRole("radio", { name: /Light Mode/i }).click();
    await expect(page.locator("html")).toHaveClass(/light/);

    // Click Dark Mode card
    await appearanceSection.getByRole("radio", { name: /Dark Mode/i }).click();
    await expect(page.locator("html")).toHaveClass(/dark/);
    const darkBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(darkBg).toBe("rgb(11, 21, 20)");

    // Click Light Mode card
    await appearanceSection.getByRole("radio", { name: /Light Mode/i }).click();
    await expect(page.locator("html")).toHaveClass(/light/);
    const lightBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(lightBg).toBe("rgb(244, 250, 248)");

    await cleanupUsers([userEmail]);
  });
});
