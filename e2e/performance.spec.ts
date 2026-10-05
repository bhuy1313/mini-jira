/**
 * Performance E2E Tests — Mini Jira
 *
 * Mục tiêu: đo thời gian thực (wall-clock) của từng thao tác người dùng và
 * kiểm tra nó không vượt ngưỡng đã định. Test này sẽ FAIL nếu app thật sự chậm.
 *
 * Ngưỡng giới hạn (Budgets):
 *   - Optimistic UI (ví dụ: task xuất hiện ngay sau Submit):       < 500ms
 *   - Server Action round-trip + UI update hoàn tất:               < 3000ms
 *   - Navigation (chuyển trang trong cùng workspace):              < 2500ms
 *   - Multi-machine realtime sync (tab 2 nhận thay đổi từ tab 1): < 4000ms
 *   - Initial page load (lần đầu mở board):                       < 5000ms
 *
 * Tất cả timeout đo lường đều dùng Date.now() — không dùng waitForTimeout()
 * vì waitForTimeout() chỉ chờ chứ không đo.
 */

import { test as base, expect, type BrowserContext, type Page } from "@playwright/test";

import { cleanupUsers, createWorkspace, registerUser, signIn, uniqueEmail } from "./helpers";

let authStorageState: Awaited<ReturnType<BrowserContext["storageState"]>> = {
  cookies: [],
  origins: [],
};

const test = base.extend({
  context: async ({ browser }, runFixtureCallback) => {
    const context = await browser.newContext({ storageState: authStorageState });
    await runFixtureCallback(context);
    await context.close();
  },
  page: async ({ context }, runFixtureCallback) => {
    const page = await context.newPage();
    await runFixtureCallback(page);
    await page.close();
  },
});

// Tổng thời gian cho toàn bộ file này
test.setTimeout(300_000);

// ─── Ngưỡng hiệu năng (ms) ────────────────────────────────────────────────────
const BUDGET = {
  /** UI phản hồi ngay (Optimistic): task xuất hiện sau khi submit dialog */
  OPTIMISTIC_UI_MS: 500,
  /** Server Action hoàn tất + UI update (task thật sự lưu xong và hiển thị) */
  SERVER_ACTION_MS: 3_000,
  /** Chuyển tab/trang trong workspace (Members → Board → Settings) */
  NAVIGATION_MS: 2_500,
  /** Mở bảng kanban lần đầu (bao gồm render đầy đủ danh sách task) */
  INITIAL_LOAD_MS: 5_000,
  /** Multi-machine sync: tab 2 thấy thay đổi từ tab 1 sau polling interval */
  REALTIME_SYNC_MS: 4_000,
  /** Kéo-thả task sang cột khác: giao diện tab hiện tại phản hồi ngay */
  DRAG_OPTIMISTIC_MS: 500,
} as const;

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function openBoard(page: Page, workspaceId: string, projectId: string): Promise<void> {
  await page.goto(`/workspaces/${workspaceId}/projects/${projectId}`);
  await page.waitForURL(/\/projects\/[^/]+$/);
}

async function createProject(page: Page, name: string): Promise<string> {
  await page.getByRole("button", { name: "New project" }).click();
  const dialog = page.getByRole("dialog", { name: "Create Project" });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Project name").fill(name);
  await dialog.getByRole("button", { name: "Create project" }).click();
  await page.waitForURL(/\/projects\/[^/]+$/);
  return /\/projects\/([^/]+)$/.exec(page.url())![1];
}

/** Locator cột Kanban theo label */
function column(page: Page, label: string) {
  return page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: new RegExp("^" + label) }) });
}

/** Locator thẻ task theo title input */
function taskCard(page: Page, title: string) {
  return page.locator("li").filter({ has: page.getByLabel(`Title: ${title}`) });
}

async function waitForPersistedTask(page: Page, title: string): Promise<void> {
  await expect(taskCard(page, title)).toHaveAttribute("data-task-id", /^(?!temp-).+$/, {
    timeout: BUDGET.SERVER_ACTION_MS,
  });
}

/** Locator task text (cho trường hợp không phải input) */
function taskText(page: Page, label: string, title: string) {
  return column(page, label)
    .getByText(title, { exact: true })
    .or(column(page, label).getByLabel(`Title: ${title}`));
}

/** Đo thời gian thực thi một async action. Trả về ms. */
async function measure(fn: () => Promise<void>): Promise<number> {
  const start = Date.now();
  await fn();
  return Date.now() - start;
}

// ─── Setup dữ liệu dùng chung toàn file ─────────────────────────────────────

let ownerEmail: string;
let workspaceId: string;
let projectId: string;

