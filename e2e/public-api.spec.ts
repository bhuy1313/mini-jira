import { test, expect } from "@playwright/test";
import { cleanupUsers, createWorkspace, registerUser, signIn, uniqueEmail } from "./helpers";

test.setTimeout(180_000);

test.describe("Public REST API & API Key Authentication (Milestone 20)", () => {
  let ownerEmail: string;
  const wsName = "E2E REST API Workspace";
  const projectName = "E2E REST Project";

  test.beforeAll(async () => {
    ownerEmail = uniqueEmail("api-owner");
  });

  test.afterAll(async () => {
    await cleanupUsers([ownerEmail]);
  });

  test("generates API key in workspace settings and tests public REST endpoints via HTTP request", async ({
    page,
    request,
  }) => {
    // 1. Register and sign in as Owner
    await registerUser(request, "API Owner", ownerEmail);
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

    // 3. Go to Workspace Settings -> Public API Keys Panel
    await page.goto(`/workspaces/${workspaceId}/settings`);
    await expect(page.getByRole("heading", { name: "Public API Keys" })).toBeVisible();

    // 4. Click Create API Key
    await page.getByRole("button", { name: "Create API Key" }).click();
    const apiKeyDialog = page.getByRole("dialog", { name: "Create API Key" });
    await expect(apiKeyDialog).toBeVisible();
    await apiKeyDialog.getByLabel("Key Name").fill("Playwright E2E Key");
    await apiKeyDialog.getByRole("button", { name: "Generate Key" }).click();
    await expect(apiKeyDialog).toBeHidden();

    // 5. Modal appears with the secret key
    await expect(page.getByRole("heading", { name: "API Key Generated" })).toBeVisible();
    const secretKeyInput = page.getByLabel("Generated Secret Key");
    await expect(secretKeyInput).toBeVisible();
    const secretKey = await secretKeyInput.inputValue();

    expect(secretKey).toBeTruthy();
    expect(secretKey.startsWith("mj_live_")).toBe(true);

    // Close modal
    await page.getByRole("button", { name: "I have copied the key" }).click();
    await expect(page.getByRole("heading", { name: "API Key Generated" })).not.toBeVisible();

    // Verify key in table
    await expect(page.getByText("Playwright E2E Key")).toBeVisible();
    await expect(page.getByText("mj_live_...")).toBeVisible();

    // 6. Test Public REST API via HTTP Requests

    // (a) GET /api/v1/workspaces using Authorization header
    const wsRes = await request.get("/api/v1/workspaces", {
      headers: {
        Authorization: `Bearer ${secretKey}`,
      },
    });
    expect(wsRes.ok()).toBe(true);
    const wsJson = await wsRes.json();
    expect(wsJson.success).toBe(true);
    expect(wsJson.data.id).toBe(workspaceId);
    expect(wsJson.data.name).toBe(wsName);

    // (b) GET /api/v1/workspaces/[workspaceId]/projects using x-api-key header
    const projRes = await request.get(`/api/v1/workspaces/${workspaceId}/projects`, {
      headers: {
        "x-api-key": secretKey,
      },
    });
    expect(projRes.ok()).toBe(true);
    const projJson = await projRes.json();
    expect(projJson.success).toBe(true);
    expect(Array.isArray(projJson.data)).toBe(true);
    expect(projJson.data.some((p: { id: string }) => p.id === projectId)).toBe(true);

    // (c) POST /api/v1/workspaces/[workspaceId]/projects/[projectId]/tasks to create a task
    const createTaskRes = await request.post(
      `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks`,
      {
        headers: {
          Authorization: `Bearer ${secretKey}`,
          "Content-Type": "application/json",
        },
        data: {
          title: "Created from REST API",
          description: "Integration test description",
          priority: "High",
        },
      },
    );
    expect(createTaskRes.status()).toBe(201);
    const createTaskJson = await createTaskRes.json();
    expect(createTaskJson.success).toBe(true);
    const taskId = createTaskJson.data.id;
    expect(taskId).toBeTruthy();
    expect(createTaskJson.data.title).toBe("Created from REST API");
    expect(createTaskJson.data.priority).toBe("High");

    // (d) GET /api/v1/workspaces/[workspaceId]/projects/[projectId]/tasks with search & filter
    const listTasksRes = await request.get(
      `/api/v1/workspaces/${workspaceId}/projects/${projectId}/tasks?q=REST`,
      {
        headers: {
          Authorization: `Bearer ${secretKey}`,
        },
      },
    );
    expect(listTasksRes.ok()).toBe(true);
    const listTasksJson = await listTasksRes.json();
    expect(listTasksJson.success).toBe(true);
    expect(listTasksJson.data.some((t: { id: string }) => t.id === taskId)).toBe(true);

    // (e) GET /api/v1/workspaces/[workspaceId]/tasks/[taskId]
    const getTaskRes = await request.get(`/api/v1/workspaces/${workspaceId}/tasks/${taskId}`, {
      headers: {
        Authorization: `Bearer ${secretKey}`,
      },
    });
    expect(getTaskRes.ok()).toBe(true);
    const getTaskJson = await getTaskRes.json();
    expect(getTaskJson.success).toBe(true);
    expect(getTaskJson.data.id).toBe(taskId);
    expect(getTaskJson.data.title).toBe("Created from REST API");
    expect(getTaskJson.data.status).toBeDefined();

    // (f) PATCH /api/v1/workspaces/[workspaceId]/tasks/[taskId]
    const patchTaskRes = await request.patch(`/api/v1/workspaces/${workspaceId}/tasks/${taskId}`, {
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json",
      },
      data: {
        title: "Updated from REST API",
        priority: "Urgent",
      },
    });
    expect(patchTaskRes.ok()).toBe(true);
    const patchTaskJson = await patchTaskRes.json();
    expect(patchTaskJson.success).toBe(true);
    expect(patchTaskJson.data.title).toBe("Updated from REST API");
    expect(patchTaskJson.data.priority).toBe("Urgent");

    // (g) DELETE /api/v1/workspaces/[workspaceId]/tasks/[taskId]
    const deleteTaskRes = await request.delete(`/api/v1/workspaces/${workspaceId}/tasks/${taskId}`, {
      headers: {
        Authorization: `Bearer ${secretKey}`,
      },
    });
    expect(deleteTaskRes.ok()).toBe(true);
    const deleteTaskJson = await deleteTaskRes.json();
    expect(deleteTaskJson.success).toBe(true);

    // Verify task is deleted (404)
    const getDeletedTaskRes = await request.get(
      `/api/v1/workspaces/${workspaceId}/tasks/${taskId}`,
      {
        headers: {
          Authorization: `Bearer ${secretKey}`,
        },
      },
    );
    expect(getDeletedTaskRes.status()).toBe(404);

    // (h) Send request with invalid API key -> 401 Unauthorized
    const invalidAuthRes = await request.get("/api/v1/workspaces", {
      headers: {
        Authorization: "Bearer mj_live_invalid_key_99999999",
      },
    });
    expect(invalidAuthRes.status()).toBe(401);
    const invalidJson = await invalidAuthRes.json();
    expect(invalidJson.success).toBe(false);
    expect(invalidJson.error.code).toBe("UNAUTHORIZED");
  });
});
