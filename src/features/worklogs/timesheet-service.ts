import type { Actor } from "@/features/authorization/actor";
import { effectiveRole, requirePermission } from "@/features/authorization/actor";
import { canViewWorklogs } from "@/features/authorization/permissions";
import {
  appTimeZone,
  toZoneDateString,
  zoneMidnightInstant,
  zoneParts,
} from "@/lib/timezone";

export interface TimesheetFilter {
  startDate: Date;
  endDate: Date;
  projectId?: string;
  authorId?: string;
}

export interface TimesheetDaySummary {
  date: string; // "YYYY-MM-DD"
  dayLabel: string; // "Mon 28", "Tue 29"
  dayOfWeek: number; // 0 (Sun) - 6 (Sat)
  isWeekend: boolean;
  totalMinutes: number;
}

export interface TimesheetTaskBreakdown {
  taskId: string;
  taskTitle: string;
  projectId: string;
  projectName: string;
  minutes: number;
}

export interface MemberTimesheetRow {
  member: {
    id: string;
    name: string;
    email: string;
    image?: string | null;
  };
  dailyMinutes: Record<string, number>;
  totalMinutes: number;
  tasks: TimesheetTaskBreakdown[];
}

export interface TimesheetWorklogItem {
  id: string;
  taskId: string;
  taskTitle: string;
  authorId: string;
  authorName: string;
  authorEmail: string;
  authorImage?: string | null;
  projectId: string;
  projectName: string;
  timeSpentMinutes: number;
  startedAt: Date;
  description: string | null;
  createdAt: Date;
}

export interface TimesheetReport {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  days: TimesheetDaySummary[];
  rows: MemberTimesheetRow[];
  teamDailyMinutes: Record<string, number>;
  grandTotalMinutes: number;
  activeContributors: number;
  avgHoursPerWorkday: number;
  topProject?: { id: string; name: string; minutes: number };
  worklogs: TimesheetWorklogItem[];
}

export interface TimesheetMemberInput {
  id: string;
  name: string;
  email: string;
  image?: string | null;
}

/**
 * Day-bucket key theo múi giờ của app (mặc định Asia/Ho_Chi_Minh) — không còn
 * phụ thuộc TZ của server nên dev, Vercel và CI chia ngày giống hệt nhau.
 */
export function toISODateString(d: Date): string {
  return toZoneDateString(d);
}

/**
 * Returns Monday 00:00 to Sunday 23:59:59.999 (theo zone của app) cho tuần
 * chứa `targetDate`. Trả về instant — so sánh DB dùng trực tiếp được.
 */
export function getWeekDateRange(targetDate: Date = new Date()): { startDate: Date; endDate: Date } {
  const zone = appTimeZone();
  const parts = zoneParts(targetDate, zone);
  // In JS: 0=Sun, 1=Mon, ..., 6=Sat
  const diffToMonday = parts.weekday === 0 ? -6 : 1 - parts.weekday;

  const mondayBase = Date.UTC(parts.year, parts.month - 1, parts.day + diffToMonday);
  const mondayParts = zoneParts(new Date(mondayBase), zone);
  const startDate = zoneMidnightInstant(mondayParts.year, mondayParts.month, mondayParts.day, zone);
  const endDate = new Date(startDate.getTime() + 7 * 86400_000 - 1);

  return { startDate, endDate };
}

/**
 * Returns ngày 1 00:00 tới cuối tháng 23:59:59.999 (theo zone của app) cho
 * tháng chứa `targetDate`.
 */