test.beforeAll(async ({ request, browser }) => {
  ownerEmail = uniqueEmail("perf");
  await registerUser(request, "Perf Owner", ownerEmail);

  // Sign in để tạo workspace & project dùng chung
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await signIn(page, ownerEmail);
  await createWorkspace(page, "Perf Workspace");
  workspaceId = /\/workspaces\/([^/]+)$/.exec(page.url())![1];

  await page.goto(`/workspaces/${workspaceId}/projects`);
  await page.waitForURL(/\/projects$/);
  projectId = await createProject(page, "Perf Project");
  authStorageState = await ctx.storageState();

  await ctx.close();
});

test.afterAll(async () => {
  await cleanupUsers([ownerEmail]);
});

// ─── Test Suite 1: Tải trang ─────────────────────────────────────────────────

test.describe("PERF-01: Page Load", () => {
  test("board initial load phải dưới 5000ms", async ({ page }) => {
    const ms = await measure(async () => {
      await page.goto(`/workspaces/${workspaceId}/projects/${projectId}`);
      // Chờ đến khi board thật sự render xong (cột To Do xuất hiện)
      await expect(
        page.locator("section").filter({ has: page.getByRole("heading", { name: /^To Do/ }) }),
      ).toBeVisible();
    });

    console.log(`[PERF-01] Board initial load: ${ms}ms (budget: ${BUDGET.INITIAL_LOAD_MS}ms)`);
    expect(ms, `Board load quá chậm: ${ms}ms > ${BUDGET.INITIAL_LOAD_MS}ms`).toBeLessThan(
      BUDGET.INITIAL_LOAD_MS,
    );
  });
});

// ─── Test Suite 2: Tạo Task ──────────────────────────────────────────────────

test.describe("PERF-02: Create Task", () => {
  test("tạo task: UI phản hồi tức thì (optimistic) < 500ms", async ({ page }) => {
    await openBoard(page, workspaceId, projectId);
    await expect(
      page.locator("section").filter({ has: page.getByRole("heading", { name: /^To Do/ }) }),
    ).toBeVisible();

    const title = `Perf-Task-Optimistic-${Date.now()}`;

    await page.getByRole("button", { name: "Create task" }).click();
    const dialog = page.getByRole("dialog", { name: "Create Task" });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel("Task title").fill(title);

    // Đo từ lúc bấm Submit đến khi dialog đóng (phần Optimistic)
    const optimisticMs = await measure(async () => {
      await dialog.getByRole("button", { name: "Create task" }).click();
      await expect(dialog).toBeHidden();
    });

    console.log(`[PERF-02] Create task dialog dismiss: ${optimisticMs}ms (budget: ${BUDGET.OPTIMISTIC_UI_MS}ms)`);
    expect(
      optimisticMs,
      `Dialog đóng quá chậm: ${optimisticMs}ms > ${BUDGET.OPTIMISTIC_UI_MS}ms`,
    ).toBeLessThan(BUDGET.OPTIMISTIC_UI_MS);

    // Đo thời gian task xuất hiện thật sự trong cột
    const serverMs = await measure(async () => {
      await waitForPersistedTask(page, title);
    });

    console.log(`[PERF-02] Task xuất hiện trên board: ${serverMs}ms (budget: ${BUDGET.SERVER_ACTION_MS}ms)`);
    expect(
      serverMs,
      `Task xuất hiện quá chậm: ${serverMs}ms > ${BUDGET.SERVER_ACTION_MS}ms`,
    ).toBeLessThan(BUDGET.SERVER_ACTION_MS);
  });
});

// ─── Test Suite 3: Chuyển Status (Dropdown) ──────────────────────────────────

test.describe("PERF-03: Move Task via Dropdown", () => {
  test("đổi status dropdown: UI chuyển cột ngay < 500ms, server confirm < 3000ms", async ({
    page,
  }) => {
    await openBoard(page, workspaceId, projectId);

    // Chuẩn bị: tạo 1 task mới
    const title = `Perf-Dropdown-${Date.now()}`;
    await page.getByRole("button", { name: "Create task" }).click();
    const dialog = page.getByRole("dialog", { name: "Create Task" });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel("Task title").fill(title);
    await dialog.getByRole("button", { name: "Create task" }).click();
    await expect(dialog).toBeHidden();
    await expect(taskText(page, "To Do", title)).toBeVisible({ timeout: 8_000 });
    await waitForPersistedTask(page, title);

    // Đo thời gian từ lúc chọn dropdown đến khi task xuất hiện ở cột mới
    const moveMs = await measure(async () => {
      await taskCard(page, title).getByLabel(`Move ${title}`).selectOption({ label: "In Progress" });
      // Task phải xuất hiện ở In Progress
      await expect(taskText(page, "In Progress", title)).toBeVisible({ timeout: BUDGET.SERVER_ACTION_MS });
    });

    console.log(`[PERF-03] Move via dropdown (To Do → In Progress): ${moveMs}ms (budget: ${BUDGET.SERVER_ACTION_MS}ms)`);
    expect(
      moveMs,
      `Move dropdown quá chậm: ${moveMs}ms > ${BUDGET.SERVER_ACTION_MS}ms`,
    ).toBeLessThan(BUDGET.SERVER_ACTION_MS);

    // Đảm bảo task KHÔNG còn ở cột cũ
    await expect(taskText(page, "To Do", title)).not.toBeVisible({ timeout: 1_000 });
  });
});

