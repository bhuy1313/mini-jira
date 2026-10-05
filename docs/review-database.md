# Biên bản rà soát — Database Schema Mini Jira

- Ngày: 01/09/2026
- Phạm vi: Rà soát thiết kế database nghiệp vụ của Mốc 1 dựa trên hai tài liệu đánh giá độc lập.
- Tài liệu tham khảo:
  - `docs/mini_jira_database_evaluation.txt` (đánh giá chi tiết, điểm 8/10)
  - `docs/danh-gia-database.txt` (đánh giá tổng quan theo góc nhìn task manager)

---

## 1. Mục đích

Xác nhận các điểm mạnh, phát hiện vấn đề cần xử lý ngay, và chốt các quyết định thiết kế từ kết quả rà soát — đặc biệt về chính sách xoá dữ liệu (cascade) và ràng buộc toàn vẹn dữ liệu (data integrity).

## 2. Tóm tắt kết luận hai tài liệu

| Tiêu chí | mini_jira_database_evaluation | danh-gia-database |
|---|---|---|
| Điểm tổng thể | 8/10 (MVP) | Đủ dùng cho MVP |
| Normalization | 5/5 | Tốt |
| Relationships | 5/5 | Tốt |
| RBAC foundation | 5/5 | Tốt (workspace_member) |
| Task modeling | 5/5 | Tốt (creator/assignee tách) |
| Audit/history | 5/5 | Tốt (activity riêng) |
| Kanban ordering | 5/5 | Tốt (Decimal(40,20)) |
| Data integrity | 4/5 | Cần unique constraint |
| Delete strategy | 3/5 | Cần soft-delete/xem cascade |
| Production readiness | 3.5/5 | — |

Cả hai đều đánh giá cao: workspace_member với role, tách creator/assignee, activity log immutable, fractional indexing (`task.position`).

## 3. Các vấn đề đã được trạng thái hoá

### 3.1. Đã xử lý từ trước (schema hiện tại đã đúng)
- **Unique `(userId, workspaceId)`** trên `workspace_member` — đảm bảo membership không trùng (BR-002). *(`danh-gia-database` #1)*
- **status/priority/role/type dùng enum thật** (TaskStatus, Priority, Role, ActivityType) thay vì string — tránh giá trị rác. *(`danh-gia-database` #2)*
- **Index đầy đủ** cho các cột hay filter/join: `task.projectId`, `assigneeId`, `status`, `workspace_member.workspaceId` (và `workspaceId, role`, `projectId, status, position`, ...). *(`danh-gia-database` #8)*

### 3.2. Đã chốt xử lý trong đợt rà soát này — chính sách xoá User
Vấn đề *(`mini_jira_database_evaluation` §2.3 — ưu tiên cao nhất)*: trước đây `User -> Task (creator/assignee)` dùng `Cascade`, nghĩa là xoá tài khoản có thể kéo theo xoá hàng loạt task → comment → activity, làm mất dữ liệu công việc.

**Quyết định:** không cascade dữ liệu nghiệp vụ theo User.

| Tham chiếu | onDelete | Lý do |
|---|---|---|
| `Task.creatorId` | **Restrict** | Bảo vệ task — chặn xoá user còn tạo task |
| `Task.assigneeId` (nullable) | **SetNull** | Chỉ "nhả" assignee khi user bị xoá |
| `Comment.authorId` | **Restrict** | Bảo toàn lịch sử comment |
| `Activity.actorId` | **Restrict** | Bảo toàn audit log |
| `WorkspaceMember.userId` | **Cascade** | Membership thuần phụ thuộc user |

MPV chưa có flow xoá tài khoản, nên `Restrict` không gây vướng trong thực tế.

### 3.3. Các vấn đề thuộc lớp service (không phải DB constraint) — giữ nguyên như thiết kế
- **Đúng một Owner/workspace** (BR-001) — kiểm tra ở service khi tạo/đổi role/xoá Owner. *(eval §2.1, cả 2 file)*
- **Assignee là member cùng workspace** (BR-007) — service validate; FKs chỉ đảm bảo User tồn tại. *(eval §2.2)*

## 4. Các đề xuất KHÔNG làm trong Mốc 1 (đã cân nhắc, để sau)

| Đề xuất | Lý do không làm ngay |
|---|---|
| Soft-delete `Comment.deletedAt` | Không bắt buộc cho MVP; SRS không yêu cầu. *(eval §2.5)* |
| Soft-delete/archive `Task` | SRS yêu cầu hard delete task khi xoá (BR-014). *(danh-gia #3)* |
| `project_member` (quyền cấp project) | MVP không có project riêng tư (BR-004). *(cả 2 file)* |
| Mở rộng activity events | SRS Mốc 1 chưa yêu cầu, đủ cho Mốc 1. *(eval §2.6)* |
| `oldValue`/`newValue` kiểu JSON/nhiều cột | Giữ string đơn giản, phù hợp audit log MVP. *(eval §2.7)* |
| `account` issuer/providerId, `unique(providerId, accountId)` | Bảng Better Auth quản lý — không tự sửa. *(danh-gia #5, #6)* |

## 5. Kết luận

Schema database đạt **8/10 cho MVP** theo đánh giá, đã được củng cố về chính sách xoá dữ liệu (3.2). Toàn bộ thay đổi đã áp dụng qua migration `20260901020516_adjust_user_delete_cascade` và được đồng bộ trong `docs/03-Database-Design.md` + `docs/database-erd.md`.

Các business rule phức tạp hơn (Owner duy nhất, assignee cùng workspace) sẽ được thực thi ở service layer và phủ test ở phần còn lại của Mốc 1.
