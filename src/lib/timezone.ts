/**
 * Múi giờ hiển thị/bucket của app — KHÔNG phụ thuộc TZ của server.
 *
 * Bối cảnh: `process.env.TZ` không set được trên Vercel (tên cấm của Lambda),
 * mà bucket timesheet/burndown cũ dùng giờ server-local nên dev (+07) và prod
 * (UTC) chia ngày khác nhau. Mọi thứ ở đây tính qua Intl với zone tường minh,
 * chạy giống hệt trên mọi môi trường.
 */

const DEFAULT_TIME_ZONE = "Asia/Ho_Chi_Minh";

let resolvedZone: string | null = null;

/** Zone hiệu dụng: APP_TIMEZONE (tên cho phép trên Vercel) hoặc mặc định. */
export function appTimeZone(): string {
  if (resolvedZone) return resolvedZone;
  const candidate = process.env.APP_TIMEZONE?.trim();
  if (candidate) {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: candidate });
      resolvedZone = candidate;
      return resolvedZone;
    } catch {
      // Tên zone sai — rơi về mặc định bên dưới.
    }
  }
  resolvedZone = DEFAULT_TIME_ZONE;
  return resolvedZone;
}

/** Reset cache zone — chỉ dùng trong test. */
export function resetTimeZoneCache(): void {
  resolvedZone = null;
}

export interface ZoneDateParts {
  year: number;
  /** 1–12 */
  month: number;
  /** 1–31 */
  day: number;
  /** 0=Sun … 6=Sat */
  weekday: number;
  /** "YYYY-MM-DD" */
  iso: string;
}

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

const partsFormatterCache = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(timeZone: string): Intl.DateTimeFormat {
  const cached = partsFormatterCache.get(timeZone);
  if (cached) return cached;
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  });
  partsFormatterCache.set(timeZone, dtf);
  return dtf;
}

/** Tách ngày-theo-zone từ một instant. */
export function zoneParts(date: Date, timeZone: string = appTimeZone()): ZoneDateParts {
  const parts = partsFormatter(timeZone).formatToParts(date);
  const get = (type: string): string =>
    parts.find((p) => p.type === type)?.value ?? "";
  const year = Number(get("year"));
  const month = Number(get("month"));
  const day = Number(get("day"));
  const weekday = WEEKDAY_INDEX[get("weekday")] ?? 0;
  const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return { year, month, day, weekday, iso };
}

/** Offset của zone tại một instant (ms, đông = dương). Đúng cả zone có DST. */
export function zoneOffsetMs(timeZone: string, instant: Date): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = dtf.formatToParts(instant);
  const get = (type: string): number =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);
  const asUTC = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second"),
  );
  return asUTC - instant.getTime();
}

/** Instant 00:00 của một ngày-theo-zone (y, m 1-based, d). */
export function zoneMidnightInstant(
  year: number,
  month: number,
  day: number,
  timeZone: string = appTimeZone(),
): Date {
  const guess = Date.UTC(year, month - 1, day);
  // Vòng 2 để đúng cả khi DST đổi offset đúng đêm giao ngày.
  const first = guess - zoneOffsetMs(timeZone, new Date(guess));
  return new Date(guess - zoneOffsetMs(timeZone, new Date(first)));
}

/** "YYYY-MM-DD" của instant theo zone của app. */
export function toZoneDateString(date: Date, timeZone: string = appTimeZone()): string {
  return zoneParts(date, timeZone).iso;
}