// ─── Test Suite 4: Chỉnh sửa Title Task ─────────────────────────────────────

test.describe("PERF-04: Edit Task Title (inline)", () => {
  test("sửa title inline: server xác nhận hoàn tất < 3000ms", async ({ page }) => {
    await openBoard(page, workspaceId, projectId);

    const title = `Perf-Edit-${Date.now()}`;
    const newTitle = `${title}-EDITED`;

    // Tạo task
    await page.getByRole("button", { name: "Create task" }).click();
    const dialog = page.getByRole("dialog", { name: "Create Task" });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel("Task title").fill(title);
    await dialog.getByRole("button", { name: "Create task" }).click();
    await expect(dialog).toBeHidden();
    await expect(taskText(page, "To Do", title)).toBeVisible({ timeout: 8_000 });
    await waitForPersistedTask(page, title);

    // Đo thời gian sửa title
    const editMs = await measure(async () => {
      const input = taskCard(page, title).getByLabel(`Title: ${title}`);
      await input.click({ clickCount: 3 });
      await input.fill(newTitle);
      await input.press("Enter");
      await expect(taskCard(page, newTitle).getByLabel(`Title: ${newTitle}`)).toHaveValue(newTitle, {
        timeout: BUDGET.SERVER_ACTION_MS,
      });
    });

    console.log(`[PERF-04] Edit title: ${editMs}ms (budget: ${BUDGET.SERVER_ACTION_MS}ms)`);
    expect(
      editMs,
      `Edit title quá chậm: ${editMs}ms > ${BUDGET.SERVER_ACTION_MS}ms`,
    ).toBeLessThan(BUDGET.SERVER_ACTION_MS);
  });
});

// ─── Test Suite 5: Navigation giữa các trang ─────────────────────────────────

test.describe("PERF-05: In-App Navigation", () => {
  test("chuyển Board → Members → Settings → Projects → Board: mỗi bước < 2500ms", async ({ page }) => {
    await openBoard(page, workspaceId, projectId);
    await expect(
      page.locator("section").filter({ has: page.getByRole("heading", { name: /^To Do/ }) }),
    ).toBeVisible();

    // Board → Members
    const toMembersMs = await measure(async () => {
      await page.getByRole("link", { name: "Members", exact: true }).click();
      await expect(page.getByRole("heading", { name: "Members" })).toBeVisible();
    });
    console.log(`[PERF-05] Nav Board → Members: ${toMembersMs}ms (budget: ${BUDGET.NAVIGATION_MS}ms)`);
    expect(toMembersMs, `Nav → Members quá chậm: ${toMembersMs}ms`).toBeLessThan(BUDGET.NAVIGATION_MS);

    // Members → Settings
    const toSettingsMs = await measure(async () => {
      await page.getByRole("link", { name: "Settings", exact: true }).click();
      await expect(page.getByRole("heading", { name: "Workspace Settings" })).toBeVisible();
    });
    console.log(`[PERF-05] Nav Members → Settings: ${toSettingsMs}ms (budget: ${BUDGET.NAVIGATION_MS}ms)`);
    expect(toSettingsMs, `Nav → Settings quá chậm: ${toSettingsMs}ms`).toBeLessThan(BUDGET.NAVIGATION_MS);

    // Settings → Projects → Board
    const toProjectsMs = await measure(async () => {
      await page.getByRole("link", { name: "Projects", exact: true }).click();
      await expect(page.getByRole("heading", { name: "Projects", exact: true })).toBeVisible();
    });
    console.log(`[PERF-05] Nav Settings → Projects: ${toProjectsMs}ms (budget: ${BUDGET.NAVIGATION_MS}ms)`);
    expect(toProjectsMs, `Nav → Projects quá chậm: ${toProjectsMs}ms`).toBeLessThan(BUDGET.NAVIGATION_MS);

    const toBoardMs = await measure(async () => {
      await page.getByRole("link", { name: "Open project Perf Project" }).click();
      await expect(
        page.locator("section").filter({ has: page.getByRole("heading", { name: /^To Do/ }) }),
      ).toBeVisible();
    });
    console.log(`[PERF-05] Nav Projects → Board: ${toBoardMs}ms (budget: ${BUDGET.NAVIGATION_MS}ms)`);
    expect(toBoardMs, `Nav Projects → Board quá chậm: ${toBoardMs}ms`).toBeLessThan(BUDGET.NAVIGATION_MS);
  });
});