export function getMonthDateRange(targetDate: Date = new Date()): { startDate: Date; endDate: Date } {
  const zone = appTimeZone();
  const parts = zoneParts(targetDate, zone);
  const startDate = zoneMidnightInstant(parts.year, parts.month, 1, zone);
  const nextMonth = parts.month === 12
    ? { year: parts.year + 1, month: 1 }
    : { year: parts.year, month: parts.month + 1 };
  const endDate = new Date(
    zoneMidnightInstant(nextMonth.year, nextMonth.month, 1, zone).getTime() - 1,
  );
  return { startDate, endDate };
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * Generates an array of day descriptors for each calendar day between startDate and endDate inclusive.
 */
export function generateTimesheetDays(startDate: Date, endDate: Date): TimesheetDaySummary[] {
  const zone = appTimeZone();
  const days: TimesheetDaySummary[] = [];
  const startParts = zoneParts(startDate, zone);
  const endIso = toZoneDateString(endDate, zone);

  // Lặp theo lịch zone (UTC-day + zoneMidnightInstant cho exact, kể cả DST),
  // tối đa 400 ngày để range bệnh hoạn không treo page.
  const base = Date.UTC(startParts.year, startParts.month - 1, startParts.day);
  for (let i = 0; i < 400; i++) {
    const t = new Date(base + i * 86400_000);
    const midnight = zoneMidnightInstant(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate(), zone);
    const parts = zoneParts(midnight, zone);
    if (parts.iso > endIso) break;
    days.push({
      date: parts.iso,
      dayLabel: `${DAY_NAMES[parts.weekday]} ${parts.day}`,
      dayOfWeek: parts.weekday,
      isWeekend: parts.weekday === 0 || parts.weekday === 6,
      totalMinutes: 0,
    });
  }

  return days;
}

/**
 * Pure calculation function aggregating worklogs into daily buckets per member,
 * computing team totals, active contributors, and project breakdowns.
 */
export function calculateTimesheetReport(
  worklogs: TimesheetWorklogItem[],
  members: TimesheetMemberInput[],
  days: TimesheetDaySummary[],
): TimesheetReport {
  const teamDailyMinutes: Record<string, number> = {};
  for (const day of days) {
    teamDailyMinutes[day.date] = 0;
  }

  const rowMap = new Map<string, MemberTimesheetRow>();

  // Prepopulate member rows so even members with 0 logged time appear in the timesheet
  for (const m of members) {
    const daily: Record<string, number> = {};
    for (const day of days) {
      daily[day.date] = 0;
    }
    rowMap.set(m.id, {
      member: m,
      dailyMinutes: daily,
      totalMinutes: 0,
      tasks: [],
    });
  }

  const projectMap = new Map<string, { id: string; name: string; minutes: number }>();

  // Distribute each worklog into daily buckets
  for (const log of worklogs) {
    const dateKey = toISODateString(new Date(log.startedAt));

    if (teamDailyMinutes[dateKey] !== undefined) {
      teamDailyMinutes[dateKey] += log.timeSpentMinutes;
    }

    // Accumulate project minutes
    const proj = projectMap.get(log.projectId) ?? {
      id: log.projectId,
      name: log.projectName,
      minutes: 0,
    };
    proj.minutes += log.timeSpentMinutes;
    projectMap.set(log.projectId, proj);

    let row = rowMap.get(log.authorId);
    if (!row) {
      // Author might be a removed workspace member; create fallback row
      const fallbackDaily: Record<string, number> = {};
      for (const d of days) {
        fallbackDaily[d.date] = 0;
      }
      row = {
        member: {
          id: log.authorId,
          name: log.authorName,
          email: log.authorEmail,
          image: log.authorImage,
        },
        dailyMinutes: fallbackDaily,
        totalMinutes: 0,
        tasks: [],
      };
      rowMap.set(log.authorId, row);
    }

    if (row.dailyMinutes[dateKey] !== undefined) {
      row.dailyMinutes[dateKey] += log.timeSpentMinutes;
    }
    row.totalMinutes += log.timeSpentMinutes;

    // Track task breakdown
    let taskEntry = row.tasks.find((t) => t.taskId === log.taskId);
    if (!taskEntry) {
      taskEntry = {
        taskId: log.taskId,
        taskTitle: log.taskTitle,
        projectId: log.projectId,
        projectName: log.projectName,
        minutes: 0,
      };
      row.tasks.push(taskEntry);
    }
    taskEntry.minutes += log.timeSpentMinutes;
  }

  // Update day totalMinutes
  for (const day of days) {
    day.totalMinutes = teamDailyMinutes[day.date] ?? 0;
  }

  // Grand total
  const grandTotalMinutes = worklogs.reduce((sum, w) => sum + w.timeSpentMinutes, 0);

  // Active contributors
  const rows = Array.from(rowMap.values());
  const activeContributors = rows.filter((r) => r.totalMinutes > 0).length;

  // Workday average (Mon-Fri or all days if only weekends)
  const workdays = days.filter((d) => !d.isWeekend);
  const workdaysCount = workdays.length > 0 ? workdays.length : days.length;
  const avgHoursPerWorkday =
    workdaysCount > 0
      ? Number(((grandTotalMinutes / 60) / workdaysCount).toFixed(1))
      : 0;

  // Top project
  let topProject: { id: string; name: string; minutes: number } | undefined;
  for (const p of projectMap.values()) {
    if (!topProject || p.minutes > topProject.minutes) {
      topProject = p;
    }
  }

  // Sort rows: active members first (by total minutes desc), then 0-hour members alphabetically by name
  rows.sort((a, b) => {
    if (a.totalMinutes !== b.totalMinutes) {
      return b.totalMinutes - a.totalMinutes;
    }
    return a.member.name.localeCompare(b.member.name);
  });

  // Sort task breakdown within each row by minutes desc
  for (const row of rows) {
    row.tasks.sort((a, b) => b.minutes - a.minutes);
  }

  const startDateStr = days.length > 0 ? days[0].date : "";
  const endDateStr = days.length > 0 ? days[days.length - 1].date : "";

  return {
    startDate: startDateStr,
    endDate: endDateStr,
    days,
    rows,
    teamDailyMinutes,
    grandTotalMinutes,
    activeContributors,
    avgHoursPerWorkday,
    topProject,
    worklogs,
  };
}

export interface TimesheetRepository {
  queryTimesheetWorklogs(
    workspaceId: string,
    filter: TimesheetFilter,
  ): Promise<TimesheetWorklogItem[]>;
}

export interface TimesheetServiceDeps {
  repo: TimesheetRepository;
  getMembers(workspaceId: string): Promise<TimesheetMemberInput[]>;
}

export function createTimesheetService({ repo, getMembers }: TimesheetServiceDeps) {
  return {
    async getTimesheetReport(
      actor: Actor,
      filter: TimesheetFilter,
    ): Promise<TimesheetReport> {
      const role = effectiveRole(actor);
      requirePermission(actor, canViewWorklogs(role), "Permission denied to view timesheet.");

      const [worklogs, members] = await Promise.all([
        repo.queryTimesheetWorklogs(actor.workspaceId, filter),
        getMembers(actor.workspaceId),
      ]);

      const days = generateTimesheetDays(filter.startDate, filter.endDate);
      return calculateTimesheetReport(worklogs, members, days);
    },
  };
}
