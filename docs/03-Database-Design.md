# Database Design — Mini Jira (Mốc 1)

> Nguồn yêu cầu: `mini-jira_doc/02-Software-Requirements-Specification-Mini-Jira-v1.1.docx` (SRS v1.1).
>
> Tài liệu này chuyển SRS đã được duyệt thành thực thể PostgreSQL + Prisma: key, quan hệ, enum, ràng buộc, index, trường archive và hành vi cascade. Đây là bản thiết kế dữ liệu cho Mốc 1 của `docs/ROADMAP.md`.

## 1. Nguyên tắc thiết kế

- Dữ liệu nghiệp vụ độc lập với dữ liệu auth; các bảng auth (`user`, `session`, `account`, `verification`) giữ nguyên từ Better Auth.
- Tên bảng dùng snake_case qua `@@map` khớp với thư viện auth hiện tại.
- Mọi trường khóa ngoại được đặt index để phục vụ query theo workspace/project (NFR-002).
- Vòng đời xóa tuân đúng SRS:
  - Workspace: **hard delete + cascade** (BR-011, FR-013).
  - Project: archive/restore là mềm; **chỉ Owner** được **permanent delete + cascade** (BR-012, BR-013, FR-034–FR-036).
  - Task: **hard delete + cascade** comments/activities (BR-014, FR-043).
  - Comment/Activity: không có soft delete; Activity **immutable** (BR-015).
- Ràng buộc "đúng một Owner mỗi workspace" (BR-001) và "assignee là member cùng workspace" (BR-007) thuộc lớp service/application vì Prisma không biểu diễn được partial unique/index liên bảng; schema chỉ đảm bảo ràng buộc structural, phần còn lại do permission/business service thực thi.

## 2. Sơ đồ quan hệ

```
User 1──* WorkspaceMember *──1 Workspace
                    ^
                    | role: Owner/Admin/Member

Workspace 1──* Project 1──* Task
                              │
                              ├──* Comment
                              └──* Activity
Task *──1 User (creatorId)
Task *──1 User (assigneeId, nullable)
```

- `User` — tài khoản đăng nhập (bảng auth có sẵn, mở rộng relation phản hồi).
- `Workspace` — không gian cộng tác.
- `WorkspaceMember` — bảng nối `(userId, workspaceId)` mang role.
- `Project` — thuộc workspace, có trạng thái archive.
- `Task` — thuộc project, ghi creator/assignee/status/priority/due date/position.
- `Comment` — thuộc task, ghi author.
- `Activity` — thuộc task, ghi actor + loại sự kiện, immutable.

## 3. Enum

### Role (WorkspaceMember.role)
Giá trị: `Owner`, `Admin`, `Member`. (SRS §2.1–§2.3)

### TaskStatus (Task.status)
Giá trị: `Todo`, `InProgress`, `Done`. (FR-045)

### Priority (Task.priority)
Giá trị: `Low`, `Medium`, `High`, `Urgent`. (FR-046)

### ActivityType (Activity.type)
Các sự kiện nghiệp vụ được ghi activity (FR-070); loại trừ description và comment (FR-071):
- `TaskCreated`
- `TitleChanged`
- `StatusChanged`
- `PriorityChanged`
- `AssigneeChanged`
- `DueDateChanged`

## 4. Chi tiết bảng

### 4.1 Workspace
| Trường | Kiểu | Ràng buộc | Ghi chú |
|---|---|---|---|
| `id` | String | PK | uuid |
| `name` | String | NOT NULL | FR-010 name required |
| `description` | String? | | FR-012 |
| `createdAt` | DateTime | NOT NULL `@default(now())` | |
| `updatedAt` | DateTime | NOT NULL `@updatedAt` | |

Quan hệ: `members` (WorkspaceMember[]), `projects` (Project[]).

Index: PK `id`.

### 4.2 WorkspaceMember
| Trường | Kiểu | Ràng buộc | Ghi chú |
|---|---|---|---|
| `id` | String | PK | uuid |
| `role` | Role | NOT NULL | enum Owner/Admin/Member |
| `userId` | String | NOT NULL, FK -> User | cascade khi user bị xóa |
| `workspaceId` | String | NOT NULL, FK -> Workspace | cascade khi workspace xóa |
| `createdAt` | DateTime | NOT NULL `@default(now())` | |
| `updatedAt` | DateTime | NOT NULL `@updatedAt` | |

