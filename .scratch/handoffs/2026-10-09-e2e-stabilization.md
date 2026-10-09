# Handoff — Ổn định E2E + thay lib P0/P1 (09/10/2026)

Repo: `D:\NextJsProjects\mini-jira` (Windows, Next 16.3.2, React 19, Tailwind v4).
DB local: `mini_jira` @ localhost:5432. Login test: `owner@demo.com` / `Password123!`.

**TRẠNG THÁI: unit + lint xanh; E2E camis trên dev, xanh gần hết trên prod build.
Chưa commit:** 19 file M + `src/lib/action-retry.ts`, `src/lib/mutation-busy.ts` mới
(xem `git status`). Prod server đã tắt, port 3000 trống.

---

## 1. Đã commit (user tự commit)

| Commit | Nội dung |
|---|---|
| `de0d3cb` | P0/P1 thay lib + cứng kanban |
| `a2e75d2` | Registry temp-id (`pending-task-ids.ts`) |
| `3a3dae4` | Batch modal resets + H1 test + metadata + cleanup FK |
| `f1fbbb0` | Metadata pages + subtask guards |

### P0 — lib thay tự làm (xong, verify)
- `next-themes` thay `theme-provider.tsx` 104 dòng (giữ API `useTheme`, cùng
  `storageKey`, E2E theme pass). Chú ý: SSR render `system`, client resolve
  theme thật → có hydration-mismatch warning trong log (vô hại, axe vẫn pass).
- `@radix-ui/react-dialog` bọc `Modal`/`Drawer` (giữ nguyên props, 19 chỗ gọi
  không sửa). **Drawer dùng `modal={false}`** — Radix modal che nền bằng
  `aria-hidden`, làm sprints.spec fail (assert board khi drawer mở).
  Center Modal giữ `modal={true}`.
- `sonner` `<Toaster/>` toàn cục + toast ở api-keys flow. Bẫy: toast chứa tên
  key làm public-api.spec strict-violation → toast hiện tại KHÔNG chứa tên key.
- `pino` `lib/logger.ts`, 12 `console.error` → `logger.error({err})`.
- Không còn `console.error` trong `src/` (không tính test).

### P1 (xong, verify)
- `cmdk` viết lại palette: fuzzy filter, `Command.Group`, leader-key `g w/a/p/m/v/s`
  thật (trước là display-only). Giữ selector E2E (dialog label, placeholder).
- `@conform-to/react` + `@conform-to/zod/v4`: `workspace-schema.ts` dùng chung,
  2 form workspace có field-level errors (client onBlur + server `fieldErrors`).
  21 chỗ `issues[0]` còn lại giữ nguyên (có helper `lib/validation.ts`).
- `date-fns` `lib/dates.ts`, migrate 16 chỗ `toLocale*`. Đổi shape hiển thị:
  `10/8/2026` → `Oct 8, 2026`, burndown `Oct 02` → `Oct 2`.

### Đợt 1 + batch lint (xong)
- kanban `isDragging/isMutating` ref → state (hết 6 lỗi `react-hooks/refs`).
- 7 lỗi `set-state-in-effect` → render-phase adjustment (comment-list,
  label-manager, drawer labels, custom-field input, reset-on-open 3 modal).
- `log-work-modal` `Date.now()` trong render → lazy `useState`.
- `session.test.ts`: 6 test guard H1 (mock prisma/auth, mỗi case id riêng vì
  `React.cache` memo theo args).
- `metadata.title` cho 10 page (diệt `document.title` flake).
- `cleanupUsers` xóa comment/worklog/activity/attachment của user trước
  (4 FK RESTRICT còn sót).
- `listMembersWithUsers` lọc member mồ côi (chống 500 khi cleanup race với poll).

### Kết quả hiện tại
- `tsc`: 0 lỗi. vitest: **457/457** (37 files). eslint: **0 errors** / ~10 warnings.
- Dev E2E: tasks×2, comments, labels, subtasks, time-tracking, sprint-report(1 lần),
  palette, theme, a11y, markdown… xanh (flaky theo tải).

## 2. Phát hiện quan trọng nhất phiên này

