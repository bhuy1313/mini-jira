/**
 * Jira-standard duration parser and formatter.
 *
 * Working time convention:
 * - 1 week (1w) = 5 working days = 40 hours = 2,400 minutes
 * - 1 day (1d)   = 8 working hours = 480 minutes
 * - 1 hour (1h)  = 60 minutes
 * - 1 minute (1m)= 1 minute
 */

export const MINUTES_PER_MINUTE = 1;
export const MINUTES_PER_HOUR = 60;
export const MINUTES_PER_DAY = 8 * MINUTES_PER_HOUR; // 480
export const MINUTES_PER_WEEK = 5 * MINUTES_PER_DAY; // 2400

const TOKEN_REGEX = /(\d+(?:\.\d+)?)\s*(w(?:eeks?)?|d(?:ays?)?|h(?:(?:ou)?rs?)?|m(?:in(?:ute)?s?)?)/gi;

/**
 * Parses human duration input string into total minutes.
 * Supports:
 * - Jira shorthand: "1w 2d 4h 30m", "2d 4h", "1h 30m", "45m"
 * - Full/partial words: "1 week 2 days 4 hours 30 mins", "1.5h", "0.5d"
 * - Plain positive integer (treated as minutes): "90" -> 90
 *
 * Returns positive integer minutes or `null` if invalid/empty/zero/negative.
 */
export function parseDuration(input: string | null | undefined): number | null {
  if (!input) return null;
  const str = input.trim();
  if (!str) return null;

  // Plain number fallback (e.g. "90" -> 90 minutes)
  if (/^\d+$/.test(str)) {
    const val = parseInt(str, 10);
    return val > 0 ? val : null;
  }

  let totalMinutes = 0;
  let matchesCount = 0;
  let remaining = str;

  // Match all unit tokens
  let match: RegExpExecArray | null;
  TOKEN_REGEX.lastIndex = 0;
  while ((match = TOKEN_REGEX.exec(str)) !== null) {
    matchesCount++;
    const value = parseFloat(match[1]);
    const unit = match[2].toLowerCase();

    if (isNaN(value) || value < 0) return null;

    if (unit.startsWith("w")) {
      totalMinutes += Math.round(value * MINUTES_PER_WEEK);
    } else if (unit.startsWith("d")) {
      totalMinutes += Math.round(value * MINUTES_PER_DAY);
    } else if (unit.startsWith("h")) {
      totalMinutes += Math.round(value * MINUTES_PER_HOUR);
    } else if (unit.startsWith("m")) {
      totalMinutes += Math.round(value * MINUTES_PER_MINUTE);
    }

    // Strip matched part out of remaining to ensure no garbage characters remain
    remaining = remaining.replace(match[0], "");
  }

  // If there are non-whitespace leftovers or no matches found, string is invalid
  if (matchesCount === 0 || remaining.trim().length > 0) {
    return null;
  }

  return totalMinutes > 0 ? totalMinutes : null;
}

/**
 * Formats minutes into standard compact Jira duration string.
 * Example: 2550 -> "1w 2h 30m", 90 -> "1h 30m", 480 -> "1d"
 */
export function formatDuration(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined || minutes <= 0 || isNaN(minutes)) {
    return "0m";
  }

  let rem = Math.round(minutes);
  const w = Math.floor(rem / MINUTES_PER_WEEK);
  rem %= MINUTES_PER_WEEK;

  const d = Math.floor(rem / MINUTES_PER_DAY);
  rem %= MINUTES_PER_DAY;

  const h = Math.floor(rem / MINUTES_PER_HOUR);
  rem %= MINUTES_PER_HOUR;

  const m = rem;

  const parts: string[] = [];
  if (w > 0) parts.push(`${w}w`);
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);

  return parts.length > 0 ? parts.join(" ") : "0m";
}

/**
 * Formats minutes into human readable detailed label for tooltips and accessibility.
 * Example: 90 -> "1 hour 30 minutes", 480 -> "1 day", 2400 -> "1 week"
 */
export function formatDurationDetailed(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined || minutes <= 0 || isNaN(minutes)) {
    return "0 minutes";
  }

  let rem = Math.round(minutes);
  const w = Math.floor(rem / MINUTES_PER_WEEK);
  rem %= MINUTES_PER_WEEK;

  const d = Math.floor(rem / MINUTES_PER_DAY);
  rem %= MINUTES_PER_DAY;

  const h = Math.floor(rem / MINUTES_PER_HOUR);
  rem %= MINUTES_PER_HOUR;

  const m = rem;

  const parts: string[] = [];
  if (w > 0) parts.push(`${w} ${w === 1 ? "week" : "weeks"}`);
  if (d > 0) parts.push(`${d} ${d === 1 ? "day" : "days"}`);
  if (h > 0) parts.push(`${h} ${h === 1 ? "hour" : "hours"}`);
  if (m > 0) parts.push(`${m} ${m === 1 ? "minute" : "minutes"}`);

  return parts.length > 0 ? parts.join(" ") : "0 minutes";
}
