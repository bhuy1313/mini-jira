# Handoff — Plan cải tiến Loading Indicator (top progress bar)

Date: 2026-10-07
Repo: `D:\NextJsProjects\mini-jira` (Windows/PowerShell; Next.js 16.3.2, React 19.2.8, Tailwind v4)

**TRẠNG THÁI: Phase 1 + 2 + 3 ĐÃ XONG — verify browser + checks toàn bộ.**

---

## Quyết định đã chốt (user duyệt qua questionnaire)

- **Form:** Top progress bar (thanh 3px trên cùng, kiểu NProgress) — **đẹp hơn toast** góc dưới phải
- **Mount:** `app/layout.tsx` — toàn cục (không chỉ workspace layout)
- **Scope:** Phase 1 + 2 + 3 (indicator mới + phủ router.push programmatic + bổ sung loading.tsx)
- **CẬP NHẬT (đổi sau khi user thử):** user muốn bar **LUÔN hiện mỗi khi navigation** (kể cả nhanh / đã cache) → **bỏ SHOW_DELAY 150ms / bỏ anti-flash**. Bar hiện ngay khi click; fast nav vẫn thấy một nhịp bar ngắn rồi complete.

---

## Chẩn đoán hiện trạng cũ (cái toast bị xóa)

Cũ: `src/components/navigation-loading-indicator.tsx` (đã xóa) — mount tại `app/workspaces/[workspaceId]/layout.tsx:4,157`

1. **Timing đảo ngược**: hiện khi `usePathname()` đổi = navigation đã commit xong → phase chờ đợi (click → commit) không có feedback nào.
2. **Không có tín hiệu kết thúc**: fixed `setTimeout 6000ms` (`:15`) → treo thêm hàng giây sau khi trang đã render.
3. **Flash vô nghĩa**: nav nhanh (cached) vẫn hiện "Đang tải dữ liệu workspace...".
4. **Animation chết**: class `animate-in fade-in slide-in-from-bottom-2` cần `tw-animate-css`/`tailwindcss-animate` — **không cài** (chỉ `@import "tailwindcss"` trong `globals.css:1`) → no-op.
5. **Thiếu a11y**: không `role="status"`/`aria-live`; text cứng "workspace"; spinner SVG inline thay vì `Spinner` chung.

**Bài cảnh Next 16.3 (đã đọc docs trong `node_modules/next/dist/docs/`):**
- App Router **không có** event routeChangeStart/Complete. Tín hiệu chính thức: `useLinkStatus` (per-Link, trước history update), `loading.tsx` (tại commit), `usePathname` (tại commit).
- Chỉ **2/17 route** có `loading.tsx` (`[workspaceId]/loading.tsx`, `[projectId]/loading.tsx`) → đa số route blocks toàn bộ tới khi data xong, không có skeleton.
- Workspace layout (`app/workspaces/[workspaceId]/layout.tsx:25-30`) `force-dynamic` + `await` 4 queries → nav **vào** workspace chặn tới khi layout xong; `loading.tsx` không cứu được phase này (docs: "Navigation blocks until the layout finishes rendering").
- **Division of labor:** bar lo phase *click → commit*; `loading.tsx` lo phase *commit → nội dung*.

---

## Phase 1 — ĐẬP LÀM LẠI INDICATOR ✅ DONE

- ✅ Xóa `src/components/navigation-loading-indicator.tsx`
- ✅ Tạo `src/components/navigation-progress.tsx` (client component, không dependency mới)
- ✅ Sửa `app/layout.tsx` — mount `<NavigationProgress />` toàn cục
- ✅ Gỡ khỏi `app/workspaces/[workspaceId]/layout.tsx`

### State machine (spec đã chốt + thay đổi "luôn hiện")

