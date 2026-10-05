# 📝 Changelog

All notable changes to the **Mini Jira** project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added
- **Timesheet & Worklog CSV Export (Priority 7 — Workspace Reporting & Accounting):**
  - **Timesheet Aggregation Engine (`src/features/worklogs/timesheet-service.ts`):**
    - Pure calculation engine `calculateTimesheetReport` aggregating granular worklogs into daily buckets per member, calculating team daily totals, grand total hours, active contributors, and workday averages.
    - Date utilities: `getWeekDateRange` (Monday 00:00 to Sunday 23:59), `getMonthDateRange`, `generateTimesheetDays` (with weekend detection), and `toISODateString`.
    - Fully covered by 8 unit tests in `src/features/worklogs/timesheet-service.test.ts`.
  - **RFC 4180 CSV Export Engine (`src/features/worklogs/csv-export.ts`):**
    - RFC 4180 compliance with quoting and escaping for commas, quotes, and newlines.
    - UTF-8 Byte Order Mark (`\uFEFF`) included by default so Microsoft Excel (Windows) parses Vietnamese names and Unicode characters without mojibake.
    - OWASP CSV formula injection defense automatically neutralizes leading `=,+,-,@,\t,\r` characters with single-quote escaping.
    - Calculates both formatted durations (`2h 30m`) and decimal hours (`2.50`) for accounting and payroll use.
    - Fully covered by 9 unit tests in `src/features/worklogs/csv-export.test.ts`.
  - **Prisma Repository & Route Handler:**
    - Extended `prismaWorklogRepository` with `queryTimesheetWorklogs(workspaceId, filter)` supporting date range, project, and author filtering.
    - Added dedicated Route Handler `GET /api/workspaces/[workspaceId]/timesheet/export` for direct browser streaming downloads.
    - Server Action `getTimesheetReportAction(workspaceId, filter)` for dynamic in-page transitions without full page reload.
  - **Modern UI Components & Navigation (`src/features/worklogs/components/`):**
    - `TimesheetMatrix`: Jira Tempo/Clockify-style weekly calendar grid showing member rows, daily hour cells, row totals, and a highlighted `👥 Team Daily Sum` footer row.
    - `TimesheetTable`: Granular audit log table with date, member avatar, project badge, task link, duration badge, and work descriptions.
    - `TimesheetFilterBar`: Date navigation (`◀`, `This Week`, `▶`), project dropdown, member dropdown, view mode toggle (`📅 Matrix` vs `📋 Logs`), and `📥 Export CSV` button.
    - `TimesheetView`: Main coordinator with 4 KPI summary cards (Total Hours Logged, Active Contributors, Workday Average, Top Project).
    - Integrated "Timesheet" nav link into `WorkspaceNav` with `ClockIcon` and dedicated page at `/workspaces/[workspaceId]/timesheet`.
  - **Automated E2E Testing:**
    - Full end-to-end user journey suite in `e2e/timesheet.spec.ts` covering task estimation, logging work across multiple issues, viewing weekly matrix and audit logs, date navigation, and verifying CSV export headers, BOM, and payload.
