# Database ERD — Mini Jira

Sơ đồ quan hệ sinh từ `prisma/schema.prisma` (Mốc 1). Mở file này trong VS Code (cài extension *Markdown Preview Mermaid Support*) hoặc xem trên GitHub để render sơ đồ.

> Ghi chú: `user`, `session`, `account`, `verification` là bảng auth của Better Auth, giữ nguyên. Các bảng còn lại là nghiệp vụ thêm ở Mốc 1.

```mermaid
erDiagram
    user ||--o{ session : "has"
    user ||--o{ account : "has"
    user ||--o{ verification : "has"

    user ||--o{ workspace_member : "membership"
    workspace ||--o{ workspace_member : "members"
    workspace ||--o{ project : "contains"

    project ||--o{ task : "has"
    user ||--o{ task : "creator"
    user ||--o{ task : "assignee"
    task ||--o{ comment : "has"
    user ||--o{ comment : "author"
    task ||--o{ activity : "has"
    user ||--o{ activity : "actor"

    user {
        string id PK
        string name
        string email UK
        boolean emailVerified
        string image "nullable"
        datetime createdAt
        datetime updatedAt
    }

    session {
        string id PK
        datetime expiresAt
        string token UK
        datetime createdAt
        datetime updatedAt
        string ipAddress "nullable"
        string userAgent "nullable"
        string userId FK
    }

    account {
        string id PK
        string issuer
        string accountId
        string providerId
        string userId FK
        string accessToken "nullable"
        string refreshToken "nullable"
        string idToken "nullable"
        datetime accessTokenExpiresAt "nullable"
        datetime refreshTokenExpiresAt "nullable"
        string scope "nullable"
        string password "nullable"
        datetime createdAt
        datetime updatedAt
    }

    verification {
        string id PK
        string identifier
        string value
        datetime expiresAt
        datetime createdAt
        datetime updatedAt
    }

    workspace {
        string id PK
        string name
        string description "nullable"
        datetime createdAt
        datetime updatedAt
    }

    workspace_member {
        string id PK
        Role role "Owner|Admin|Member"
        string userId FK
        string workspaceId FK
        datetime createdAt
        datetime updatedAt
    }

    project {
        string id PK
        string name
        string description "nullable"
        datetime archivedAt "nullable"
        string workspaceId FK
        datetime createdAt
        datetime updatedAt
    }

    task {
        string id PK
        string title
        string description "nullable"
        TaskStatus status "Todo|InProgress|Done"
        Priority priority "Low|Medium|High|Urgent"
        datetime dueDate "nullable"
        decimal position "Decimal(40,20)"
        string projectId FK
        string creatorId FK
        string assigneeId FK "nullable"
        datetime createdAt
        datetime updatedAt
    }

    comment {
        string id PK
        string content
        string taskId FK
        string authorId FK
        datetime createdAt
        datetime updatedAt
    }

    activity {
        string id PK
        ActivityType type "TaskCreated|TitleChanged|StatusChanged|PriorityChanged|AssigneeChanged|DueDateChanged"
        string taskId FK
        string actorId FK
        string oldValue "nullable"
        string newValue "nullable"
        datetime createdAt
    }
```

## Quan hệ & cascade

| Quan hệ | Cardinality | onDelete |
|---|---|---|
| User -> WorkspaceMember | 1 : N | Cascade |
| Workspace -> WorkspaceMember | 1 : N | Cascade |
| Workspace -> Project | 1 : N | Cascade |
| Project -> Task | 1 : N | Cascade |
| User -> Task (creator) | 1 : N | Restrict |
| User -> Task (assignee) | 1 : N | SetNull |
| Task -> Comment | 1 : N | Cascade |
| User -> Comment (author) | 1 : N | Restrict |
| Task -> Activity | 1 : N | Cascade |
| User -> Activity (actor) | 1 : N | Restrict |

> Chính sách: khi xoá tài khoản, **không xoá theo** dữ liệu nghiệp vụ. Task/comment/activity được bảo toàn — `creator`/`author`/`actor` dùng Restrict (chặn xoá user còn tham chiếu), `assignee` dùng SetNull (chỉ nhả). Chỉ `WorkspaceMember` là Cascade (membership thuần phụ thuộc user).

## Ràng buộc quan trọng

- `workspace_member`: `UNIQUE (userId, workspaceId)` — membership duy nhất (BR-002).
- `task.position`: `Decimal(40,20)` — thứ tự fractional trong cột status (BR-017).
- `project.archivedAt != null` ⇔ project archived (archive mềm, BR-012); permanent delete chỉ Owner (BR-013).
- Activity **immutable** — không có update/delete (BR-015).
- "Đúng một Owner/workspace" (BR-001) và "assignee là member cùng workspace" (BR-007) được thực thi ở lớp service, không phải DB constraint.
