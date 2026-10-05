import { test, expect } from "@playwright/test";
import { cleanupUsers, createWorkspace, registerUser, signIn, uniqueEmail } from "./helpers";

test.setTimeout(180_000);

test.describe("Sprint Reports & Burndown Charts (Priority 6)", () => {
  let ownerEmail: string;
  const wsName = "E2E Burndown Workspace";
  const projectName = "E2E Burndown Project";

  test.beforeAll(async () => {
    ownerEmail = uniqueEmail("burndown-owner");
  });

  test.afterAll(async () => {
    await cleanupUsers([ownerEmail]);
  });

  test("creates sprint with dates, creates estimated tasks, logs work, moves to done, and verifies burndown chart and sprint report", async ({
    page,
    request,
  }) => {
    // 1. Register & sign in
    await registerUser(request, "Burndown Owner", ownerEmail);
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

    // 3. Create a Sprint with start and end dates in Project Settings
    await page.goto(`/workspaces/${workspaceId}/projects/${projectId}/settings`);
    await expect(page.getByRole("heading", { name: "Sprints", exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Add sprint" }).click();
    const sprintDialog = page.getByRole("dialog", { name: "Add Sprint" });
    await expect(sprintDialog).toBeVisible();

    const today = new Date();
    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 7);

    const pad = (n: number) => String(n).padStart(2, "0");
    const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
    const nextWeekStr = `${nextWeek.getFullYear()}-${pad(nextWeek.getMonth() + 1)}-${pad(nextWeek.getDate())}`;

    await sprintDialog.getByLabel("Sprint name").fill("Sprint 1");
    await sprintDialog.getByLabel("Sprint start date").fill(todayStr);
    await sprintDialog.getByLabel("Sprint end date").fill(nextWeekStr);
    await sprintDialog.getByLabel("Sprint goal").fill("Deliver Sprint Report & Burndown Chart");
    await sprintDialog.getByRole("button", { name: "Add sprint" }).click();
    await expect(sprintDialog).toBeHidden({ timeout: 15_000 });

    // 4. Return to board and create tasks with estimates
    await page.goto(`/workspaces/${workspaceId}/projects/${projectId}`);

    // Create Task 1: 1d (8h)
    await page.getByRole("button", { name: "Create task" }).click();
    const taskDialog1 = page.getByRole("dialog", { name: "Create Task" });
    await taskDialog1.getByLabel("Task title").fill("Design SVG Chart");
    await taskDialog1.getByLabel("Original estimate").fill("1d");
    await taskDialog1.getByRole("button", { name: "Create task" }).click();
    await expect(taskDialog1).toBeHidden();

    // Create Task 2: 4h
    await page.getByRole("button", { name: "Create task" }).click();
    const taskDialog2 = page.getByRole("dialog", { name: "Create Task" });
    await taskDialog2.getByLabel("Task title").fill("Build Report Modal");
    await taskDialog2.getByLabel("Original estimate").fill("4h");
    await taskDialog2.getByRole("button", { name: "Create task" }).click();
    await expect(taskDialog2).toBeHidden();

    // 5. Assign both tasks to Sprint 1
    const card1 = page.locator("li").filter({
      has: page.getByLabel("Title: Design SVG Chart").or(page.getByText("Design SVG Chart")),
    });
    await card1.getByRole("button", { name: "Open details" }).click();
    const drawer1 = page.getByRole("dialog");
    await expect(drawer1).toBeVisible();
    await drawer1.getByLabel("Sprint").selectOption({ label: "Sprint 1" });
    await drawer1.getByRole("button", { name: "Close" }).click();
    await expect(drawer1).toBeHidden();

    const card2 = page.locator("li").filter({
      has: page.getByLabel("Title: Build Report Modal").or(page.getByText("Build Report Modal")),
    });
    await card2.getByRole("button", { name: "Open details" }).click();
    const drawer2 = page.getByRole("dialog");
    await expect(drawer2).toBeVisible();
    await drawer2.getByLabel("Sprint").selectOption({ label: "Sprint 1" });
    await drawer2.getByRole("button", { name: "Close" }).click();
    await expect(drawer2).toBeHidden();

    // 6. Filter by Sprint 1 on board
    await page.getByRole("button", { name: /^Sprint 1/ }).click();

    // 7. Verify "Sprint Report" button is present and click it
    const sprintReportBtn = page.getByRole("button", { name: "Sprint Report" });
    await expect(sprintReportBtn).toBeVisible();
    await sprintReportBtn.click();

    // 8. Verify Sprint Report Modal
    const reportDialog = page.getByRole("dialog", { name: /Sprint Report: Sprint 1/ });
    await expect(reportDialog).toBeVisible();
    await expect(reportDialog.getByText("Goal: Deliver Sprint Report & Burndown Chart")).toBeVisible();

    // Check KPI cards
    await expect(reportDialog.getByText("Completion")).toBeVisible();
    await expect(reportDialog.getByText("Remaining", { exact: true })).toBeVisible();
    await expect(reportDialog.getByText("Logged Work")).toBeVisible();
    await expect(reportDialog.getByText("1d 4h", { exact: true })).toBeVisible(); // 12 hours remaining

    // Verify SVG Burndown chart exists
    const chartSvg = reportDialog.locator("svg");
    await expect(chartSvg.first()).toBeVisible();
    await expect(reportDialog.getByText("Actual Remaining", { exact: true })).toBeVisible();
    await expect(reportDialog.getByText("Ideal", { exact: true })).toBeVisible();

    // Verify Incomplete tab has both tasks
    await reportDialog.getByRole("button", { name: /Incomplete/ }).click();
    await expect(reportDialog.getByText("Design SVG Chart")).toBeVisible();
    await expect(reportDialog.getByText("Build Report Modal")).toBeVisible();

    // Close report modal
    await reportDialog.getByLabel("Close dialog").click();
    await expect(reportDialog).toBeHidden();

    // 9. Now complete Task 1 and log 4h of work on it
    await card1.getByRole("button", { name: "Open details" }).click();
    const drawerDetail = page.getByRole("dialog");
    await expect(drawerDetail).toBeVisible();

    // Log 4h work
    await drawerDetail.getByRole("button", { name: "Log work" }).click();
    const logModal = page.getByRole("dialog", { name: "Log Work" });
    await expect(logModal).toBeVisible();
    await logModal.getByLabel("Time spent").fill("4h");
    await logModal.getByRole("button", { name: "Log work" }).click();
    await expect(logModal).toBeHidden({ timeout: 15_000 });

    // Mark task Done
    await drawerDetail.getByLabel("Status").selectOption({ label: "Done" });
    await drawerDetail.getByRole("button", { name: "Close" }).click();
    await expect(drawerDetail).toBeHidden();

    // 10. Reopen Sprint Report and verify updated metrics
    await sprintReportBtn.click();
    await expect(reportDialog).toBeVisible();

    // Verify completion % updated (8h out of 12h = 67%)
    await expect(reportDialog.getByText("67%")).toBeVisible();
    const loggedCard = reportDialog.locator("div").filter({ hasText: /^Logged Work/ });
    await expect(loggedCard.getByText("4h")).toBeVisible(); // 4h logged
    const remainingCard = reportDialog.locator("div").filter({ hasText: /^Remaining/ });
    await expect(remainingCard.getByText("4h")).toBeVisible(); // 4h remaining

    // Verify Completed tab has Task 1
    await reportDialog.getByRole("button", { name: /Completed \(1\)/ }).click();
    await expect(reportDialog.getByText("Design SVG Chart")).toBeVisible();

    // Verify Incomplete tab has Task 2
    await reportDialog.getByRole("button", { name: /Incomplete \(1\)/ }).click();
    await expect(reportDialog.getByText("Build Report Modal")).toBeVisible();

    // Toggle metric to Issues
    await reportDialog.getByRole("button", { name: "📋 Issues" }).click();
    await expect(reportDialog.getByText("1 / 2 issues")).toBeVisible();
    await expect(reportDialog.getByText("1 issues", { exact: true })).toBeVisible(); // 1 issue remaining

    // Close modal
    await reportDialog.getByLabel("Close dialog").click();
    await expect(reportDialog).toBeHidden();
  });
});