- **Burndown Charts & Sprint Reports (Priority 6 — Sprint Analytics):**
  - **Mathematical Burndown Engine (`src/features/sprints/sprint-report-service.ts`):**
    - Pure calculation engine `calculateSprintReport` generating daily progression timelines (`generateSprintDays`).
    - Dual tracking metrics: **Remaining Hours** (`hours` - computed via task estimates & worklogs) and **Issue Count** (`issues` - task status completions).
    - Tri-line visualization modeling: **Ideal Burndown Line** (linear descent from sprint start to end), **Actual Remaining Line** (accounting for completed work, newly created tasks, and mid-sprint scope changes), and **Forecast Trendline** (projection based on actual velocity).
    - Scope Creep detection: identifies tasks created or added into the sprint after `sprint.startDate` with mid-sprint indicators (`addedAfterStart`).
    - RBAC integration: enforced via `canViewTasks(actor.projectRole)`.
    - Fully covered by 8 unit tests in `src/features/sprints/sprint-report-service.test.ts`.
  - **Database Repository & Server Action (`src/features/sprints/`):**
    - `prisma-sprint-report-repository.ts`: queries sprint metadata, project info, assigned tasks with estimates & statuses, task activity history (`StatusChanged`), and worklog records.
    - Server Action `getSprintReportAction(workspaceId, projectId, sprintId, metric)` in `actions.ts`.
  - **Zero-Dependency Vector SVG Chart (`src/features/sprints/components/burndown-chart.tsx`):**
    - Built with pure React SVG: `<svg viewBox="...">`, gradient area fill (`primary-soft`), dashed ideal guideline, crisp solid actual line, dotted forecast projection, responsive axes, and gridlines.
    - Interactive cursor tracking guideline with hovering data point circles and floating HTML tooltip displaying exact date, ideal target, actual remaining, and delta.
    - Theme-aware styles compatible with light and dark modes.
  - **Sprint Report Modal & Board Integration:**
    - Modal dialog (`SprintReportModal`) featuring KPI summary cards (**Completion %**, **Remaining Work**, **Logged Work**, and **Scope Creep**), metric switcher toggle (`⏱️ Hours` vs `📋 Issues`), embedded SVG Burndown Chart, and tabbed task audit list (**Completed Tasks**, **Incomplete Tasks**, **Added Mid-Sprint**).
    - Direct "📈 Sprint Report" trigger button in `SprintSwitcher` adjacent to active sprint selector.
  - **Automated E2E Testing:**
    - Comprehensive Playwright test suite in `e2e/sprint-report.spec.ts` validating sprint creation with dates, task estimation, opening report modal, toggling metrics, logging work, completing tasks, and verifying real-time KPI card & chart updates.