**Optimistic temp-id + response mất = move/rename dùng id ma.**
Bằng chứng (diag file + browser console + DB): create POST commit DB trong
~200ms nhưng client nhận response trễ ~2s (hoặc không bao giờ) → card kẹt
`temp-…` → move/rename ăn `UnauthorizedError` đúng luật → UI rollback.
- Fix: `pending-task-ids.ts` — mọi mutation `await resolveRealTaskId` trước khi
  bắn; lookup chịu cả 2 key; map `selectedTaskId` khi swap; optimistic rename
  (`handleRenameTask`) + patch drawer (`onTaskPatch`); mở rộng sang comment,
  attachment, worklog, subtask, label-toggle.
- Nguyên nhân gốc của response mất: dev server chậm (Slow filesystem) + storm
  refresh (poll 1.5s, trailing refresh, SSE) abort lẫn nhau
  (`destination stream closed early`, `ECONNRESET`). Đã giảm: poll → 8s,
  pool pg → 25, bỏ trailing `router.refresh()` thừa sau mutation (action đã
  tự revalidate), refresh chỉ bắn khi không busy (`mutation-busy.ts`,
  retry-timeout cho set-idempotent qua `action-retry.ts`).

## 3. Phát hiện khi chạy PROD BUILD (quan trọng)

- Prod nhanh gấp 3–4x: tasks.spec **15s** (dev ~60s+), custom-fields 8.7s.
- **Bẫy 429:** rate limit chỉ bật ở production (`auth.ts`: 100 req/10s, tính cả
  `getSession` mỗi render) → suite nhanh bị chặn. Đã thêm cờ `E2E=1` để tắt
  riêng cho E2E (`src/lib/auth.ts`) — KHÔNG set ở deploy thật.
- Cách chạy: `npm run build` → `E2E=1 npx next start -p 3000` (Start-Process nền,
  port 3000) → `npx playwright test ... --project=chromium` (tự reuse server).
  **Nhớ rebuild + restart server sau mỗi lần sửa code** (stale build trap).
- Trên prod: tasks×2, custom-fields, live, notifications, sprint-report,
  sprints, palette, theme… ĐỀU XANH. Kết luận: đám đỏ còn lại trên dev là
  tải môi trường, không phải bug app.

## 4. Vấn đề còn tồn đọng

1. **Chưa commit:** 19 M + 2 file mới (kê ở đầu). Không còn file diag/tmp nào.
2. **Chưa verify trên prod:** custom-fields đỏ 6 lần trên DEV nhưng xanh 2/2 trên
   PROD (lần đầu + lần này cần chạy lại sau rebuild mới nhất — toast fix đã rebuild).
   Lần tới chạy lại custom-fields/live/notifications/sprint-report + PERF-05/06
   trên prod để chốt.
3. **visual-regression.spec.ts** chưa bao giờ chạy (cần snapshot flow riêng).
4. **Cần quyết định product:** workspace timezone (timesheet local vs UTC),
   task key `PRJ-123`, email provider, webhook retry/queue, notification prefs,
   pagination board, SSE Redis đa-instance, D3 R2 + D5 smoke (cần credentials).
5. **Layout `await` 4 queries** chặn nav — cần restructure Suspense (đợt riêng).
6. Label temp-id (create không trả id) — chưa track, không test đỏ.
7. Hydration-mismatch warning của theme-toggle trong log (vô hại, có thể bọc
   `mounted` nếu muốn sạch log).
8. `destination stream closed early` + `ECONNRESET` + pg `client.query` warning
   vẫn ồn log dev — vô hại sau các fix, hết hẳn trên CI Linux nhanh.

## 5. Lệnh hay dùng

```powershell
cmd /c "npx.cmd tsc --noEmit"
cmd /c "npx.cmd vitest run"
cmd /c "npx.cmd eslint ."
cmd /c "npm run build"
$env:E2E = "1"; Start-Process -FilePath "cmd.exe" -ArgumentList "/c", "npx.cmd next start -p 3000" -WorkingDirectory "D:\NextJsProjects\mini-jira"
cmd /c "npx.cmd playwright test e2e/tasks.spec.ts --project=chromium"
Get-NetTCPConnection -LocalPort 3000 -State Listen  # kiểm tra server
```

Lưu ý PowerShell 5.1: `&&`/`head`/`tail` không dùng được; `cmd /c` nuốt quote
lồng nhau (dùng file message + `git commit -F` khi commit).
