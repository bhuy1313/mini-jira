# 🗺️ Mini Jira — Master Roadmap & Handoff Guide

> **Single Source of Truth:** This document consolidates all historical milestones (MVP Mốc 0–8, Post-MVP Mốc 9–22, and Advanced UI Mốc 23) into one unified guide for developers and autonomous coding agents.

---

## 📌 1. Executive Summary & Current Health

- **Framework & Core:** [Next.js 16 (App Router)](https://nextjs.org/) + React 19 + TypeScript (Strict mode)
- **Database & ORM:** PostgreSQL + [Prisma ORM 7](https://www.prisma.io/) (with `@prisma/adapter-pg`) / SQLite compatible
- **Authentication & Security:** [Better Auth](https://better-auth.com/) (Email & Password, Session Cookies, Rate Limiting, Trusted Origins)
- **Styling & Theming:** Tailwind CSS v4 + Dynamic Theme Provider (`Light`, `Dark`, `System`)
- **Real-Time Sync:** Server-Sent Events (SSE) `/api/live/stream` with in-process hub & event history replay
- **Current Quality Status:**
  - ✅ **Vitest Unit & Integration:** **437 / 437 tests PASSED** (34 test files).
  - ✅ **Playwright E2E:** 30+ automated user journey suites cover all core, edge-case, and UI interactions (Comments optimistic deletion, task creation, custom fields, label manager, outbound webhooks, sub-tasks hierarchy, time tracking worklogs, burndown sprint reports, and timesheet CSV exports verified).
  - ✅ **TypeScript Typecheck:** `npx tsc --noEmit` passes cleanly with **0 errors**.
  - ⚠️ **ESLint:** `npx eslint .` reports **9 errors / 13 warnings — all pre-existing** (`react-hooks/set-state-in-effect` on optimistic-state sync effects in `comment-list.tsx`, `task-detail-modal.tsx`, `attachment-list.tsx`, `create-task-modal.tsx`). Nothing from the Timesheet, Burndown, or Time Tracking work added new lint findings.

---

## 🏗️ 2. Architectural Conventions & Core Principles

### 2.1 Vertical Slice Feature Architecture
Code is strictly organized by domain under `src/features/<feature>/`:
```
src/features/<domain>/
├── actions.ts                  # Server Actions ("use server") for mutations
├── <domain>-service.ts         # Pure business logic & RBAC validation
├── prisma-<domain>-repository.ts # Database access queries via Prisma
├── components/                 # Client & Server UI components
└── __tests__/                  # Unit & integration test suites
```

### 2.2 Server-Enforced RBAC (Actor Pattern)
- Every server action and query enforces workspace & project permissions using `requireActor(workspaceId)` or `requireProjectActor(workspaceId, projectId)`.
- UI buttons dynamically adapt to user roles (`Owner`, `Admin`, `Member`), but server verification is authoritative (zero trust on client inputs).

### 2.3 Fractional Decimal Positioning ($O(1)$ Reordering)
- Kanban tasks, statuses, sprints, and custom fields use high-precision PostgreSQL `Decimal` positions (`position.ts`).
- Moving items inserts mathematically between adjacent positions ($O(1)$ query) without requiring table locks or batch re-indexing.

### 2.4 Modal & Slide-Over Drawer Standard
- **Central Modals:** `src/components/ui/modal.tsx` — accessible `role="dialog"`, `aria-modal="true"`, <kbd>Esc</kbd> key support, backdrop click dismiss, auto-focus first input.
- **Slide-over Drawers:** `src/components/ui/drawer.tsx` — slide from right for task details, preserving Kanban board context.
- **Optimistic State Updates:** Interactive components (`CommentList`, `TaskLabelPicker`, `TaskCustomFieldInput`) update local UI state immediately, then invoke server actions and `router.refresh()`.

---

## 📊 3. Master Milestones Progression (Mốc 0 ➔ Mốc 23)

### 🔹 Phase 1: MVP Foundation (Mốc 0 – 8)

- **Mốc 0 — Foundation & Quality:** Better Auth integration, password policy (8–128 chars, uppercase, lowercase, numbers), `/auth` unified page, test runner setup.
- **Mốc 1 — Data Model & RBAC Core:** Prisma schema (`Workspace`, `WorkspaceMember`, `Project`, `Task`, `Comment`, `Activity`), TypeScript permission matrix.
- **Mốc 2 — Workspace & Member Management:** Workspace switcher, Owner hard-delete with cascade, Member invitation by email, role changing, member removal matrix.
- **Mốc 3 — Project Lifecycle:** Active projects list, soft archive (`archivedAt`), restore, Owner-only permanent delete.
- **Mốc 4 — Task Foundation & Kanban:** Decimal positioning, 3-column Kanban (To Do, In Progress, Done), creator/assignee edit policies, move & assignment controls.
- **Mốc 5 — Comments & Immutable Activity:** Author-only comment editing, Owner/Admin comment moderation, automatic transaction activity logging for task events.
- **Mốc 6 — Search, Filters & URL State:** Substring title search, status/priority/assignee filters, URL query sync (`?q=`, `?status=`, `?priority=`, `?assignee=`).
- **Mốc 7 — Release Readiness & Seeding:** Demo seed script (`npm run db:seed`), documentation, Better Auth security hardening.
- **Mốc 8 — Jira-Style UI Restyle:** Enterprise Jira visual density, `#2563eb` primary palette, sidebar layout, task priority indicator bars.

---

### 🔹 Phase 2: Post-MVP Functional Deepening (Mốc 9 – 21)

- **Mốc 9 — File Attachments:** `Attachment` model, private disk storage (`storage/uploads`), authenticated streaming `/api/attachments/[id]`, attachment tab.
- **Mốc 10 — Labels System:** `Label` & `TaskLabel` models, color swatch picker, default project labels seed, task label chips, board filter by label.
- **Mốc 11 — Project-Level Membership & Roles:** `ProjectMember` model, project-specific roles (`Owner`, `Admin`, `Member`), project settings member management.
- **Mốc 12 — Custom Kanban Statuses:** Dynamic `Status` model replacing hardcoded enums, custom status ordering, color dots, column generation.
- **Mốc 13 — In-App Notifications:** `Notification` model, notification event pipeline, header bell icon, unread counter badge, notification dropdown.
- **Mốc 14 — Real-time Sync (SSE):** Server-Sent Events `/api/live/stream`, in-process live hub singleton with event replay, board update debounce during drag-and-drop.
- **Mốc 15 — Sprints & Backlog Management:** `Sprint` model, Scrum backlog views, Sprint switcher, sprint progress (done/total) indicators.
- **Mốc 16 — Analytics & Metrics Dashboard:** Velocity tracking (ISO weeks), status distribution charts, assignee workload breakdown, overdue tasks summary.
- **Mốc 17 — PostgreSQL Full-Text Search:** `search_vector tsvector` column, GIN index, `websearch_to_tsquery('simple')` ranking.
- **Mốc 18 — Custom Fields:** Dynamic property schemas (`Text`, `Number`, `Date`, `Select`, `Checkbox`), `TaskCustomFieldValue` storage, task detail integration.
- **Mốc 19 — Automation / Rules Engine:** Configurable WHEN (Trigger) -> THEN (Action) rules, recursion depth guard (maxDepth = 2), execution audit logs.
- **Mốc 20 — Public REST API & API Keys:** Secure API keys (`mj_live_...`, SHA-256 hashed), Bearer authentication, `/api/v1/workspaces`, `/api/v1/tasks` endpoints.
- **Mốc 21 — Profile & Account Management:** `/account` settings, display name update, password changing, active session revocation ("Revoke other devices").

---

### 🔹 Phase 3: Modern UI/UX & Dialogs Elevation (Mốc 22 – 23)

- **Mốc 22 — UI/UX Elevation & Theming:**
  - Dark / Light / System theme engine (`src/components/ui/theme-provider.tsx`).
  - Command Palette (`⌘K` / `Ctrl+K`) for global navigation and fast actions (`src/components/command-palette.tsx`).
  - Keyboard shortcuts (<kbd>C</kbd> new task, <kbd>J</kbd>/<kbd>K</kbd> navigate tasks, <kbd>Esc</kbd> close drawer).
  - Playwright visual regression (`npm run test:visual`) & automated axe-core a11y audits (`npm run test:a11y`).
- **Mốc 23 — Modern Popup & Modal Dialogs (WCAG AA):**
  - **Create Task Modal:** Top-right board trigger button, autofocus, full metadata fields.
  - **Task Detail Drawer:** Right slide-over sheet with metadata editing, comments, activity timeline, attachments, custom fields, and labels.
  - **Manage Labels Modal:** 8-swatch visual color picker, optimistic add/remove.
  - **Invite Member Modal:** Replaced inline panel on `/workspaces/[id]/members`.
  - **Create Project Modal:** Popup modal on `/workspaces/[id]/projects`.
  - **Create Sprint Modal:** Popup modal for Sprint name, goal, start & end dates.
  - **Create Status Modal:** Popup modal for adding dynamic Kanban columns.
  - **Create Custom Field Modal:** Dynamic form adapting to Text/Number/Date/Select/Checkbox.
  - **Create Automation Rule Modal:** Visual trigger & action builder dialog.
  - **Create API Key Modal:** Secure one-time secret display with copy button.
  - **Destructive Confirmations:** Confirmation dialogs for deleting workspaces & projects.

### 🔹 Phase 4: Markdown Authoring (Mốc 24) — ✅ COMPLETED & FULLY VERIFIED

- **Mốc 24 — Rich Text / Markdown Editor + @mentions (Backlog P1):**
  - **Tokenizer tự viết, zero dependency:** `src/lib/markdown.ts` — `parseMarkdown()` / `parseInline()` trả về token thuần (`BlockNode[]` / `InlineNode[]`). Hỗ trợ heading, bold/italic/strikethrough, inline code, fenced code block, bullet/ordered list, blockquote, hr, link, và `@mention` (hỗ trợ cả tên có khoảng trắng khi truyền `members`).
  - **An toàn theo thiết kế:** renderer dựng React element từ token — **không có `dangerouslySetInnerHTML`** ở bất kỳ đâu. Link được lọc allowlist protocol qua `sanitizeHref()` (chỉ `http`/`https`/`mailto` + link tương đối; chặn `javascript:`, `data:`, protocol-relative `//host`).
  - **Read-only renderer:** `src/components/ui/markdown.tsx` — `<Markdown source members />`. Markdown `#`..`######` map sang thẻ `h3`–`h5` để không phá thứ tự heading của trang.
  - **Editor dùng chung:** `src/components/ui/markdown-editor.tsx` — toolbar 10 nút (Bold, Italic, Strikethrough, Inline code, Code block, Heading, Bullet list, Numbered list, Quote, Link), tab **Write / Preview**, và autocomplete `@mention` (↑↓ + Enter/Tab để chọn, Esc để đóng, click để chọn).
  - **@mention được lưu dạng text `@Tên`** — không thêm bảng/cột DB, không migration. Khi render, mention khớp thành viên workspace → chip `primary-soft`; không khớp → màu `accent-ink` để thấy ngay tham chiếu tới người không còn trong workspace.
  - **Đã wiring:** mô tả task trong `task-detail-modal.tsx` + `create-task-modal.tsx`, và comment trong `comment-list.tsx` (cả add/edit lẫn read view). `CommentList` nhận prop `members?: MemberWithUser[]` để bật autocomplete.
  - **Unit tests:** `src/lib/markdown.test.ts` — **30 test** (sanitizeHref, parseInline, parseMarkdown, findMentionQuery, filterMentionCandidates, multi-word mentions).
  - **E2E tests:** `e2e/markdown.spec.ts` — automated user journey test verifies rich markdown rendering, XSS stripping (`javascript:alert(1)`), @mentions autocomplete listbox, and comment chip rendering.

#### Quyết định thiết kế cần biết trước khi sửa tiếp

| Quyết định | Lý do |
| :--- | :--- |
| **Không thêm dependency** (`react-markdown`, `tiptap`, `remark-*`) | Repo có 0 markdown dep và test harness chỉ chạy Vitest node env; tokenizer tự viết (~250 dòng) đã được cover 30 unit test, không có bề mặt XSS. |
| **`textarea` vẫn là control thật của form** (giữ `name`) | Server action đọc Markdown gốc qua `FormData`; selector E2E cũ (`getByLabel("Comment content")`, `textarea[name="content"]`) không vỡ. Editor là **uncontrolled** + mirror state cho preview → tương thích `fill()` của Playwright. |
| **Preview dùng `sr-only`, không `hidden`** | `required` + `display:none` ⇒ Chrome báo *"An invalid form control … is not focusable"* và chặn submit. `sr-only` giữ validate/focus được, vẫn submit đúng giá trị. |
| **Editor đặt `role="combobox"`** | `aria-expanded` không hợp lệ trên `role=textbox` (sẽ fail axe `aria-allowed-attr`, tag wcag2a). Pattern ARIA 1.2 combobox là đúng; không có test E2E nào dùng `getByRole("textbox")`. |
| **Option của listbox dùng `onMouseDown preventDefault`** | Giữ focus trên textarea khi click option → không mất listbox giữa mousedown và click. Không cần `onBlurCapture`. |
| **Không dùng `htmlFor` bên ngoài editor** | `<label htmlFor>` chỉ trỏ được tới `id` của chính `textarea` bên trong wrapper mà caller không kiểm soát → đã đổi sang `aria-label` trên textarea + `<span>` cho nhãn hiển thị (`create-task-modal.tsx`). |

#### Selector E2E đã biết là phải giữ nguyên

| Selector | Nơi dùng |
| :--- | :--- |
| `getByLabel("Comment content")` | `e2e/comments-activities.spec.ts`, `notifications.spec.ts`, `live.spec.ts` |
| `textarea[name="content"]` | `e2e/comments-activities.spec.ts` (edit comment) |
| `getByRole("button", { name: "Post comment" })` / `{ name: "Save" }` | `e2e/comments-activities.spec.ts` — toolbar mới **không** dùng accessible name chứa chữ `"Save"`, nên không đụng nhau |

### 🔹 Phase 5: Cloud Deployment & Infrastructure (Mốc 25) — 🚀 IN PROGRESS

- **Mốc 25 — Production Deployment on Vercel + Neon Postgres + Cloudflare R2:**
  - **Mục tiêu:** Đưa Mini Jira từ môi trường local lên môi trường Production toàn cầu, đảm bảo độ trễ thấp (Singapore region), chi phí tối ưu (100% Free tiers), và zero downtime.
  - **Kiến trúc hạ tầng:**
    - **Frontend & Serverless Backend:** Vercel (Edge & Serverless Next.js 16.3.2, React 19).
    - **Database:** Neon Serverless PostgreSQL (`ap-southeast-1` Singapore) với PgBouncer connection pooling (`-pooler`).
    - **Object Storage:** Cloudflare R2 (S3-compatible, 10GB free tier, Zero Egress Fees) thay thế cho local filesystem.
    - **Session & Auth:** Better Auth với Secure Cookies, Trusted Origins trên Vercel domain.
  - **Lộ trình 5 giai đoạn thực thi:**
    - **D1 — Storage Modernization:** Viết adapter R2 (`@aws-sdk/client-s3`) tuân thủ `AttachmentStorage` kèm dispatcher tự động fallback về thư mục local khi dev offline.
    - **D2 — Neon Database Provisioning:** Tạo project Neon Singapore, lấy pooled/direct URLs, chạy `npx prisma db push` và `npm run db:seed`.
    - **D3 — Cloudflare R2 Provisioning:** Tạo bucket `mini-jira-attachments` và cấp API Token Object Read/Write.
    - **D4 — Vercel Pipeline & Secrets:** Import repo vào Vercel, cấu hình ma trận biến môi trường, kích hoạt build production.
    - **D5 — Production Smoke Test:** Kiểm thử 10 kịch bản end-to-end trên URL live (Auth, Kanban, R2 upload/download, Markdown, Timesheet, Burndown, SSE).

---

## 📋 4. Backlog & Recommended Enhancements

Any new coding agent can pick up tasks from this prioritized backlog:

| Priority | Feature Description | Affected Modules / Files | Status |
| :--- | :--- | :--- | :--- |
| **P1** | **Rich Text / Markdown Editor:** Markdown editor cho task description & comment, toolbar + preview + @mention autocomplete. | `src/lib/markdown.ts`, `src/components/ui/markdown.tsx`, `src/components/ui/markdown-editor.tsx`, `task-detail-modal.tsx`, `create-task-modal.tsx`, `comment-list.tsx` | ✅ Done & Verified |
| **P2** | **Sprint Drag-and-Drop:** Cho phép kéo task trực tiếp giữa các Sprint board và Backlog list. | `src/features/sprints/components/sprint-switcher.tsx`, `src/features/tasks/components/kanban-board.tsx`, `app/workspaces/[workspaceId]/projects/[projectId]/page.tsx` | ✅ Done & Verified |
| **P3** | **Webhooks & External Integrations:** Outbound webhook khi task lifecycle đổi (Slack / Discord / Generic JSON) + HMAC-SHA256 signature + delivery logs. | `src/features/webhooks/`, `prisma/schema.prisma`, `task-service.ts`, `comment-service.ts` | ✅ Done & Verified |
| **P4** | **Sub-tasks / Hierarchical Issues:** Quan hệ cha–con, checklist tracking, progress bar trong modal và badge trên Kanban card. | `prisma/schema.prisma`, `src/features/tasks/` | ✅ Done & Verified |
| **P5** | **Time Tracking & Worklogs:** Ước lượng thời gian (`Estimate`), ghi nhận thời gian làm việc (`Spent`), và visual tracking bar. | `prisma/schema.prisma`, `src/features/worklogs/`, `src/features/tasks/` | ✅ Done & Verified |
| **P6** | **Burndown Charts & Sprint Reports:** Biểu đồ burndown sprint (Story Points / Estimated Hours) theo thời gian thực và vận tốc hoàn thành. | `src/features/sprints/`, `src/components/ui/` | ✅ Done & Verified |
| **P7** | **Timesheet & Worklog CSV Export:** Báo cáo tổng hợp giờ làm theo thành viên/dự án/khoảng thời gian và xuất file CSV/Excel. | `src/features/worklogs/`, `src/components/ui/` | ✅ Done & Verified |
| **P8** | **Swimlanes & Epic Grouping:** Phân làn Kanban board theo Assignee, Epic/Parent, hoặc Priority với collapsible swimlanes. | `src/features/tasks/`, `src/features/projects/` | ⬜ Planned (Future) |
| **P9** | **Bulk Operations & Batch Actions:** Chọn nhiều task (Multi-select) để đổi trạng thái, gán người, đổi sprint, gắn nhãn hàng loạt. | `src/features/tasks/` | ⬜ Planned (Future) |
| **P10** | **Issue Linking & Dependency Graph:** Quan hệ phụ thuộc (`blocks`, `is blocked by`, `relates to`) kèm cảnh báo chặn trên thẻ. | `prisma/schema.prisma`, `src/features/tasks/` | ⬜ Planned (Future) |
| **P11** | **Workspace Audit Trail & Activity Heatmap:** Nhật ký hoạt động toàn workspace và biểu đồ heatmap tần suất đóng góp. | `src/features/activities/`, `src/features/analytics/` | ⬜ Planned (Future) |

### 4.1 Future Enterprise Horizons Blueprint (P8 – P11)

Khi dự án bước vào giai đoạn mở rộng tiếp theo, các coding agent có thể bám sát thiết kế định hướng dưới đây:

1. **Priority 8 (P8) — Kanban Swimlanes & Visual Grouping:**
   - **Mục tiêu:** Chia bảng Kanban thành các làn ngang (Swimlanes) có thể thu gọn/mở rộng (*Collapsible*).
   - **Chế độ phân nhóm:**
     - Theo **Assignee:** Mỗi thành viên là một hàng, hiển thị công việc đang xử lý của từng người.
     - Theo **Priority:** Hàng Urgent nằm trên cùng, tiếp theo là High, Medium, Low.
     - Theo **Parent Task / Epic:** Gom các sub-tasks theo đầu việc cha.
   - **Tương tác:** Drag & drop task giữa các làn (ví dụ kéo task sang hàng của User B sẽ tự động chuyển Assignee).

2. **Priority 9 (P9) — Bulk Operations & Batch Actions:**
   - **Mục tiêu:** Tiết kiệm thời gian thao tác khi quản lý số lượng lớn issue.
   - **Cơ chế chọn:** Giữ phím `Shift` + click hoặc bật chế độ `Checkbox Select`.
   - **Thanh tác vụ nổi (Floating Bulk Toolbar):**
     - Đổi trạng thái hàng loạt (Batch Status change).
     - Chuyển Assignee cho toàn bộ task được chọn.
     - Gán Sprint hoặc đưa về Backlog đồng loạt.
     - Gắn / gỡ Label hàng loạt.
     - Xóa hàng loạt (có modal xác nhận bảo vệ).

3. **Priority 10 (P10) — Issue Linking & Dependencies:**
   - **Mục tiêu:** Mô hình hóa sự ràng buộc logic giữa các công việc trong chu trình Agile.
   - **Kiểu liên kết:**
     - `BLOCKS` / `IS_BLOCKED_BY` (Chặn hoàn thành).
     - `RELATES_TO` (Liên quan).
     - `DUPLICATES` / `IS_DUPLICATED_BY` (Trùng lặp).
   - **UI & Cảnh báo:** Thẻ Kanban hiển thị icon ổ khóa đỏ cảnh báo nếu task đang bị "blocked" bởi một task chưa Done. Drawer chi tiết có tab "Linked Issues".

4. **Priority 11 (P11) — Workspace Activity Stream & Heatmap:**
   - **Mục tiêu:** Báo cáo quản trị cấp cao cho Workspace Owner/Admin.
   - **Tính năng:**
     - Bảng nhật ký kiểm toán (*Audit Trail*) tổng hợp mọi sự kiện trong workspace.
     - Biểu đồ nhiệt (*Activity Heatmap*) theo phong cách GitHub commit calendar, cho thấy ngày nào team hoạt động tích cực nhất.

---

## ⚡ 5. Verification Commands for Coding Agents

When working on any change, run the following verification steps:

```bash
# 1. Typecheck (Must pass with 0 errors)
npx tsc --noEmit

# 2. Run Vitest Unit & Integration Suites (All 437 tests must pass)
npm test

# 3. Lint — baseline hiện tại là 9 errors / 13 warnings, TẤT CẢ đều pre-existing
#    (react-hooks/set-state-in-effect). Đừng cố fix nếu không nằm trong scope,
#    nhưng đừng để thêm lỗi mới. Kiểm tra file vừa sửa:
npx eslint <đường-dẫn-file>

# 4. Run Specific Playwright E2E Suite (cần PostgreSQL đang chạy)
npx playwright test e2e/timesheet.spec.ts --project=chromium
npx playwright test e2e/sprint-report.spec.ts --project=chromium
npx playwright test e2e/time-tracking.spec.ts --project=chromium
npx playwright test e2e/subtasks.spec.ts --project=chromium
npx playwright test e2e/webhooks.spec.ts --project=chromium
npx playwright test e2e/markdown.spec.ts --project=chromium
npx playwright test e2e/tasks.spec.ts --project=chromium
npx playwright test e2e/comments-activities.spec.ts --project=chromium
npx playwright test e2e/labels.spec.ts --project=chromium
npx playwright test e2e/custom-fields.spec.ts --project=chromium
npx playwright test e2e/theme.spec.ts --project=chromium

# 5. Run Full E2E Test Suite
npm run test:e2e
```

> **Lưu ý Windows/PowerShell:** `npx` có thể bị chặn bởi ExecutionPolicy — dùng `cmd.exe /c "..."` hoặc `& npx.cmd vitest run`.

---

## 📍 6. Current Handoff State (as of 2026-10-02)

### Đã xong và đã verify 100%

- ✅ **Mốc 0–23**: Toàn bộ hệ thống core MVP, post-MVP features, and modern dialogs.
- ✅ **Mốc 24 (P1)**: Rich Text / Markdown Editor & @Mentions (zero dependencies, XSS safe, multi-word member mention parsing, task & comment wiring).
- ✅ **Backlog P2**: Sprint Drag-and-Drop (kéo thả task trực tiếp vào Sprint tabs / Backlog tab với visual feedback và instant optimistic update).
- ✅ **Backlog P3**: Webhooks & External Integrations (Slack/Discord/Generic JSON formatters, HMAC-SHA256 signature, delivery logs, settings UI).
- ✅ **Backlog P4**: Sub-tasks / Hierarchical Issues (1-level hierarchy guard, checklist, modal progress bar, Kanban badge).
- ✅ **Backlog P5**: Time Tracking & Worklogs (Jira-Standard):
  - Model `Worklog` + trường `originalEstimateMinutes` trên Task trong Prisma schema.
  - Duration engine Jira standard (`1w = 5d = 40h = 2400m`, `1d = 8h = 480m`, `1h = 60m`, `1m = 1m`).
  - Thanh tiến độ `TimeTrackingBar` (progress bar %, thời gian logged vs estimate, remaining time, warning vượt định mức, chỉnh sửa estimate inline, nút "+ Log work").
  - Tab `Work Log` chuyên biệt trong Drawer liệt kê lịch sử chấm công, avatar người ghi nhận, thời lượng, ghi chú, quyền sửa/xóa.
  - Modals `LogWorkModal` & `EditWorklogModal` với preview parse thời gian trực quan.
  - Badge nhỏ gọn `⏱️ [logged] / [estimate]` trên thẻ Kanban Card và input Original Estimate trong modal tạo task.
- ✅ **Backlog P6**: Burndown Charts & Sprint Reports:
  - Calculation engine toán học thuần túy (`sprint-report-service.ts`) tính toán tiến độ ngày qua ngày, hỗ trợ chuyển đổi giữa Remaining Hours (`hours`) và Issue Count (`issues`).
  - Mô hình 3 đường: Ideal line, Actual line, Forecast trendline, cùng khả năng nhận diện Scope Creep (các task thêm vào sau `startDate`).
  - Biểu đồ thuần React SVG (`burndown-chart.tsx`) zero external chart dependencies, responsive viewBox, hover guideline, và floating HTML tooltip hiển thị chi tiết số liệu theo ngày.
  - Modal Sprint Report (`sprint-report-modal.tsx`) với 4 thẻ KPI (Completion %, Remaining, Logged Work, Scope Creep), nút chuyển metric, và 3 tab phân loại task (Completed, Incomplete, Added Mid-Sprint).
  - Tích hợp nút kích hoạt "📈 Sprint Report" ngay cạnh thanh Sprint Switcher trên Kanban Board.
- ✅ **Backlog P7**: Timesheet & Worklog CSV Export:
  - Calculation engine tổng hợp thời gian (`timesheet-service.ts`) nhóm công theo từng thành viên qua từng ngày trong tuần, tính toán tổng đội ngũ (`Team Daily Sum`), số người đóng góp tích cực và giờ trung bình ngày làm việc.
  - Bảng ma trận tuần phong cách Jira Tempo/Clockify (`timesheet-matrix.tsx`) và bảng kiểm kê chi tiết (`timesheet-table.tsx`).
  - Bộ xuất file CSV chuẩn RFC 4180 (`csv-export.ts`) tích hợp sẵn **UTF-8 BOM (`\uFEFF`)** để hiển thị chuẩn tiếng Việt trên Microsoft Excel, phòng vệ chống CSV formula injection, và hỗ trợ tính giờ thập phân (Decimal Hours).
  - Route Handler chuyên biệt `GET /api/workspaces/[workspaceId]/timesheet/export` tải file trực tiếp và trang quản trị `/workspaces/[workspaceId]/timesheet` trên `WorkspaceNav`.
- ✅ `npx tsc --noEmit` → **0 errors**.
- ✅ `npm test` → **437 / 437 unit & integration tests PASSED** (34 files).
- ✅ `npx playwright test e2e/timesheet.spec.ts --project=chromium` → **PASSED**.
- ✅ `npx playwright test e2e/sprint-report.spec.ts --project=chromium` → **PASSED**.
- ✅ `npx playwright test e2e/time-tracking.spec.ts --project=chromium` → **PASSED**.
- ✅ `npx playwright test e2e/subtasks.spec.ts --project=chromium` → **PASSED**.
- ✅ `npx playwright test e2e/webhooks.spec.ts --project=chromium` → **PASSED**.
- ✅ `npx playwright test e2e/markdown.spec.ts --project=chromium` → **PASSED**.
- ✅ `npx playwright test e2e/comments-activities.spec.ts --project=chromium` → **PASSED**.

### Đang thực hiện (In Progress)

- 🚀 **Mốc 25 — Production Deployment:** Triển khai Cloud Infrastructure trên Vercel + Neon Serverless Postgres (`ap-southeast-1`) + Cloudflare R2 Object Storage.
  - ✅ **D1 (Đã hoàn thành 100%):** Storage Modernization — `@aws-sdk/client-s3`, driver `r2-attachment-storage.ts`, dispatcher 3-tier (`R2 → Local → Noop`) với cơ chế auto-fallback. 448/448 tests passed.
  - ✅ **D2 (Đã hoàn thành 100%):** Neon Database Provisioning — Schema sync, Full-Text Search trigger & GIN index, seed 4 tài khoản demo.
  - ⏭️ **D3 (Tạm hoãn):** Cloudflare R2 Provisioning — Bỏ qua cho lần deploy đầu. Tính năng Attachment vẫn hoạt động trên local dev; trên Vercel production trả lỗi thân thiện qua `NoopAttachmentStorage` thay vì crash app.
  - ⏳ **D4 (Tiếp theo):** Vercel Deployment & Environment Variables — Import GitHub repo, cấu hình `DATABASE_URL` (Neon Pooled), `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `NODE_ENV=production`, kích hoạt build.
  - ⬜ **D5:** Production Smoke Test (10 kịch bản).

### Hướng dẫn cho Coding Agent tiếp theo (Khi tiếp tục phát triển trong tương lai)

- **Trạng thái hiện tại:** Toàn bộ hệ thống core và 7 Priority nâng cao (**P1 ➔ P7**) đã **hoàn thành 100%**. Mốc 25 (Production Deployment) đang được tiến hành để đưa dự án lên Cloud.
- **Tài liệu định hướng tương lai:** Đã ghi nhớ và thiết kế sẵn kiến trúc chi tiết cho các Priority mở rộng (**P8 ➔ P11**) tại **Mục 4.1**.
- **Khi tiếp tục mở rộng:**
  1. **Priority 8 (P8) — Swimlanes & Epic Grouping:** Phân làn Kanban board theo Assignee, Priority, hoặc Epic với collapsible swimlanes.
  2. **Priority 9 (P9) — Bulk Operations & Batch Actions:** Chọn nhiều task (Multi-select) để thao tác hàng loạt.
  3. **Priority 10 (P10) — Issue Linking & Dependency Graph:** Ràng buộc logic `blocks` / `is blocked by`.
  4. **Priority 11 (P11) — Workspace Activity Stream & Heatmap:** Kiểm toán tập trung và biểu đồ nhiệt đóng góp.
- Luôn tuân thủ quy tắc kiến trúc vertical slice (`src/features/<domain>`) và chạy `npm test` & `npx tsc --noEmit` trước khi bàn giao.