```
idle
 └─ start: capture-phase click trên <a> same-origin/same-tab
    (bỏ qua modifier key, target=_blank, download, hash/mailto/tel, href == URL hiện tại)
    | popstate (back/forward) | subscribeNavigation (router.push programmatic)
       → pending — HIỆN NGAY (đã bỏ SHOW_DELAY; trước đây là 150ms chờ)
pending
 └─ end: usePathname() đổi → done
    (failsafe 10s force-done)
done
 └─ bar chạy tới 100% (250ms) → fade out (200ms) → idle
    (start lại trong lúc fade → keep bar, không nhảy lại)
```

### Chi tiết kỹ thuật

- TICK_MS=80, COMPLETE_DELAY=250, FADE_DELAY=200, FAILSAFE_MS=10000. Fake progress: `min(0.9, prev.progress + (0.9 - prev.progress) * 0.1 + 0.02)`.
- **KHÔNG dùng `useSearchParams`** (tránh CSR-bailout/Suspense ở root layout). End signal = pathname thôi.
- **UI:** `fixed top-0 inset-x-0 h-[3px] z-[60] bg-primary pointer-events-none`; visual `aria-hidden`.
- **A11y:** wrapper `role="status" aria-live="polite"` + sr-only `"Đang tải trang..."` (khi pending); bỏ text cứng "workspace".
- **Reduced-motion:** `globals.css:184-192` zeroes animation-duration → fake progress chạy bằng JS transition theo state (không dùng class `animate-in` chết).
- Timer cleanup kỹ trong effect cleanup (race khi nav liên tiếp).

### Acceptance criteria — ĐÃ VERIFY trên browser

1. ✅ Nav chậm (cold compile ~1.4s): bar hiện **ngay tại click**, giữ tới commit, complete + fade, **không còn 6s đuôi** (commit→reset ≈ 480ms).
2. ✅ Nav nhanh / đã cache (<150ms commit): bar **VẪN hiện** một nhịp ngắn rồi complete (theo yêu cầu mới — đã bỏ chống flash). Đo thực tế: /settings→/members commit 154ms, /members→/settings commit 87ms — đều có bar.
3. ✅ Route có `loading.tsx` (verify 07/10): nav cold tới /timesheet → skeleton hiện ~500ms sau commit rồi content thay; /analytics ~550ms; /projects/[id] (KanbanColumnSkeleton) ~850ms — bar complete tại commit, skeleton tiếp quản.
4. ✅ Route không `loading.tsx`: bar phủ thời gian chờ (cold /settings ~1.4s — verify Phase 1), complete đúng lúc data xong.
5. ✅ Back/forward có bar (popstate). Nhanh thì bar nhịp ngắn, chậm thì đầy đủ.
6. ✅ External/middle-click/Ctrl-click/URL trùng: không ảnh hưởng (bỏ qua trong handler).
7. ✅ Filter `router.replace`: không start bar (code không gọi startNavigation — OK).
8. ⏳ Reduced-motion: bar vẫn hiện khi pending (logic JS, chưa emulate lại).
9. ✅ Không dependency mới.

---

## Phase 2 — PHỦ NAVIGATION PROGRAMMATIC ✅ DONE

- ✅ `src/lib/navigation-pending.ts` — store nhỏ: Set listener + `startNavigation()` + `subscribeNavigation()`.
- ✅ `navigation-progress.tsx` — subscribe thêm nguồn này (ngoài click/popstate).
- ✅ `src/components/command-palette.tsx` — 6 nav item (`router.push` tới /workspaces, /account, projects, members, analytics, settings) gọi `startNavigation()`.
- ✅ `src/features/notifications/components/notification-bell.tsx` — `openNotification` gọi trước `router.push`.
- **Không đụng:** auth redirect (login-form/register-form/logout-button — đã có transition), filter `router.replace` (đã có `isPending` inline).

Verify: mở command palette → chọn "Go to Account Settings" (button, không qua `<a>`): bar hiện ngay, complete tại commit, fade; URL → /account. Đường notification-bell cùng pattern, chưa test trực tiếp (cần notification unread).

---

