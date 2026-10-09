import {
  differenceInDays,
  differenceInHours,
  differenceInMinutes,
  differenceInSeconds,
  format,
} from "date-fns";

type DateInput = Date | string | number;

function toDate(input: DateInput): Date {
  return input instanceof Date ? input : new Date(input);
}

/** "Oct 8, 2026" — ngày chuẩn cho mọi nơi hiển thị. */
export function formatDate(input: DateInput): string {
  return format(toDate(input), "MMM d, yyyy");
}

/** "Oct 8, 2026, 2:30 PM" — ngày + giờ cho timeline/comment/log. */
export function formatDateTime(input: DateInput): string {
  return format(toDate(input), "MMM d, yyyy, h:mm a");
}

/** "2:30 PM" — giờ trong ngày (webhook logs). */
export function formatTime(input: DateInput): string {
  return format(toDate(input), "h:mm a");
}

/** "Wed, Oct 8, 2026" — dòng chi tiết timesheet. */
export function formatWeekdayDate(input: DateInput): string {
  return format(toDate(input), "EEE, MMM d, yyyy");
}

/** "Oct 8" — nhãn ngắn cho burndown chart. */
export function formatShortDay(input: DateInput): string {
  return format(toDate(input), "MMM d");
}

/** "2026-10-08" — giá trị cho `<input type="date" min={...}>`. */
export function formatDateInputValue(input: DateInput): string {
  return format(toDate(input), "yyyy-MM-dd");
}

/**
 * Relative time gọn cho UI đặc ("just now", "5m", "3h", "2d"),
 * quá 7 ngày thì rơi về `formatDate` — cùng output với `timeAgo` cũ,
 * nay dùng chung thay vì mỗi component tự tính.
 */
export function formatRelativeShort(input: DateInput, now: number = Date.now()): string {
  const date = toDate(input);
  const seconds = Math.max(
    0,
    differenceInSeconds(new Date(now), date),
  );
  if (seconds < 45) return "just now";
  const minutes = differenceInMinutes(new Date(now), date);
  if (minutes < 60) return `${minutes}m`;
  const hours = differenceInHours(new Date(now), date);
  if (hours < 24) return `${hours}h`;
  const days = differenceInDays(new Date(now), date);
  if (days < 7) return `${days}d`;
  return formatDate(date);
}
