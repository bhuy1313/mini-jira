# Handoff — Phiên 10/10/2026 (Phase 0 → Phase 5 + nợ kỹ thuật + #3 Email)

Repo: `D:\NextJsProjects\mini-jira` (Windows, Next 16.3.2, React 19, Tailwind v4).
DB local: `mini_jira` @ localhost:5432. Cây sạch, port 3000 trống, server tắt.
Unit: **479/479** (38 files). tsc/eslint sạch.

**TRẠNG THÁI: handoff 09/10 xử lý xong 7/8 code + nợ kỹ thuật; còn #8 R2 (chờ credentials).**

---

## 1. Commits phiên này (12, trên `main`, sau `f1fbbb0`)

| Commit | Nội dung |
|---|---|
| `c90ca0f` | Lib mới `mutation-busy.ts` + `action-retry.ts` |
| `6f047c2` | Pending-id + mutation guard qua 14 file (kanban, drawer, comment, subtask, attachment, worklog, sprint, label, drawer `modal={false}`, toast API key) |
| `9fa1b26` | Infra E2E (poll 8s, pool pg 25, bypass 429 `E2E=1`, orphan-member filter, custom-field bỏ revalidate) + handoff 09/10 |
| `83a9144` | Phase 2: label temp-id + `mounted` guard theme (qua `useSyncExternalStore`, né rule `set-state-in-effect`) |
| `0ea1a4f` | Phase 3: layout Suspense (`_slots.tsx`, gate còn `requireActor`) |
| `e153825` | Phase 4: baseline visual-regression (`task-drawer-chromium-win32.png`; `auth-landing` có từ release) |
| `4e5da88` | Phase 5.1: pin `TZ=Asia/Ho_Chi_Minh` (.env local + `.env.example`) |
| `9cf0f93` | Phase 5.4: webhook retry 3 lần, backoff mũ, chỉ 429/5xx/lỗi mạng, không queue |
| `91b78c6` | Phase 5.6: board cap 500 + banner truncated (`BOARD_TASK_LIMIT`, `applyBoardLimit`) |
| `d046afd` | Phase 5.5: notification opt-out sparse + decorator chặn 1 điểm + tab Account + migration |
| `49d6f9e` | Phase 5.2: task key `PRJ-123` (counter nguyên tử trong tx, key project bất biến, badge card/drawer/API) + migration |
| `bcc409f` | Nợ batch 1: force-track `.env.example` + search theo task key (FTS OR ILIKE) |
| `7e8130d` | Nợ batch 2: re-baseline drift + drop `boardRevision` + `shadowDatabaseUrl` |
| `7968de8` | Phase 5.3: email Resend + verify/reset/added-mail + UI quên mật khẩu |

## 2. Quyết định đã chốt (ghi để khỏi hỏi lại)

- Phase 5 thứ tự: 7 → 4 → 6 → 5 → 2 → 3 → 8. #7 SSE = **single-instance**, không code.
- Timezone: giữ UTC + hiển thị browser, pin server `Asia/Ho_Chi_Minh`. Workspace-timezone setting để dành.
- Webhook: retry inline, **không queue** (single-instance không cần broker).
- Board: cap 500 + banner, **không virtualize** (chưa có số liệu cần).
- Prefs: sparse opt-out, default-on, chặn ở publisher.
- Task key: prefix 2–10 A-Z0-9 bất biến, dedupe `-N`, task key `KEY-N` bất biến.
- Email provider: **Resend** (fetch thuần, không SDK), Sending access đủ.
- `requireEmailVerification` **KHÔNG bật** (khóa user/E2E hiện tại) — quyết định riêng sau.
- Invite-link cho email chưa đăng ký: flow mới riêng, chưa làm (mới chỉ mail "added" cho user đã có).
- Snapshot E2E khóa `chromium-win32` — CI Linux phải regenerate.

## 3. Phát hiện vận hành (đọc trước khi đụng tiếp)

