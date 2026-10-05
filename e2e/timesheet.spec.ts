import { test, expect } from "@playwright/test";
import { cleanupUsers, createWorkspace, registerUser, signIn, uniqueEmail } from "./helpers";

test.setTimeout(180_000);

test.describe("Timesheet & Worklog CSV Export (Priority 7)", () => {
  let ownerEmail: string;
  const wsName = "E2E Timesheet Workspace";
  const projectName = "E2E Timesheet Project";

  test.beforeAll(async () => {
    ownerEmail = uniqueEmail("timesheet-owner");
  });

  test.afterAll(async () => {
    await cleanupUsers([ownerEmail]);
  });

  test("logs work on tasks, views weekly timesheet matrix, checks audit log list, navigates weeks, and exports CSV", async ({
    page,
    request,
  }) => {
    // 1. Register & sign in
    await registerUser(request, "Timesheet Owner", ownerEmail);
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

    // 3. Create Task 1 with original estimate
    await page.goto(`/workspaces/${workspaceId}/projects/${projectId}`);
    await page.getByRole("button", { name: "Create task" }).click();
    const taskDialog1 = page.getByRole("dialog", { name: "Create Task" });
    await expect(taskDialog1).toBeVisible();
    await taskDialog1.getByLabel("Task title").fill("Backend Authentication API");
    await taskDialog1.getByLabel("Original estimate").fill("4h");
    await taskDialog1.getByRole("button", { name: "Create task" }).click();
    await expect(taskDialog1).toBeHidden();

    // 4. Create Task 2 with original estimate
    await page.getByRole("button", { name: "Create task" }).click();
    const taskDialog2 = page.getByRole("dialog", { name: "Create Task" });
    await expect(taskDialog2).toBeVisible();
    await taskDialog2.getByLabel("Task title").fill("Frontend Dashboard UI");
    await taskDialog2.getByLabel("Original estimate").fill("6h");
    await taskDialog2.getByRole("button", { name: "Create task" }).click();
    await expect(taskDialog2).toBeHidden();

    // 5. Open Task 1 and log 2 hours
    const card1 = page.locator("li").filter({
      has: page.getByLabel("Title: Backend Authentication API").or(page.getByText("Backend Authentication API")),
    });
    await expect(card1).toBeVisible();
    await card1.getByRole("button", { name: "Open details" }).click();
    const drawer1 = page.getByRole("dialog");
    await expect(drawer1).toBeVisible();

    await drawer1.getByRole("button", { name: "Log work" }).first().click();
    const logModal1 = page.getByRole("dialog", { name: "Log Work" });
    await expect(logModal1).toBeVisible();
    await logModal1.getByLabel("Time spent").fill("2h");
    await logModal1.getByLabel("Work description").fill("Implemented JWT session verification");
    await logModal1.getByRole("button", { name: "Log work" }).click();
    await expect(logModal1).toBeHidden();

    // Close drawer
    await page.getByLabel("Close modal").click();
    await expect(drawer1).toBeHidden();

    // 6. Open Task 2 and log 3 hours
    const card2 = page.locator("li").filter({
      has: page.getByLabel("Title: Frontend Dashboard UI").or(page.getByText("Frontend Dashboard UI")),
    });
    await expect(card2).toBeVisible();
    await card2.getByRole("button", { name: "Open details" }).click();
    const drawer2 = page.getByRole("dialog");
    await expect(drawer2).toBeVisible();

    await drawer2.getByRole("button", { name: "Log work" }).first().click();
    const logModal2 = page.getByRole("dialog", { name: "Log Work" });
    await expect(logModal2).toBeVisible();
    await logModal2.getByLabel("Time spent").fill("3h");
    await logModal2.getByLabel("Work description").fill("Created responsive SVG components");
    await logModal2.getByRole("button", { name: "Log work" }).click();
    await expect(logModal2).toBeHidden();

    await page.getByLabel("Close modal").click();
    await expect(drawer2).toBeHidden();

    // 7. Navigate to Timesheet page via sidebar or URL
    await page.goto(`/workspaces/${workspaceId}/timesheet`);

    // 8. Verify Header & KPI Stat Cards
    await expect(page.getByRole("heading", { name: "Timesheet & Worklogs" })).toBeVisible();

    const statCards = page.getByTestId("timesheet-stat-cards");
    await expect(statCards).toBeVisible();
    await expect(statCards).toContainText("5h"); // Total logged: 2h + 3h = 5h
    await expect(statCards).toContainText("1"); // 1 active contributor

    // 9. Verify Weekly Matrix View
    const matrixContainer = page.getByTestId("timesheet-matrix-container");
    await expect(matrixContainer).toBeVisible();
    await expect(matrixContainer).toContainText("Timesheet Owner");
    await expect(matrixContainer).toContainText("👥 Team Daily Sum");
    await expect(matrixContainer).toContainText("5h");

    // 10. Switch to Detailed Logs View
    await page.getByTestId("timesheet-toggle-list").click();
    const tableContainer = page.getByTestId("timesheet-table-container");
    await expect(tableContainer).toBeVisible();

    await expect(tableContainer).toContainText("Backend Authentication API");
    await expect(tableContainer).toContainText("Implemented JWT session verification");
    await expect(tableContainer).toContainText("2h");

    await expect(tableContainer).toContainText("Frontend Dashboard UI");
    await expect(tableContainer).toContainText("Created responsive SVG components");
    await expect(tableContainer).toContainText("3h");

    // 11. Switch back to Matrix View
    await page.getByTestId("timesheet-toggle-matrix").click();
    await expect(matrixContainer).toBeVisible();

    // 12. Test Date Navigation (Prev week -> 0m, This Week -> 5h)
    await page.getByTestId("timesheet-prev-week").click();
    await expect(statCards).toContainText("0m");

    await page.getByTestId("timesheet-this-week").click();
    await expect(statCards).toContainText("5h");

    // 13. Test CSV Export Endpoint
    const exportBtn = page.getByTestId("timesheet-export-csv");
    await expect(exportBtn).toBeVisible();
    const exportHref = await exportBtn.getAttribute("href");
    expect(exportHref).toBeTruthy();

    const csvResponse = await request.get(exportHref!);
    expect(csvResponse.status()).toBe(200);
    expect(csvResponse.headers()["content-type"]).toContain("text/csv");

    const csvText = await csvResponse.text();
    // Verify UTF-8 BOM
    expect(csvText.charCodeAt(0)).toBe(0xfeff);
    // Verify Header columns
    expect(csvText).toContain(
      "Date,Member Name,Member Email,Project,Task ID,Task Title,Time Spent (Minutes),Time Spent (Hours),Time Spent (Formatted),Description,Logged At",
    );
    // Verify task records in CSV
    expect(csvText).toContain("Backend Authentication API");
    expect(csvText).toContain("120,2.00,2h");
    expect(csvText).toContain("Implemented JWT session verification");

    expect(csvText).toContain("Frontend Dashboard UI");
    expect(csvText).toContain("180,3.00,3h");
    expect(csvText).toContain("Created responsive SVG components");
  });
});
