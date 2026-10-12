# Tính năng đóng băng (frozen features)

Có những tính năng code xong nhưng **chủ đích tắt** vì thiếu điều kiện vận hành
(domain gửi mail, storage R2). File này là chỗ tra cứu duy nhất: tắt cái gì,
bật lại thế nào, test nào bị ảnh hưởng.

Quy ước chung: đóng băng = ẩn UI + skip hook, KHÔNG xóa code. Mở băng = thêm
env trên Vercel + Redeploy (không cần sửa code, không cần migrate).

---

## 1. Email (`EMAIL_ENABLED`, `REQUIRE_EMAIL_VERIFICATION`)

| Trạng thái | Điều kiện |
|---|---|
| Tắt (hiện tại) | Thiếu cả 2 cờ trên Vercel |
| Bật | Verify domain Resend xong → thêm cả 2 cờ =`1` → Redeploy |

Khi tắt:
- Link "Forgot your password?" / "Verify your email" biến khỏi trang login.
- Ba trang `/auth/verify-code`, `/auth/forgot-password`, `/auth/reset-password`
  đá về `/auth`. Đăng ký xong cũng đá về dashboard qua đó.
- Hook gửi (verify link, OTP, reset, added-to-workspace) skip. Sender giữ
  no-op khi thiếu key (lớp phòng thủ thứ hai).
- Gate `requireEmailVerification` tự tắt theo (chống lockout sai cấu hình).

Khi bật: OTP 6 số (5 phút, 3 lần/mã), gate chặn login chưa verify.

### Test liên quan
- `src/lib/email.test.ts`: luôn xanh (dùng key truyền tay, không đọc env).
- `e2e/email-otp.spec.ts`: CHỈ chạy khi server bật cả 2 cờ và KHÔNG `E2E=1`.
  Đặt `E2E_EMAIL=0` để skip khi chạy suite trên server đóng băng.
- `e2e/account.spec.ts` (test reset-request): xanh cả 2 chế độ (endpoint luôn 200).

## 2. Attachments (`ATTACHMENTS_ENABLED`, driver)

| Trạng thái | Điều kiện |
|---|---|
| Tắt (hiện tại, prod) | Driver noop = prod build không R2 vars, không `ATTACHMENT_UPLOAD_DIR` |
| Bật (hiện tại, dev) | Driver local (dev) hoặc r2 — tự động, không cần cờ |
| Ép tay | `ATTACHMENTS_ENABLED=1/0` (1 thắng noop, 0 thắng tất cả) |

Khi tắt: tab Attachments biến khỏi drawer task (kèm panel fallback). API giữ
nguyên (noop trả lỗi thân thiện khi upload, 404 khi download).

Mở băng trên Vercel: chỉ có đường R2 (local disk read-only) → thêm 4 biến
`R2_*` → Redeploy. Không cần migrate, không cần đổi code.

### Test liên quan
- `e2e/attachments.spec.ts`: CHỈ chạy khi có backend thật (dev server, hoặc
  prod có R2 / `ATTACHMENT_UPLOAD_DIR`). Prod build trần fail là đúng.
  Đặt `E2E_STORAGE=0` để skip khi chạy suite trên server đóng băng.

## 3. Ma trận chạy E2E (chromium)

| Spec | Dev | Prod trần (hiện tại) | Prod đủ điều kiện |
|---|---|---|---|
| toàn bộ trừ 2 dưới | ✅ (flaky theo tải) | ✅ ground truth | ✅ |
| `email-otp` | ✅ nếu bật 2 cờ | ⏭️ skip (`E2E_EMAIL=0`) | ✅ (`E2E_EMAIL=1`, không `E2E=1`) |
| `attachments` | ✅ (local disk) | ⏭️ skip (`E2E_STORAGE=0`) | ✅ (có R2) |
