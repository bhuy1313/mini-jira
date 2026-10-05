# Mini Jira (MVP)

A streamlined, production-ready Jira-like project and issue management platform built with **Next.js 16**, **TypeScript**, **PostgreSQL**, **Prisma ORM**, and **Better Auth**.

---

## 🌟 Key Highlights & Architectural Principles

- **Server-Enforced Authorization (RBAC):** Every data query and mutation strictly enforces workspace membership and role-based permissions (`Owner`, `Admin`, `Member`) directly on the server via `Actor` context (`requireActor`). UI controls adapt dynamically, but security is never entrusted to the client.
- **Vertical Slice Feature Architecture:** Code organized cleanly into domain feature modules under `src/features/<domain>` (`actions`, `services`, `repositories`, `schemas`, `components`, `permissions`).
- **Fractional Ordering for Kanban:** Tasks use high-precision PostgreSQL Decimal positions (`position.ts`) allowing $O(1)$ reordering between adjacent items without database-locking table updates.
- **Immutable Audit History:** Task lifecycle events (creation, title, status, priority, assignee, due date changes) are recorded automatically in database transactions with zero public modification APIs.
- **Search & Filter with URL State:** Workspace-isolated substring search combined with multi-criteria filters (Status, Priority, Assignee) synchronized via validated URL search parameters.
- **Safe Markdown Authoring:** Zero-dependency Markdown tokenizer rendering straight to React elements (no `dangerouslySetInnerHTML` anywhere), with a shared toolbar editor, Write/Preview toggle, and `@mention` autocomplete — used for task descriptions and comments.
- **Robust Verification:** 385 automated Vitest unit/integration tests (29 suites) and comprehensive Playwright E2E suites (UC-001 to UC-009 + Mốc 24 + Webhooks + Sub-tasks).

---

## 🛠 Tech Stack