Ràng buộc:
- `@@unique([userId, workspaceId])` — **membership duy nhất** (BR-002, FR-020 "duplicate membership forbidden").
- `@@index([workspaceId])`, `@@index([userId])` — truy vấn danh sách member theo workspace và workspace theo user (FR-011, FR-021, NFR-002).

Ghi chú: "đúng một Owner" (BR-001) không phải unique constraint; đảm bảo ở service khi **đổi role** chỉ Owner được phép và không xoá role Owner cuối cùng (FR-022, FR-023).

### 4.3 Project
| Trường | Kiểu | Ràng buộc | Ghi chú |
|---|---|---|---|
| `id` | String | PK | uuid |
| `name` | String | NOT NULL | FR-030 name required |
| `description` | String? | | FR-030 |
| `archivedAt` | DateTime? | nullable | null = active; không null = archived (BR-012, FR-034, FR-035) |
| `workspaceId` | String | NOT NULL, FK -> Workspace, **onDelete Cascade** | BR-004, BR-011 |
| `createdAt` | DateTime | NOT NULL `@default(now())` | |
| `updatedAt` | DateTime | NOT NULL `@updatedAt` | |

Quan hệ: `workspace`, `tasks` (Task[]).

Ràng buộc/Index:
- `@@index([workspaceId])` — danh sách project theo workspace (FR-031).
- `@@index([workspaceId, archivedAt])` — filter active/archived project nhanh.

Ghi chú: không có `ProjectMember` (BR-004, FR-031/MVP). Archive là mềm — task dữ liệu giữ nguyên (Mốc 3: "archive không làm mất task"). Permanent delete project: cascade tới task → comment/activity (BR-013, FR-036).

### 4.4 Task
| Trường | Kiểu | Ràng buộc | Ghi chú |
|---|---|---|---|
| `id` | String | PK | uuid |
| `title` | String | NOT NULL | FR-040/FR-042 |
| `description` | String? | | |
| `status` | TaskStatus | NOT NULL `@default(Todo)` | FR-045 |
| `priority` | Priority | NOT NULL `@default(Medium)` | FR-046 |
| `dueDate` | DateTime? | nullable | FR-047 |
| `position` | Decimal | NOT NULL `@db.Decimal(40, 20)` | fractional ordering (BR-017, FR-052–FR-053) |
| `projectId` | String | NOT NULL, FK -> Project, **onDelete Cascade** | BR-006, FR-040 |
| `creatorId` | String | NOT NULL, FK -> User | FR-040 "Creator is recorded" |
| `assigneeId` | String? | FK -> User, nullable | FR-044; phải là member workspace (BR-007) |
| `createdAt` | DateTime | NOT NULL `@default(now())` | |
| `updatedAt` | DateTime | NOT NULL `@updatedAt` | |

Ràng buộc/Index:
- `@@index([projectId])` — task theo project.
- `@@index([projectId, status, position])` — đọc board theo cột đã sắp thứ tự (FR-050).
- `@@index([projectId, status])` — filter status (FR-082).
- `@@index([status])`, `@@index([priority])` — filter toàn workspace (FR-082, FR-083).
- `@@index([assigneeId])` — filter assignee (FR-084).
- `@@index([dueDate])` — nếu cần sắp/overdue.
- `@@index([creatorId])` — truy vấn task do user tạo.

Ghi chú:
- `position` dùng Decimal độ chính xác cao, thứ tự trong cùng cột; insert giữa tính vị trí trung gian thay vì reindex (FR-053).
- `assigneeId` phải là member của cùng workspace — kiểm tra ở service (BR-007, FR-044); FKs chỉ đảm bảo tồn tại User.

### 4.5 Comment
| Trường | Kiểu | Ràng buộc | Ghi chú |
|---|---|---|---|
| `id` | String | PK | uuid |
| `content` | String | NOT NULL | FR-060 |
| `taskId` | String | NOT NULL, FK -> Task, **onDelete Cascade** | FR-060 |
| `authorId` | String | NOT NULL, FK -> User | FR-060 |
| `createdAt` | DateTime | NOT NULL `@default(now())` | |
| `updatedAt` | DateTime | NOT NULL `@updatedAt` | |

