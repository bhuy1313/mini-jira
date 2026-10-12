// Email OTP verification gate — chạy KHÔNG E2E=1, CÓ REQUIRE_EMAIL_VERIFICATION=1
// và CÓ EMAIL_ENABLED=1 (local .env đã có sẵn cả hai; Vercel prod để trống cả hai
// cho tới khi verify domain Resend).
// Đặt E2E_EMAIL=0 để skip khi chạy suite trên server đóng băng (xem docs/frozen-features.md).
test.skip(process.env.E2E_EMAIL === "0", "email frozen on this server");
import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Pool } from "pg";

import { cleanupUsers, registerUser, uniqueEmail } from "./helpers";

test.setTimeout(180_000);

function loadDbUrl(): string {
  const raw = readFileSync(resolve(process.cwd(), ".env"), "utf8");
  const m = /^DATABASE_URL="?([^"\r\n]*)"?\s*$/m.exec(raw);
  if (!m) throw new Error("DATABASE_URL missing from .env");
  return m[1];
}

/** OTP đang hiệu lực của email (storeOTP plain, value dạng "mã:số-lần-thử"). */
async function readOtp(email: string): Promise<string> {
  const pool = new Pool({ connectionString: loadDbUrl() });
  try {
    for (let i = 0; i < 10; i++) {
      const res = await pool.query(
        "SELECT value FROM verification WHERE identifier = $1 ORDER BY \"updatedAt\" DESC LIMIT 1",
        [`email-verification-otp-${email}`],
      );
      if (res.rows.length > 0) {
        const raw = String(res.rows[0].value);
        return raw.slice(0, raw.lastIndexOf(":"));
      }
      await new Promise((r) => setTimeout(r, 500));
    }
    throw new Error(`No OTP row for ${email}`);
  } finally {
    await pool.end();
  }
}

async function uiRegister(page: Page, name: string, email: string, password: string) {
  await page.goto("/auth");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.getByLabel("Full name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Confirm password").fill(password);
  await page.locator("form").getByRole("button", { name: "Create account" }).click();
  await page.waitForURL(/\/auth\/verify-code\?email=/);
}

test.describe("Email OTP verification gate", () => {
  const emails: string[] = [];

  test.afterAll(async () => {
    await cleanupUsers(emails);
  });

  test("register → code → dashboard; login lại sau verify đi thẳng", async ({ page }) => {
    const email = uniqueEmail("otp");
    emails.push(email);

    await uiRegister(page, "Otp User", email, "Password123!");
    await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();

    const otp = await readOtp(email);
    await page.getByLabel("6-digit code").fill(otp);
    await page.getByRole("button", { name: "Verify email" }).click();
    await page.waitForURL(/\/dashboard/);

    // Đăng xuất (xóa session) rồi đăng nhập lại — đã verify nên qua thẳng
    await page.context().clearCookies();
    await page.goto("/auth");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password", { exact: true }).fill("Password123!");
    await page.locator("form").getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL(/\/dashboard/);
  });

  test("chưa verify mà đăng nhập → báo lỗi, sang trang mã thì qua", async ({ page, request }) => {
    const email = uniqueEmail("otp-gate");
    emails.push(email);
    await registerUser(request, "Gate User", email);

    await page.goto("/auth");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password", { exact: true }).fill("Password123!");
    await page.locator("form").getByRole("button", { name: "Sign in" }).click();
    // Gate chặn với lỗi chung (chống enumeration) — ở yên /auth kèm alert.
    await expect(page.getByRole("alert")).toBeVisible();
    await page.waitForURL(/\/auth$/);

    // Đi đường thủ công: link Verify your email → nhập mã → vào dashboard.
    await page.getByRole("link", { name: "Verify your email" }).click();
    await page.waitForURL(/\/auth\/verify-code$/);
    await page.getByLabel("Email").fill(email);
    const otp = await readOtp(email);
    await page.getByLabel("6-digit code").fill(otp);
    await page.getByRole("button", { name: "Verify email" }).click();
    await page.waitForURL(/\/dashboard/);
  });

  test("mã sai báo lỗi, mã resend dùng được", async ({ page }) => {
    const email = uniqueEmail("otp-wrong");
    emails.push(email);
    await uiRegister(page, "Wrong User", email, "Password123!");

    await page.getByLabel("6-digit code").fill("000000");
    await page.getByRole("button", { name: "Verify email" }).click();
    await expect(page.getByRole("alert")).toBeVisible();

    await page.getByRole("button", { name: "Resend code" }).click();
    await expect(page.getByText("A new code is on its way")).toBeVisible();
    const otp = await readOtp(email);
    await page.getByLabel("6-digit code").fill(otp);
    await page.getByRole("button", { name: "Verify email" }).click();
    await page.waitForURL(/\/dashboard/);
  });
});