| Layer | Technology |
| :--- | :--- |
| **Framework** | [Next.js 16 (App Router)](https://nextjs.org/) + React 19 |
| **Language** | TypeScript (Strict mode) |
| **Database & ORM** | PostgreSQL + [Prisma ORM 7](https://www.prisma.io/) (with `@prisma/adapter-pg`) |
| **Authentication** | [Better Auth](https://better-auth.com/) (Email & Password, Session Cookies) |
| **Validation** | [Zod](https://zod.dev/) |
| **Styling** | Tailwind CSS v4 |
| **Testing** | [Vitest](https://vitest.dev/) (Unit/Service/RBAC) + [Playwright](https://playwright.dev/) (E2E) |

---

## 📊 Domain Model & Roles

### Roles & Permission Matrix

| Role | Workspace Settings | Member Management | Project Lifecycle | Task Full Edit | Task Move / Self-Edit | Comments |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Owner** | Full (Edit / Delete) | Add / Change Role / Remove | Create / Edit / Archive / Hard Delete | ✅ All fields | ✅ Yes | Edit own / Delete any |
| **Admin** | Read-only | Add / Remove Members | Create / Edit / Archive | ✅ All fields | ✅ Yes | Edit own / Delete any |
| **Member** | Read-only | View list | View Active Projects | ❌ No | ✅ If Creator or Assignee | Edit own / Delete own |

### Core Entities

- **User & Account / Session:** Managed with Better Auth.
- **Workspace & WorkspaceMember:** Multi-tenant boundaries. Exactly 1 Owner per workspace.
- **Project:** Workspace-scoped; supports active views and soft-archival (`archivedAt`).
- **Task:** Project-scoped task with title, status (`Todo`, `InProgress`, `Done`), priority (`Low`, `Medium`, `High`, `Urgent`), position, creator, and assignee.
- **Comment:** Task-scoped discussions with author-ownership controls.
- **Activity:** Immutable audit trail records.

---

## 🚀 Getting Started

### 1. Prerequisites

- **Node.js**: >= 20.x
- **PostgreSQL Database** instance

### 2. Environment Variables

Create a `.env` file in the project root:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/mini_jira?schema=public"
BETTER_AUTH_SECRET="your-super-secret-random-key-at-least-32-chars-long"
BETTER_AUTH_URL="http://localhost:3000"
BETTER_AUTH_TRUSTED_ORIGINS="http://localhost:3000"
```

### 3. Installation & Database Setup

```bash
# Install dependencies
npm install

# Run database migrations
npx prisma migrate deploy

# Generate Prisma Client
npx prisma generate

# Seed sample data (Workspaces, Projects, Demo Users, Tasks, Comments, Audit logs)
npm run db:seed
```

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 👥 Demo Accounts

After running `npm run db:seed`, you can log in immediately using the accounts below:

| Role | Email | Password |
| :--- | :--- | :--- |
| **Owner** | `owner@demo.com` | `Password123!` |
| **Admin** | `admin@demo.com` | `Password123!` |
| **Member** | `member@demo.com` | `Password123!` |
| **Developer** | `dev@demo.com` | `Password123!` |

---

## 🧪 Testing Suite

### Unit & Integration Tests (Vitest)

Runs **385 tests** across 29 suites covering authorization matrix, workspace rules, fractional positioning, task/project/comment/sprint/status/label/attachment/notification/analytics/custom-field/automation/API-key/webhook services, subtasks hierarchy, markdown parser, live-hub events, and full-text search:

```bash
npm test
# or watch mode
npm run test:watch
```

### End-to-End Tests (Playwright)

Covers all core business user journeys:

```bash
npm run test:e2e
```

**E2E Test Specifications:**
- `e2e/workspaces.spec.ts`: Create workspace & Owner role, invite member, role change, member removal.
- `e2e/projects.spec.ts` & `e2e/projects-members.spec.ts`: Create, update, archive, restore, delete projects, project member management.
- `e2e/tasks.spec.ts`: Create task, Kanban drag-and-drop, field editing, deletion permissions.
- `e2e/comments-activities.spec.ts`: Commenting permissions, author controls, immutable timeline.
- `e2e/search-filters.spec.ts`: Multi-criteria search and filters, URL synchronization.
- `e2e/labels.spec.ts`: Label CRUD, color picker, task label chips.
- `e2e/statuses.spec.ts`: Custom Kanban status columns, ordering.
- `e2e/sprints.spec.ts`: Sprint CRUD, backlog views, task assignment.
- `e2e/custom-fields.spec.ts`: Dynamic custom fields (Text/Number/Date/Select/Checkbox).
- `e2e/attachments.spec.ts`: File upload & download, authenticated streaming.
- `e2e/notifications.spec.ts`: Notification bell, unread counter, dropdown.
- `e2e/automation.spec.ts`: WHEN → THEN automation rules, execution audit logs.
- `e2e/public-api.spec.ts`: REST API key auth, workspaces/tasks endpoints.
- `e2e/account.spec.ts`: Profile update, password change, session management.
- `e2e/live.spec.ts`: SSE real-time sync, board update events.
- `e2e/analytics.spec.ts`: Velocity, workload, status distribution.
- `e2e/command-palette.spec.ts`: ⌘K navigation palette.
- `e2e/markdown.spec.ts`: Markdown rendering, XSS protection, @mention autocomplete.
- `e2e/webhooks.spec.ts`: Outbound webhooks (Slack/Discord/JSON), HMAC signature, ping test, delivery logs.
- `e2e/subtasks.spec.ts`: Hierarchical subtasks (1-level depth guard, progress meter, inline quick-create, completion toggle).
- `e2e/theme.spec.ts` & `e2e/a11y.spec.ts` & `e2e/visual-regression.spec.ts`: Theme switching, accessibility audits, visual snapshots.

---

## 📂 Project Structure

```
mini-jira/
├── app/                              # Next.js 16 App Router
│   ├── auth/                         # Unified auth page (login / register)
│   ├── account/                      # Account settings & theme appearance
│   ├── dashboard/                    # Redirect → /workspaces
│   ├── api/
│   │   ├── auth/[...all]/            # Better Auth API route handler
│   │   ├── attachments/[attachmentId]/ # Authenticated file streaming
│   │   ├── live/stream/              # SSE real-time event stream
│   │   └── v1/                       # Public REST API (Bearer / API key)
│   └── workspaces/                   # Workspace dashboard & switcher
│       └── [workspaceId]/            # Workspace context
│           ├── analytics/            # Velocity, workload, overdue metrics
│           ├── members/              # Member management & roles
│           ├── projects/             # Projects list & creation
│           │   └── [projectId]/      # Kanban board & task details
│           │       └── settings/     # Statuses, sprints, custom fields, rules, webhooks
│           └── settings/             # Workspace settings, API keys, delete
├── e2e/                              # Playwright E2E test suites (26+)
├── prisma/
│   ├── migrations/                   # PostgreSQL schema migrations
│   ├── schema.prisma                 # Prisma schema definition
│   └── seed.ts                       # Database seeding script
└── src/
    ├── generated/prisma/             # Prisma Client output
    ├── lib/                          # Shared: prisma, auth, markdown, cn
    ├── components/                   # Shared UI: modals, drawers, theme, ⌘K, markdown editor
    └── features/                     # Domain modules (Vertical Slice)
        ├── account/                  # Profile, password, sessions
        ├── activities/               # Immutable audit timeline
        ├── analytics/                # Workspace metrics & charts
        ├── api-keys/                 # REST API key generation
        ├── attachments/              # File uploads & storage
        ├── auth/                     # Auth forms & password policy
        ├── authorization/            # RBAC permission matrix & Actor guards
        ├── automation/               # Rules engine (WHEN → THEN)
        ├── comments/                 # Task comments & moderation
        ├── custom-fields/            # Dynamic fields (Text/Number/Date/Select/Checkbox)
        ├── labels/                   # Project labels & task tags
        ├── live/                     # SSE real-time hub & events
        ├── notifications/            # In-app notifications & bell
        ├── projects/                 # Project lifecycle & members
        ├── sprints/                  # Scrum sprints & backlog
        ├── statuses/                 # Custom Kanban columns
        ├── tasks/                    # Kanban board & fractional positioning
        ├── webhooks/                 # Outbound webhooks (Slack/Discord/JSON, HMAC-SHA256, logs)
        └── workspaces/               # Switcher, members, invitations
```

---

## 📜 SRS Traceability Matrix (v1.1)

| Requirement ID | Description | Implementation Status | Test Coverage |
| :--- | :--- | :---: | :--- |
| **FR-001..FR-005** | Authentication, password policy, session protection | ✅ | Unit + Playwright (`/auth`) |
| **FR-010..FR-014** | Workspace CRUD, switcher, cascade hard-delete | ✅ | `rules.test.ts`, `workspaces.spec.ts` |
| **FR-020..FR-023** | Member invite, role management, removal rules | ✅ | `workspace-service.test.ts`, `workspaces.spec.ts` |
| **FR-030..FR-036** | Project lifecycle, archive/restore, Owner-only delete | ✅ | `project-service.test.ts`, `projects.spec.ts` |
| **FR-040..FR-054** | Task CRUD, Kanban board, decimal positioning | ✅ | `task-service.test.ts`, `position.test.ts`, `tasks.spec.ts` |
| **FR-060..FR-063** | Task comments, author/moderator edit & delete rules | ✅ | `comment-service.test.ts`, `comments-activities.spec.ts` |
| **FR-070..FR-072** | Immutable activity logging, timeline view | ✅ | `activity-service.test.ts`, `comments-activities.spec.ts` |
| **FR-080..FR-085** | Substring title search, status/priority/assignee filters | ✅ | `search-filters.spec.ts` |
| **BR-001..BR-017** | Business rules (single Owner, creator/assignee task rules) | ✅ | `permissions.test.ts`, `rules.test.ts` |
| **NFR-001..NFR-007**| Security, performance, indexing, error redaction | ✅ | Architecture & schema indexes |
| **Milestone 22** | UI/UX Elevation (Theme Switcher, Visual Colors, Slide-over Drawer, ⌘K) | ✅ | `e2e/theme.spec.ts`, `e2e/a11y.spec.ts`, `e2e/visual-regression.spec.ts` |
| **Milestone 23** | Modern Popup/Modal Dialogs (Create Task, Manage Labels, Invite Member, Create Project, Sprints, Statuses, Custom Fields, Automation, API Keys, Destructive Actions) | ✅ | `e2e/tasks.spec.ts`, `e2e/labels.spec.ts`, `e2e/projects.spec.ts`, `e2e/statuses.spec.ts`, `e2e/sprints.spec.ts`, `e2e/custom-fields.spec.ts`, `e2e/automation.spec.ts`, `e2e/public-api.spec.ts` |
| **Milestone 24** | Rich Text/Markdown Editor (tokenizer zero-dep, toolbar, preview, @mention) | ✅ | `src/lib/markdown.test.ts` (30 unit) + `e2e/markdown.spec.ts` (E2E) |
| **Backlog P3** | Webhooks & External Integrations (Slack/Discord/JSON, HMAC-SHA256, Delivery Logs) | ✅ | `formatters.test.ts`, `webhook-dispatcher.test.ts`, `webhook-service.test.ts` + `e2e/webhooks.spec.ts` |
| **Backlog P4** | Sub-tasks / Hierarchical Issues (Parent-child relation, max depth 1 guard, progress bar & Kanban card badge) | ✅ | `task-service.test.ts` (unit) + `e2e/subtasks.spec.ts` (E2E) |

---

## 🗺️ Roadmap & Changelog

- Detailed technical roadmap, architecture conventions, and future backlog: [ROADMAP.md](file:///D:/NextJsProjects/mini-jira/ROADMAP.md)
- Release notes and chronological version history: [CHANGELOG.md](file:///D:/NextJsProjects/mini-jira/CHANGELOG.md)

---

## 📄 License

Private project for demonstration and portfolio purposes.