Ràng buộc/Index:
- `@@index([taskId])` — comment theo task (FR-061).

Ghi chú: edit/delete comment theo rule FR-062, FR-063 (auth layer). Xóa task kéo cascade comment (BR-014).

### 4.6 Activity
| Trường | Kiểu | Ràng buộc | Ghi chú |
|---|---|---|---|
| `id` | String | PK | uuid |
| `type` | ActivityType | NOT NULL | enum sự kiện |
| `taskId` | String | NOT NULL, FK -> Task, **onDelete Cascade** | FR-070 |
| `actorId` | String | NOT NULL, FK -> User | người thực hiện |
| `oldValue` | String? | nullable | giá trị cũ (nếu có) |
| `newValue` | String? | nullable | giá trị mới (nếu có) |
| `createdAt` | DateTime | NOT NULL `@default(now())` | thời điểm/thứ tự timeline |

Ràng buộc/Index:
- `@@index([taskId, createdAt])` — timeline theo thứ tự (FR-072).

Ghi chú:
- **Immutable** (BR-015): không có update/delete API/UI (FR-072).
- Không ghi activity cho description và comment create/edit/delete (FR-071).
- Ghi trong **cùng transaction** với mutation task (FR-070).

## 5. Bảng auth (giữ nguyên)

`User`, `Session`, `Account`, `Verification` — không đổi cấu trúc. Chỉ thêm relation phản hồi `memberships` trên `User` để truy vấn workspace thuộc về.

## 6. Ma trận quyền (tóm tắt cho service)

| Action | Owner | Admin | Member |
|---|---|---|---|
| View workspace / members / projects / tasks | ✅ | ✅ | ✅ |
| Update workspace | ✅ | ❌ | ❌ |
| Delete workspace | ✅ | ❌ | ❌ |
| Add member | ✅ | ✅ | ❌ |
| Change member role | ✅ | ❌ | ❌ |
| Remove member | ✅ (Admin/Member, không tự xoá) | ✅ (Member only) | ❌ |
| Create / update / archive / restore project | ✅ | ✅ | ❌ |
| Permanent delete project | ✅ | ❌ | ❌ |
| Create task | ✅ | ✅ | ✅ |
| Update any task (mọi field) | ✅ | ✅ | ❌ |
| Update own/assigned task (title/description/status) | — | — | ✅ |
| Delete task | ✅ | ✅ | ❌ |
| Assign / priority / due date | ✅ | ✅ | ❌ |
| Add / view comment | ✅ | ✅ | ✅ |
| Edit own comment | ✅ | ✅ | ✅ |
| Delete own comment | ✅ | ✅ | ✅ |
| Delete others' comment | ✅ | ✅ | ❌ |
| View activity | ✅ | ✅ | ✅ |

(SRS §2.4 — chi tiết `docs/03-Database-Design` phục vụ mở rộng permission service ở Mốc 1.)

## 7. Cascade map

| Xoá | Cascade đến | Nguồn yêu cầu |
|---|---|---|
| Workspace | WorkspaceMember, Project (→ Task → Comment, Activity) | BR-011, FR-013 |
| Project (permanent only) | Task (→ Comment, Activity) | BR-013, FR-036 |
| Task | Comment, Activity | BR-014, FR-043 |
| User | WorkspaceMember (Cascade) | — |

Ghi chú xoá User: SRS không định nghĩa flow xoá tài khoản. Để tránh xoá hàng loạt dữ liệu công việc khi tài khoản bị xoá, các tham chiếu từ domain **không** dùng `Cascade`:

- `Task.creatorId` → `onDelete: Restrict` — chặn xoá user còn tạo task, bảo vệ task.
- `Task.assigneeId` (nullable) → `onDelete: SetNull` — khi user bị xoá, chỉ "nhả" assignee.
- `Comment.authorId`, `Activity.actorId` → `onDelete: Restrict` — chặn xoá user còn để lại comment/activity, bảo toàn audit/history.

Trong MVP không có tính năng xoá user nên `Restrict` không gây vướng; đây là quyết định đã chốt theo rà soát thiết kế database.
