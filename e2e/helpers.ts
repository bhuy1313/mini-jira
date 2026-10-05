import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { APIRequestContext, Page } from "@playwright/test";
import { Pool } from "pg";

export const TEST_PASSWORD = "Passw0rd123!";

function loadEnv(): Record<string, string> {
  const raw = readFileSync(resolve(process.cwd(), ".env"), "utf8");
  const out: Record<string, string> = {};
  for (const line of raw.split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*"?([^"\r\n]*)"?\s*$/.exec(line);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

export function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}@test.local`;
}

export async function registerUser(
  request: APIRequestContext,
  name: string,
  email: string,
): Promise<void> {
  const { BETTER_AUTH_URL } = loadEnv();
  const res = await request.post("/api/auth/sign-up/email", {
    headers: { Origin: BETTER_AUTH_URL || "http://localhost:3000" },
    data: { name, email, password: TEST_PASSWORD },
  });
  if (!res.ok()) {
    throw new Error(`Signup failed for ${email}: ${res.status()} ${await res.text()}`);
  }
}

async function pool(): Promise<Pool> {
  const { DATABASE_URL } = loadEnv();
  return new Pool({ connectionString: DATABASE_URL });
}

/** Delete test users by email (cascades their memberships). Best-effort cleanup. */
export async function cleanupUsers(emails: string[]): Promise<void> {
  if (emails.length === 0) return;
  const p = await pool();
  try {
    // Delete tasks created by these users first (creator FK is RESTRICT); this also
    // cascades their comments/activity. Then the user rows can be removed.
    await p.query(
      'DELETE FROM "task" WHERE "creatorId" IN (SELECT "id" FROM "user" WHERE "email" = ANY($1::text[]))',
      [emails],
    );
    await p.query("DELETE FROM \"user\" WHERE email = ANY($1::text[])", [emails]);
  } catch (err) {
    console.warn("E2E cleanup failed:", (err as Error).message);
  } finally {
    await p.end();
  }
}

/** Sign in an already-registered user via the login UI. Lands on /workspaces. */
export async function signIn(page: Page, email: string): Promise<void> {
  await page.goto("/auth");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(TEST_PASSWORD);
  await page.locator("form").getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/workspaces$/);
}

/** Create a workspace via the UI. Lands on /workspaces/<id>. */
export async function createWorkspace(page: Page, name: string): Promise<void> {
  if (!/\/workspaces$/.test(page.url())) {
    await page.goto("/workspaces");
  }
  await page.getByRole("button", { name: "New workspace" }).click();
  await page.getByLabel("Workspace name").fill(name);
  await page.getByRole("button", { name: "Create workspace" }).click();
  await page.waitForURL(/\/workspaces\/[^/]+$/);
}