## Phase 3 — BỔ SUNG loading.tsx + dedupe skeleton ✅ DONE (07/10)

Đã tạo đủ 7 `loading.tsx` (pattern: root `space-y-6 animate-pulse`, token `bg-rule-strong/*`, tái dùng `PageHeaderSkeleton` mới trong `src/components/ui/skeleton.tsx`):

1. ✅ `app/workspaces/loading.tsx` — trang centered: logo M + 3 dòng workspace card
2. ✅ `app/workspaces/[workspaceId]/projects/loading.tsx` — PageHeaderSkeleton(action) + toolbar + grid 4 project card
3. ✅ `app/workspaces/[workspaceId]/members/loading.tsx` — header + search/filter + grid 6 member card
4. ✅ `app/workspaces/[workspaceId]/settings/loading.tsx` — header + 3 card (General/API Keys/Danger Zone)
5. ✅ `app/workspaces/[workspaceId]/analytics/loading.tsx` — header + 4 stat + 3 section bar-rows + 3 summary card
6. ✅ `app/workspaces/[workspaceId]/timesheet/loading.tsx` — header + 4 stat + toolbar + table rows
7. ✅ `app/account/loading.tsx` — wrapper min-h-screen + header card (banner/avatar) + 5 tab pill + panel

Bỏ qua (ít traffic/cần xác minh): `/auth`, `/dashboard`, `projects/[projectId]/settings`.

**Dedupe:** ✅ `[projectId]/loading.tsx` dùng `<KanbanColumnSkeleton />` (viết lại `KanbanColumnSkeleton` khớp board thật: column `min-h-[480px]`, header `border-b pb-2`, 3 card `h-24 bg-paper/80`).

**Verify thực tế (dev-loop, sample 25ms):** nav cold Timesheet skeleton ~500ms → content; Analytics ~550ms; project (KanbanColumnSkeleton) ~850ms, path + h1 đúng — fallback trigger thật, không assume.

**Phát hiện (ngoài scope, ghi nhận):** Next.js clear `document.title` ~400ms khi loading commit (route thiếu `export const metadata`; route có metadata chỉ ~20ms) → a11y test `document-title` flake. Fix: `e2e/a11y.spec.ts` thêm `waitForFunction(() => document.title !== "")` trước axe scan. Muốn hết hẳn: thêm `metadata.title` cho các route còn thiếu (projects/members/settings/project/[projectId]) — task riêng.

---

## BACKLOG — khảo sát "lib thay tự làm" (07/10, đã ĐÁNH GIÁ LẠI, biết vậy thôi KHI KHÁC LÀM)

Tất cả free/open-source. Đã re-evaluate với 2 facts: **repo chưa có config deploy nào** (no Dockerfile/vercel/.github → chưa cần monitor/ratelimit cấp bách) và **timesheet thiếu quyết định timezone** (week range tính theo local server `timesheet-service.ts:86-108`, DB UTC) — không phải thiếu lib.

**Làm ngay được (không phụ thuộc infra):**
1. **sonner** — repo HIỆN KHÔNG CÓ toast; feedback inline `role="alert"` rải rác ~40 chỗ. 1 lệnh cài.
2. **pino** — logging chỉ `console.error` (12 chỗ nuốt lỗi bằng `.catch(console.error)`). Free local, không tài khoản.

**Làm khi có nhu cầu thật:**
3. **Radix UI** primitives (modal/menu/popover/tooltip/select) — modal thiếu focus trap/scroll lock/portal, menu thiếu arrow-key, tooltip = native `title`. Nhưng axe test đang pass → sửa targeted (focus-trap) cũng được; Radix đáng nhất khi làm nhiều UI mới.
4. **date-fns** — chỉ để nhất quán format (21 chỗ `toLocaleString` mỗi nơi 1 kiểu) + relative time. **Không sửa được bug TZ** — việc đó cần chốt strategy (workspace TZ?) trước, tính bằng lib nào cũng được (date-fns-tz/Temporal).
5. **cmdk** — fuzzy search + list nav cho palette. Lưu ý: phím tắt "G W" display-only là THIẾU FEATURE (chưa viết handler), cmdk không giải leader-key.
6. **@conform-to/zod** — nếu muốn field-level errors; hợp với useActionState/server actions hơn react-hook-form (client-first). Hiện `safeParse` chỉ giữ `issues[0]`.
7. **recharts** — nếu analytics lớn hơn (div-bar chưa axis/tooltip/a11y; burndown SVG tự làm thì ổn).

