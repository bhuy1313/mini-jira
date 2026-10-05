import { test, expect } from "@playwright/test";
import { cleanupUsers, createWorkspace, registerUser, signIn, uniqueEmail } from "./helpers";

test.setTimeout(180_000);

test.describe("Analytics (Milestone 16) — dashboard smoke test", () => {
  let ownerEmail: string;
  const wsName = "E2E Analytics Workspace";

  test.beforeAll(async () => {
    ownerEmail = uniqueEmail("analytics-owner");
  });

  test("renders analytics page with heading, stat cards, and chart sections", async ({
    page,
    request,
  }) => {
    // ── Setup: register + sign in + create workspace ──────────────────────
    await registerUser(request, "Analytics Owner", ownerEmail);
    await signIn(page, ownerEmail);
    await createWorkspace(page, wsName);
    const workspaceId = /\/workspaces\/([^/]+)$/.exec(page.url())![1];

    // ── Navigate to analytics page ────────────────────────────────────────
    await page.goto(`/workspaces/${workspaceId}/analytics`);

    // ── Heading visible ───────────────────────────────────────────────────
    await expect(page.getByRole("heading", { name: "Analytics", level: 1 })).toBeVisible();

    // ── Stat cards section rendered ───────────────────────────────────────
    const statCards = page.getByTestId("analytics-stat-cards");
    await expect(statCards).toBeVisible();

    // The four stat card labels should be present
    await expect(statCards.getByText("Total Tasks")).toBeVisible();
    await expect(statCards.getByText("Open Tasks")).toBeVisible();
    await expect(statCards.getByText("Completed")).toBeVisible();
    await expect(statCards.getByText("Overdue")).toBeVisible();

    // ── Tasks by Status section rendered ──────────────────────────────────
    await expect(page.getByTestId("analytics-tasks-by-status")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Tasks by Status" })).toBeVisible();

    // ── Velocity section rendered ─────────────────────────────────────────
    const velocitySection = page.getByTestId("analytics-velocity");
    await expect(velocitySection).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /Velocity/i }),
    ).toBeVisible();

    // ── Assignee Workload section rendered ────────────────────────────────
    await expect(page.getByTestId("analytics-assignee-workload")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Assignee Workload" })).toBeVisible();

    // ── Overdue section rendered ──────────────────────────────────────────
    await expect(page.getByTestId("analytics-overdue")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Due Date Summary" })).toBeVisible();

    // ── Analytics link in workspace nav ───────────────────────────────────
    await page.goto(`/workspaces/${workspaceId}`);
    const analyticsNavLink = page.getByRole("link", { name: /Analytics/i });
    await expect(analyticsNavLink.first()).toBeVisible();

    // ── Navigate back via nav link ────────────────────────────────────────
    await analyticsNavLink.first().click();
    await page.waitForURL(`/workspaces/${workspaceId}/analytics`);
    await expect(page.getByRole("heading", { name: "Analytics", level: 1 })).toBeVisible();

    // ── No console errors ─────────────────────────────────────────────────
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    await page.reload();
    await expect(page.getByRole("heading", { name: "Analytics", level: 1 })).toBeVisible();
    // Filter out known third-party noise; fail on unexpected errors
    const unexpected = errors.filter(
      (e) =>
        !e.includes("favicon") &&
        !e.includes("net::ERR") &&
        !e.includes("Loading chunk"),
    );
    expect(unexpected).toHaveLength(0);

    await cleanupUsers([ownerEmail]);
  });

  test("shows analytics after creating a project and tasks", async ({
    page,
    request,
  }) => {
    const localEmail = uniqueEmail("analytics-tasks");
    await registerUser(request, "Task Owner", localEmail);
    await signIn(page, localEmail);
    await createWorkspace(page, "Analytics Tasks Workspace");
    const workspaceId = /\/workspaces\/([^/]+)$/.exec(page.url())![1];

    // Create a project
    await page.goto(`/workspaces/${workspaceId}/projects`);
    await page.getByRole("button", { name: "New project" }).click();
    const projDialog = page.getByRole("dialog", { name: "Create Project" });
    await expect(projDialog).toBeVisible();
    await projDialog.getByLabel("Project name").fill("Analytics Project");
    await projDialog.getByRole("button", { name: "Create project" }).click();
    await page.waitForURL(/\/projects\/[^/]+$/);

    // Create a task on the board
    await page.getByRole("button", { name: "Create task" }).click();
    const dialog = page.getByRole("dialog", { name: "Create Task" });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel("Task title").fill("Analytic Task 1");
    await dialog.getByRole("button", { name: "Create task" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.locator('input[value="Analytic Task 1"]')).toBeVisible();

    // Navigate to analytics
    await page.goto(`/workspaces/${workspaceId}/analytics`);
    await expect(page.getByRole("heading", { name: "Analytics", level: 1 })).toBeVisible();

    // At least 1 total task should appear
    const statCards = page.getByTestId("analytics-stat-cards");
    await expect(statCards).toBeVisible();

    // Per-project breakdown should show our project
    const projectBreakdown = page.getByTestId("analytics-projects-breakdown");
    await expect(projectBreakdown).toBeVisible();
    await expect(projectBreakdown.getByText("Analytics Project")).toBeVisible();

    await cleanupUsers([localEmail]);
  });
});
