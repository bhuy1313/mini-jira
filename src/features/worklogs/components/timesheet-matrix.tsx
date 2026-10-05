"use client";

import { formatDuration } from "../duration";
import type {
  MemberTimesheetRow,
  TimesheetDaySummary,
} from "../timesheet-service";

interface TimesheetMatrixProps {
  days: TimesheetDaySummary[];
  rows: MemberTimesheetRow[];
  teamDailyMinutes: Record<string, number>;
  grandTotalMinutes: number;
}

export function TimesheetMatrix({
  days,
  rows,
  teamDailyMinutes,
  grandTotalMinutes,
}: TimesheetMatrixProps) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-rule bg-panel p-8 text-center text-sm text-ink-faint">
        No team members found in this workspace.
      </div>
    );
  }

  return (
    <div
      className="overflow-x-auto rounded-xl border border-rule bg-panel shadow-2xs"
      data-testid="timesheet-matrix-container"
    >
      <table className="w-full min-w-[700px] border-collapse text-left text-xs">
        {/* Table Header */}
        <thead>
          <tr className="border-b border-rule bg-paper/60 text-ink-soft">
            <th className="py-3 px-4 font-semibold text-ink min-w-[200px]">
              Team Member
            </th>
            {days.map((day) => (
              <th
                key={day.date}
                className={`py-3 px-3 text-center font-medium min-w-[75px] ${
                  day.isWeekend ? "bg-rule/10 text-ink-faint" : ""
                }`}
              >
                <div>{day.dayLabel.split(" ")[0]}</div>
                <div className="text-[11px] font-semibold text-ink">
                  {day.dayLabel.split(" ")[1]}
                </div>
              </th>
            ))}
            <th className="py-3 px-4 text-right font-semibold text-ink min-w-[90px]">
              Total
            </th>
          </tr>
        </thead>

        {/* Table Body */}
        <tbody className="divide-y divide-rule text-ink">
          {rows.map((row) => {
            const initial = row.member.name.charAt(0).toUpperCase();

            return (
              <tr
                key={row.member.id}
                className="hover:bg-paper/40 transition-colors group"
                data-testid={`timesheet-row-${row.member.id}`}
              >
                {/* Member Profile */}
                <td className="py-3 px-4">
                  <div className="flex items-center gap-2.5">
                    <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-primary-soft text-xs font-bold text-primary-ink shadow-2xs">
                      {initial}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-ink leading-tight">
                        {row.member.name}
                      </p>
                      <p className="truncate text-[10px] text-ink-faint leading-tight mt-0.5">
                        {row.member.email}
                      </p>
                    </div>
                  </div>
                </td>

                {/* Day cells */}
                {days.map((day) => {
                  const minutes = row.dailyMinutes[day.date] || 0;
                  const hasWork = minutes > 0;
                  const isOverEight = minutes >= 480;

                  return (
                    <td
                      key={day.date}
                      className={`py-2.5 px-3 text-center text-xs ${
                        day.isWeekend ? "bg-rule/5" : ""
                      }`}
                    >
                      {hasWork ? (
                        <div
                          className={`inline-block rounded-md px-1.5 py-1 font-medium transition-colors ${
                            isOverEight
                              ? "bg-done/15 text-done font-semibold"
                              : "bg-primary/10 text-primary-ink font-semibold"
                          }`}
                          title={`${row.member.name}: ${formatDuration(minutes)} on ${day.date}`}
                        >
                          {formatDuration(minutes)}
                        </div>
                      ) : (
                        <span className="text-ink-faint/60 font-mono">—</span>
                      )}
                    </td>
                  );
                })}

                {/* Member Total */}
                <td className="py-3 px-4 text-right">
                  <span
                    className={`inline-block rounded-md px-2 py-0.5 text-xs font-bold ${
                      row.totalMinutes > 0
                        ? "bg-paper text-ink border border-rule"
                        : "text-ink-faint"
                    }`}
                  >
                    {row.totalMinutes > 0 ? formatDuration(row.totalMinutes) : "0m"}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>

        {/* Table Footer: Team Daily Sum */}
        <tfoot>
          <tr className="border-t-2 border-rule bg-paper/80 font-bold text-ink">
            <td className="py-3 px-4 text-xs uppercase tracking-wider text-ink-soft">
              👥 Team Daily Sum
            </td>
            {days.map((day) => {
              const minutes = teamDailyMinutes[day.date] || 0;
              return (
                <td
                  key={day.date}
                  className={`py-3 px-3 text-center text-xs ${
                    day.isWeekend ? "bg-rule/10" : ""
                  }`}
                >
                  {minutes > 0 ? (
                    <span className="font-bold text-primary">
                      {formatDuration(minutes)}
                    </span>
                  ) : (
                    <span className="text-ink-faint/60 font-mono">—</span>
                  )}
                </td>
              );
            })}
            <td className="py-3 px-4 text-right text-xs font-extrabold text-primary">
              {formatDuration(grandTotalMinutes)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