**Làm khi deploy thật:**
8. **@sentry/nextjs** — code free, service free tier 5K err/tháng. Chưa có production thì vô nghĩa.
9. **Rate limit `/api/v1/*`** — khi expose public: server single-process (như SSE hub) → in-memory token bucket ~20 dòng là đủ, KHÔNG cần Upstash.

**ĐỪNG mua (tự làm ổn):** theme provider, markdown stack (XSS-safe, tested — ngoại lệ: cần GFM table/image/strikethrough thì mới xem `react-markdown`), RBAC `permissions.ts`, CSV export, fractional indexing, dnd-kit (đã dùng lib).

**Thiếu tính năng (không phải lib):** email (Better Auth chưa config send hook), webhook retry/queue, notification dedupe/preference, pagination UI (board load all), SSE hub single-process (multi-instance cần Redis pub/sub), task key dạng `PRJ-123` (chỉ UUID), workspace timezone.

---

## OUT OF SCOPE (task riêng, đã ghi nhận)

- Workspace layout `await` 4 queries (`layout.tsx:25-30`) chặn mọi nav **vào** workspace → cần tách data/Suspense riêng trong layout. `loading.tsx` không cứu phase này; bar phủ phase click→commit.
- Inline spinner cho button actions (vd. `attachment-list.tsx:122` chỉ đổi text "Uploading…").

---

## Ghi chú vận hành dev-loop (next-dev-loop skill)

- PowerShell chặn shim `.ps1` → mọi lệnh agent-browser qua `cmd /c "..."`.
- Cần set `$env:AGENT_BROWSER_SESSION` + `$env:AGENT_BROWSER_RESTORE` (worktree-scoped session) cho mỗi lệnh.
- **Window Chrome hay tự ẩn** (`document.visibilityState === "hidden"`) → click/press không vào DOM (chỉ `✓ Done`). Fix: `agent-browser close` rồi `open` lại → window thành `visible`. Eval/logger vẫn chạy khi tab ẩn.
- Cửa sổ phải `visible` thì `agent-browser click` mới phát event; nếu vẫn giở chứng thì thay bằng `focus @ref` + `press Enter`.
- Timer throttling của tab ẩn (~1s) đã được xử lý khi launch bằng `--args "--disable-background-timer-throttling,--disable-backgrounding-occluded-windows,--disable-renderer-backgrounding"`.
- Muốn đo timing bar chính xác: giữ page JS logger (MutationObserver trên `div[role=status]+div` + wrap `history.pushState/replaceState` + capture click), đọc qua eval. Không dùng interval sampler (throttle/flutter).
- Login test: `owner@demo.com` / `Password123!` (từ `prisma/seed.ts` DEMO_PASSWORD).

---

## Kiểm chứng xong — ghi chú vào đây

- [x] Phase 1: tsc 0 lỗi; lint chỉ còn pre-existing (không ở file đụng); unit 447/447; a11y 6/6; browser verify acceptance #1,#2,#5,#6,#9.
- [x] Phase 2: tsc/lint sạch; unit 447/447; browser verify nav programmatic qua command palette.
- [x] Phase 3: 7 loading.tsx + dedupe KanbanColumnSkeleton; tsc 0; lint 0 (file đụng); unit 447/447; a11y 6/6 (sau khi harden test chờ title settle); browser verify skeleton Timesheet/Analytics/project.