// ─── Test Suite 6: Realtime Multi-Tab Sync ───────────────────────────────────

test.describe("PERF-06: Multi-Tab Realtime Sync", () => {
  test("tab 2 nhận thay đổi từ tab 1 trong < 4000ms", async ({ browser }) => {
    // Mở 2 context độc lập (giống 2 máy)
    const ctx1: BrowserContext = await browser.newContext({ storageState: authStorageState });
    const ctx2: BrowserContext = await browser.newContext({ storageState: authStorageState });
    const tab1 = await ctx1.newPage();
    const tab2 = await ctx2.newPage();

    try {
      await openBoard(tab1, workspaceId, projectId);
      await openBoard(tab2, workspaceId, projectId);

      // Đảm bảo cả 2 tab đã render board xong
      await expect(
        tab1.locator("section").filter({ has: tab1.getByRole("heading", { name: /^To Do/ }) }),
      ).toBeVisible({ timeout: 8_000 });
      await expect(
        tab2.locator("section").filter({ has: tab2.getByRole("heading", { name: /^To Do/ }) }),
      ).toBeVisible({ timeout: 8_000 });

      const title = `Perf-Sync-${Date.now()}`;
      await tab2.evaluate(() => sessionStorage.removeItem("mini-jira:last-board-event"));

      // Tab 1 tạo task, đo thời gian tab 2 thấy task đó
      // Tạo task ở tab 1 (không tính vào thời gian đo)
      await tab1.getByRole("button", { name: "Create task" }).click();
      const dialog = tab1.getByRole("dialog", { name: "Create Task" });
      await expect(dialog).toBeVisible();
      await dialog.getByLabel("Task title").fill(title);
      await dialog.getByRole("button", { name: "Create task" }).click();
      await expect(dialog).toBeHidden();

      // Bắt đầu đo từ khi tab 1 xác nhận task đã lưu (dialog đóng)
      await waitForPersistedTask(tab1, title);
      const syncMs = await measure(async () => {
        await expect(
          tab2
            .locator("section")
            .filter({ has: tab2.getByRole("heading", { name: /^To Do/ }) })
            .getByText(title, { exact: true })
            .or(
              tab2
                .locator("section")
                .filter({ has: tab2.getByRole("heading", { name: /^To Do/ }) })
                .locator(`input[value="${title}"]`),
            ),
        ).toBeVisible({ timeout: BUDGET.REALTIME_SYNC_MS });
      });
      const boardEvent = await tab2.evaluate(() =>
        sessionStorage.getItem("mini-jira:last-board-event"),
      );

      console.log(`[PERF-06] Multi-tab sync: ${syncMs}ms (budget: ${BUDGET.REALTIME_SYNC_MS}ms)`);
      console.log(`[PERF-06] Tab 2 update source: ${boardEvent ? "board event" : "polling/other"}`);
      expect(
        syncMs,
        `Multi-tab sync quá chậm: ${syncMs}ms > ${BUDGET.REALTIME_SYNC_MS}ms`,
      ).toBeLessThan(BUDGET.REALTIME_SYNC_MS);
    } finally {
      await ctx1.close();
      await ctx2.close();
    }
  });

  test("tab 2 nhận thay đổi status (move task) từ tab 1 trong < 4000ms", async ({ browser }) => {
    const ctx1: BrowserContext = await browser.newContext({ storageState: authStorageState });
    const ctx2: BrowserContext = await browser.newContext({ storageState: authStorageState });
    const tab1 = await ctx1.newPage();
    const tab2 = await ctx2.newPage();

    try {
      await openBoard(tab1, workspaceId, projectId);

      // Tạo task ở tab 1 trước
      const title = `Perf-SyncMove-${Date.now()}`;
      await tab1.getByRole("button", { name: "Create task" }).click();
      const dialog = tab1.getByRole("dialog", { name: "Create Task" });
      await expect(dialog).toBeVisible();
      await dialog.getByLabel("Task title").fill(title);
      await dialog.getByRole("button", { name: "Create task" }).click();
      await expect(dialog).toBeHidden();
      await waitForPersistedTask(tab1, title);
      await expect(
        tab1.locator("section")
          .filter({ has: tab1.getByRole("heading", { name: /^To Do/ }) })
          .getByText(title, { exact: true })
          .or(
            tab1.locator("section")
              .filter({ has: tab1.getByRole("heading", { name: /^To Do/ }) })
              .locator(`input[value="${title}"]`),
          ),
      ).toBeVisible({ timeout: 8_000 });

      // Mở tab 2 và chờ board render
      await openBoard(tab2, workspaceId, projectId);
      await expect(
        tab2.locator("section")
          .filter({ has: tab2.getByRole("heading", { name: /^To Do/ }) })
          .getByText(title, { exact: true })
          .or(
            tab2.locator("section")
              .filter({ has: tab2.getByRole("heading", { name: /^To Do/ }) })
              .locator(`input[value="${title}"]`),
          ),
      ).toBeVisible({ timeout: 8_000 });
      await tab2.evaluate(() => sessionStorage.removeItem("mini-jira:last-board-event"));

      // Tab 1 chuyển task sang In Progress
      await taskCard(tab1, title).getByLabel(`Move ${title}`).selectOption({ label: "In Progress" });
      await expect(
        tab1.locator("section")
          .filter({ has: tab1.getByRole("heading", { name: /^In Progress/ }) })
          .getByText(title, { exact: true })
          .or(
            tab1.locator("section")
              .filter({ has: tab1.getByRole("heading", { name: /^In Progress/ }) })
              .locator(`input[value="${title}"]`),
          ),
      ).toBeVisible({ timeout: 5_000 });

      // Đo thời gian tab 2 nhận được thay đổi status
      const syncMs = await measure(async () => {
        await expect(
          tab2.locator("section")
            .filter({ has: tab2.getByRole("heading", { name: /^In Progress/ }) })
            .getByText(title, { exact: true })
            .or(
              tab2.locator("section")
                .filter({ has: tab2.getByRole("heading", { name: /^In Progress/ }) })
                .locator(`input[value="${title}"]`),
            ),
        ).toBeVisible({ timeout: BUDGET.REALTIME_SYNC_MS });
      });
      const boardEvent = await tab2.evaluate(() =>
        sessionStorage.getItem("mini-jira:last-board-event"),
      );

      console.log(`[PERF-06] Multi-tab sync (status move): ${syncMs}ms (budget: ${BUDGET.REALTIME_SYNC_MS}ms)`);
      console.log(`[PERF-06] Status update source: ${boardEvent ? "board event" : "polling/other"}`);
      expect(
        syncMs,
        `Multi-tab status sync quá chậm: ${syncMs}ms > ${BUDGET.REALTIME_SYNC_MS}ms`,
      ).toBeLessThan(BUDGET.REALTIME_SYNC_MS);
    } finally {
      await ctx1.close();
      await ctx2.close();
    }
  });
});