- **Time Tracking & Worklogs (Priority 5 — Jira-Standard):**
  - **Prisma Schema & Database Models:**
    - Added `originalEstimateMinutes Int?` to `Task` model.
    - Added `Worklog` model (`id`, `taskId`, `authorId`, `timeSpentMinutes`, `startedAt`, `description`, `createdAt`, `updatedAt`) with cascade delete, indexed on `[taskId]`, `[authorId]`, and `[taskId, startedAt]`.
    - Extended `ActivityType` enum with `EstimateChanged` and `Worklogged`.
  - **Jira-Standard Working Time Engine (`src/features/worklogs/duration.ts`):**
    - Supports `1w` (5d / 40h), `1d` (8h), `1h` (60m), `1m` (1m), decimal values (`1.5d`, `2.5h`), and multi-unit strings (`2w 3d 4h 30m`).
    - Functions: `parseDuration`, `formatDuration`, `formatDurationDetailed`.
    - Fully covered by 15 unit tests in `src/features/worklogs/duration.test.ts`.
  - **Business Logic & Server Actions (`src/features/worklogs/`):**
    - `calculateTimeTrackingSummary`, `listWorklogs`, `logWork`, `updateWorklog`, `deleteWorklog` in `worklog-service.ts`.
    - Granular RBAC (`canLogWork`, `canViewWorklogs`, `canEditWorklog`, `canDeleteWorklog`) in `src/features/authorization/permissions.ts`.
    - Server Actions (`logWorkAction`, `updateWorklogAction`, `deleteWorklogAction`, `setTaskEstimateAction`) triggering real-time SSE broadcasts (`publishBoardUpdate`) and path revalidations.
    - Covered by 9 unit tests in `src/features/worklogs/worklog-service.test.ts`.
  - **Task Detail Drawer & UI Integration:**
    - Visual progress bar ([`TimeTrackingBar`](file:///D:/NextJsProjects/mini-jira/src/features/worklogs/components/time-tracking-bar.tsx)) displaying logged vs estimate, remaining time, over-budget indicators, inline estimate editing, and "+ Log work" trigger.
    - Work Log tab ([`WorklogList`](file:///D:/NextJsProjects/mini-jira/src/features/worklogs/components/worklog-list.tsx)) with author avatars, formatted duration badges, start dates, descriptions, and edit/delete actions.
    - Interactive dialogs: [`LogWorkModal`](file:///D:/NextJsProjects/mini-jira/src/features/worklogs/components/log-work-modal.tsx) with live parse feedback and [`EditWorklogModal`](file:///D:/NextJsProjects/mini-jira/src/features/worklogs/components/edit-worklog-modal.tsx).
    - Compact `⏱️ [logged] / [estimate]` badge on Kanban cards in [`KanbanBoard`](file:///D:/NextJsProjects/mini-jira/src/features/tasks/components/kanban-board.tsx).
    - Optional "Original Estimate" input field in [`CreateTaskModal`](file:///D:/NextJsProjects/mini-jira/src/features/tasks/components/create-task-modal.tsx).
    - End-to-end user journey test suite in [`e2e/time-tracking.spec.ts`](file:///D:/NextJsProjects/mini-jira/e2e/time-tracking.spec.ts).
- **Workspace Avatar & Curated Multi-Domain Icon Library:**
  - Added `icon` attribute to `Workspace` database model with migration in Prisma schema.
  - Built curated multi-domain icon catalogue ([`WORKSPACE_ICONS`](file:///D:/NextJsProjects/mini-jira/src/features/workspaces/workspace-icons.tsx)) categorized into **Tech & Engineering** (🚀 Rocket, 💻 Laptop, ⚡ Lightning, 🔬 Lab, 🛠️ Tools, 🤖 Robot, 🛡️ Shield), **Design & Creative** (🎨 Palette, ✨ Sparkles, 🎯 Target, 💡 Bulb, 🔮 Crystal Ball, 🌈 Rainbow, 🎪 Circus), **Business & Finance** (💼 Briefcase, 📈 Chart, 💎 Gem, 🏆 Trophy, 👑 Crown, 💰 Money, 🏛️ Landmark), **Operations & Strategy** (⚙️ Gear, 🧭 Compass, 🏗️ Construction, 📦 Package, 🌐 Globe, 🔑 Key, 📌 Pin), and **Lifestyle & Culture** (☕ Coffee, 🌲 Evergreen, 🔥 Fire, 🍕 Pizza, 🎮 Gamepad, 🎵 Music, 🥑 Avocado).
  - Created [`<WorkspaceAvatar>`](file:///D:/NextJsProjects/mini-jira/src/features/workspaces/components/workspace-avatar.tsx) supporting multiple standard sizes (`xs`, `sm`, `md`, `lg`, `xl`) with rich gradient backgrounds and automatic graceful fallback to initial letters for workspaces without custom icons.
  - Created interactive [`<WorkspaceIconPicker>`](file:///D:/NextJsProjects/mini-jira/src/features/workspaces/components/workspace-icon-picker.tsx) with live preview avatar, category filter tabs, and single-click selection.
  - Integrated icon picker into [`CreateWorkspaceModal`](file:///D:/NextJsProjects/mini-jira/src/features/workspaces/components/create-workspace-modal.tsx) and Workspace [`SettingsForm`](file:///D:/NextJsProjects/mini-jira/src/features/workspaces/components/settings-form.tsx).
  - Upgraded [`WorkspaceSwitcher`](file:///D:/NextJsProjects/mini-jira/src/features/workspaces/components/workspace-switcher.tsx) (dropdown trigger & list items, block cards grid), Workspace Overview page header, and Account page (My Workspaces) to display full avatar icons.
- **Interactive Project Cards (`/workspaces/[workspaceId]/projects`):**
  - Converted project list into a responsive, full-card clickable grid (`sm:grid-cols-2 lg:grid-cols-3`).
  - Added avatar badge with initial letter, project status badge (`Active` / `Archived`), 2-line clamped description, and footer Kanban hint.
  - Added real-time instant search bar (filter by name and description) with clear button.
  - Added status segment tabs (`All`, `Active`, `Archived`).
  - Isolated action buttons (`Archive`, `Restore`, `Settings`) to prevent accidental navigation when performing actions.
- **Modern Member Cards & Filter Toolbar (`/workspaces/[workspaceId]/members`):**
  - Upgraded flat members list to a responsive card grid (`sm:grid-cols-2 lg:grid-cols-3`).
  - Added role-colored avatar initials (`Owner` = amber, `Admin` = primary blue, `Member` = slate neutral).
  - Added `(You)` badge for current authenticated user.
  - Added real-time search by member name or email with instant clear button.
  - Added role filter segment tabs (`All`, `Owners`, `Admins`, `Members`) with live counters.
  - Integrated role change dropdown + Save button and Remove member actions directly within each card.
- **Enhanced Task Search & Filter Toolbar (Kanban Board):**
  - Consolidated search and all 4 dropdown filters (`Status`, `Priority`, `Assignee`, `Label`) onto a single inline horizontal row with `w-auto shrink-0`.
  - Added debounced search (250ms) to eliminate typing jitter and excessive re-renders.
  - Added instant clear button (`✕`) and <kbd>Esc</kbd> key dismissal.
  - Added global keyboard shortcut (<kbd>/</kbd>) to instantly focus the task search input from anywhere on the board.
  - Added animated loading indicator (`Spinner`) while search query transitions.
  - Restyled filter dropdowns and toolbar container with modern rounded aesthetics, backdrop blur, and refined focus rings.
- **Workspace Creation Modal Dialog & Sticky Viewport Sidebar Overhaul:**
  - Introduced dedicated centered modal dialog ([`CreateWorkspaceModal`](file:///D:/NextJsProjects/mini-jira/src/features/workspaces/components/create-workspace-modal.tsx)) with backdrop blur, keyboard shortcuts, autofocus, and smooth validation.
  - Eliminated cramped inline form expansion inside the sidebar switcher and card headers.
  - Upgraded sidebar to `sticky top-0 h-screen flex flex-col`: sidebar is permanently pinned to the viewport and does NOT stretch with page content height.
  - Pinned footer at the bottom of the screen containing the User Profile card and direct Sign out button — always accessible without scrolling down long pages.
  - Made the navigation links area (`WorkspaceNav`) scroll independently if items exceed viewport space.
  - Removed the unneeded "New project" button from the sidebar footer (projects are managed on the Projects page).
  - Placed workspace switcher in a dedicated top header section outside scrollable containers, completely fixing right-edge clipping caused by `overflow-y-auto`.
  - Removed duplicate redundant workspace info box from the sidebar.
  - Integrated "+ New workspace" modal trigger across Sidebar Switcher, `/workspaces` page, and `/account` (My Workspaces).
- **Sticky Quick-Jump Navigation for Project Settings (`/workspaces/[id]/projects/[id]/settings`):**
  - Added sticky, glassmorphism / backdrop-blur quick-nav bar at the top of Project Settings.
  - Anchored all 7 configuration sections (`#general`, `#statuses`, `#sprints`, `#custom-fields`, `#automation`, `#webhooks`, `#members`, `#danger-zone`) for effortless single-click navigation.
- **Active Devices & Sessions Cards (`/account` ➔ Sessions):**
  - Transformed the flat session table into responsive Device Cards.
  - Added active device indicators (pulsing green dot for `Current device`), IP badges, created / expiration timestamps, and isolated revoke session buttons.
- **Account Page Hero Profile Card & Modernized Tabs (`/account`):**
  - Transformed the plain account top section into a rounded Hero Profile Card with subtle gradient banner cover.
  - Added glassmorphic "Back to Workspaces" pill button and styled Sign out action.
  - Elevated user profile presentation with large gradient avatar initials, active status badge, email code badge, and "Member since" timestamp.
- **Workspace Tabs Layout & Header Standardization (Overview, Projects, Members, Analytics, Settings):**
  - Standardized the outer container structure across all 5 workspace tabs to `<div className="space-y-6">`, removing jarring arbitrary max-width constraints (`max-w-4xl` on Overview and `max-w-5xl` on Analytics) that caused uneven left/right gutters.
  - Implemented a unified top Page Header component pattern across all 5 tabs with matching square icon badges (`BoardsIcon` for Projects, `UsersIcon` for Members, `BarChartIcon` for Analytics, `SettingsIcon` for Settings, and Initial avatar for Overview), title, subtitle, and right-aligned CTA action buttons separated by `border-b border-rule pb-5`.
  - Replaced isolated white-box panels in Settings and Overview with consistent cardified components (`rounded-xl border border-rule bg-panel p-6 shadow-2xs`).

---

## [0.5.0] - 2026-10-01

### Added
- **Sub-tasks & Hierarchical Issues (Backlog P4):**
  - Prisma self-referencing relationship `Task.parentId` with cascade delete and indexing.
  - Task service logic with 1-level depth guard (`Subtasks cannot have subtasks (max depth 1)`) and automatic `sprintId` inheritance from parent task.
  - `SubtaskList` component in Task Detail Drawer with live completion progress meter (`X of Y completed (Z%)`), quick inline creation, and unlinking.
  - Subtask completion progress badge `X/Y` and `↳ sub-task` indicator tag on Kanban cards.
  - Playwright E2E test suite `e2e/subtasks.spec.ts` and 7 new Vitest unit tests (385 tests total).

---

## [0.4.0] - 2026-09-30

### Added
- **Webhooks & External Integrations (Backlog P3):**
  - Outbound webhooks for task lifecycle events (`task.created`, `task.status_changed`, `task.priority_changed`, `task.comment_created`).
  - Multi-platform formatting: Slack Block Kit, Discord Embeds, and Generic JSON payloads.
  - Cryptographic HMAC-SHA256 signature header (`X-MiniJira-Signature: sha256=...`).
  - Webhook management UI under Project Settings with Ping test and delivery logs inspector.
  - Playwright E2E suite `e2e/webhooks.spec.ts` and unit test suites for formatters and dispatcher.

---

## [0.3.0] - 2026-09-28

### Added
- **Sprint Drag-and-Drop (Backlog P2):**
  - Drag tasks directly between Active Sprints and Backlog tabs with instant optimistic updates and board synchronization.

---

## [0.2.0] - 2026-09-25

### Added
- **Rich Text / Markdown Editor & @Mentions (Mốc 24 / Backlog P1):**
  - Zero-dependency custom Markdown tokenizer (`src/lib/markdown.ts`) rendering directly to React elements (zero `dangerouslySetInnerHTML`).
  - Markdown toolbar editor (`src/components/ui/markdown-editor.tsx`) with 10 formatting actions, Write / Preview tab toggle, and `@mention` autocomplete listbox.
  - Integration into Task Detail Drawer, Create Task Modal, and Comment List.
  - Full XSS sanitizer allowing safe protocols (`http`, `https`, `mailto`, relative links) while stripping `javascript:` and unsafe protocols.
  - Playwright E2E suite `e2e/markdown.spec.ts` and 30 Vitest unit tests.

---

## [0.1.0] - 2026-09-15

### Added
- **Core Platform MVP & Post-MVP (Mốc 0 – 23):**
  - **Auth & RBAC (Mốc 0-2):** Better Auth integration, password policy, workspace management, roles (`Owner`, `Admin`, `Member`).
  - **Projects & Kanban (Mốc 3-4):** Project lifecycle, $O(1)$ fractional decimal positioning, 3-column Kanban board.
  - **Comments & Activities (Mốc 5):** Discussions, author ownership, immutable audit trail.
  - **Search & Filters (Mốc 6):** Substring search, multi-criteria filters with URL query sync.
  - **Attachments & Labels (Mốc 9-10):** File uploads, authenticated streaming, color swatch label picker.
  - **Project Membership & Statuses (Mốc 11-12):** Project-scoped roles, custom dynamic Kanban columns.
  - **Notifications & SSE (Mốc 13-14):** In-app notification bell, live Server-Sent Events hub with replay.
  - **Sprints & Analytics (Mốc 15-16):** Scrum sprints, backlog management, ISO week velocity tracking, workload charts.
  - **Full-Text Search & Custom Fields (Mốc 17-18):** PostgreSQL GIN tsvector search, dynamic schema fields (Text, Number, Date, Select, Checkbox).
  - **Automation & Public REST API (Mốc 19-20):** WHEN -> THEN rule engine with recursion guard, SHA-256 hashed API keys.
  - **Account & UI Elevation (Mốc 21-23):** Profile management, theme switcher (Light/Dark/System), Command Palette (`⌘K`), modern popup dialogs.