- **Migration drift đã fix xong:** DB local từng lệch history → `migrate dev` đòi reset. Đã re-baseline (`..._rebaseline_drift` = đúng output `migrate diff` đã review) + drop cột mồ côi `boardRevision` + `shadowDatabaseUrl` (DB `mini_jira_shadow` đã tạo). Chứng minh: `migrate status` up-to-date, `migrate diff` empty, DB trắng deploy 19/19 cho schema **đồng nhất 100%** (so từng bảng/cột/index/FK/enum). DB verify đã xóa.
- **`.env*` toàn ignore:** `.env.example` đã force-track (chỉ placeholder). `.env`/`.env.local-db`/`.env.neon-db` local chứa secret thật (DB pass, Neon URL, RESEND_API_KEY) — không bao giờ force-add.
- **RESEND_API_KEY thật đang nằm trong `.env` local** (key thứ ba, Sending access). 2 key đầu user paste đã lộ trong chat — nhắc user xóa trong dashboard.
- **Resend test mode** (chưa verify domain): chỉ gửi được cho email chủ tài khoản (`bhuy1313@gmail.com`). Key Sending-access **không gọi được `GET /domains`** → 401 ở endpoint đó là đúng luật, đừng kết luận key hỏng (đã kết luận vội 1 lần).
- **Verify token là JWT stateless** (không ghi DB) — đừng tìm row `verification` cho verify mail. Reset token mới ghi DB, **trói userId, dùng 1 lần, hạn 1h**.
- **Link mail trỏ `localhost:3000`** (từ `BETTER_AUTH_URL`): chỉ bấm được trên đúng máy + khi server chạy. User đã đi full luồng signup→verify→login→reset→login-pass-mới xanh.
- E2E cần header `Origin` khi POST API trực tiếp (không thì 403 CSRF) — xem `registerUser` trong `e2e/helpers.ts`.
- PowerShell 5.1: không `&&`/`head`/`grep`; npm/npx phải qua `cmd /c "npx.cmd ..."`; script node dùng đường dẫn tuyệt đối tới `node_modules/pg`.
- Quy tắc user đặt: process nào quá 5 phút không xong thì tự kill + báo nguyên nhân. Phiên này không process nào dính.

## 4. Còn lại

1. **#8 R2 (duy nhất chặn):** driver code xong, cần 4 env thật (`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`) → smoke upload/download/delete. Cách đưa đã chứng minh với Resend (paste chat → `.env` local → test khói).
2. Việc để dành (đã ghi trong commit message, không urgent): virtualize board, workspace-timezone, `requireEmailVerification`, invite-link token, verify domain Resend lúc deploy, regenerate snapshot khi có CI Linux.
3. 2 ảnh `Screenshot 2026-10-10 112740/113033.png` user thả vào repo đang untracked — xóa khi dọn.

## 5. Lệnh hay dùng
```powershell
cmd /c "npx.cmd tsc --noEmit"
cmd /c "npx.cmd vitest run"
cmd /c "npx.cmd eslint ."
cmd /c "npm.cmd run build"
$env:E2E = "1"; Start-Process -FilePath "cmd.exe" -ArgumentList "/c", "npx.cmd next start -p 3000" -WorkingDirectory "D:\NextJsProjects\mini-jira"
cmd /c "npx.cmd playwright test e2e/<spec>.spec.ts --project=chromium"
cmd /c "npx.cmd prisma migrate status"
Get-NetTCPConnection -LocalPort 3000 -State Listen  # kiểm tra server
```

## 6. Bổ sung sau giờ (cùng ngày, sau khi viết handoff)

- **`d396972` TZ-independent timesheet/burndown:** Vercel cấm tên `TZ` (reserved Lambda) nên pin env là đường cụt. `src/lib/timezone.ts` mới (Intl, `APP_TIMEZONE` default Asia/Ho_Chi_Minh); timesheet + burndown + report action + fixture test đổi sang instant tường minh. Unit xanh dưới 4 TZ server (+07/UTC/+14/New York, lòi 2 bug burndown thật), E2E prod `TZ=UTC` xanh. Vercel không cần thêm gì cho mục này.
- **Neon:** đã migrate tay (3 migration mới + `resolve --applied` full 18, status up to date), FTS trigger/GIN có sẵn. `.env` active đã switch sang Neon (`db:use-neon`); đã vá RESEND_API_KEY vào cả 2 file switch trước khi đổi. Lưu ý pass local `.env` (123456) khác `.env.local-db` (postgres).
- **#3 Email verify end-to-end với inbox thật** (`bhuy1313@gmail.com`): signup→verify→login→reset→login-pass-mới xanh hết. Kinh nghiệm: link mail trỏ localhost (chỉ bấm được cùng máy + server mở); reset token trói userId dùng 1 lần hạn 1h (bấm mail cũ sau khi xóa/tạo lại user → USER_NOT_FOUND đúng luật); verify token là JWT stateless (đừng tìm row DB); key Sending-access gọi `GET /domains` luôn 401 (đừng kết luận key hỏng); Resend test mode chỉ gửi được cho email chủ tài khoản.
- Vercel env hiện có 3 biến cũ; cần thêm `RESEND_API_KEY`, `EMAIL_FROM`, rồi Redeploy. Không thêm `E2E=1`, `BETTER_AUTH_URL` phải là domain prod.
- 3 ảnh `Screenshot 2026-10-10 *.png` của user nằm untracked trong repo — chưa commit.