// ─── Test Suite 7: Xóa Task ──────────────────────────────────────────────────

test.describe("PERF-07: Delete Task", () => {
  test("xóa task: biến mất khỏi board < 3000ms", async ({ page }) => {
    await openBoard(page, workspaceId, projectId);

    const title = `Perf-Delete-${Date.now()}`;
    await page.getByRole("button", { name: "Create task" }).click();
    const dialog = page.getByRole("dialog", { name: "Create Task" });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel("Task title").fill(title);
    await dialog.getByRole("button", { name: "Create task" }).click();
    await expect(dialog).toBeHidden();
    await expect(taskText(page, "To Do", title)).toBeVisible({ timeout: 8_000 });
    await waitForPersistedTask(page, title);

    // Mở detail dialog và xóa
    const deleteMs = await measure(async () => {
      page.once("dialog", async (nativeDialog) => {
        await nativeDialog.accept();
      });
      await taskCard(page, title)
        .getByRole("button", { name: "Delete task" })
        .click({ timeout: 1_000 });
      // Task phải biến mất
      await expect(taskText(page, "To Do", title)).not.toBeVisible({
        timeout: BUDGET.SERVER_ACTION_MS,
      });
    });

    console.log(`[PERF-07] Delete task: ${deleteMs}ms (budget: ${BUDGET.SERVER_ACTION_MS}ms)`);
    expect(
      deleteMs,
      `Delete task quá chậm: ${deleteMs}ms > ${BUDGET.SERVER_ACTION_MS}ms`,
    ).toBeLessThan(BUDGET.SERVER_ACTION_MS);
  });
});
