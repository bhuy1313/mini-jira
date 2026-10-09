"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { formatDuration } from "../duration";
import { formatWeekdayDate } from "@/lib/dates";
import type { TimesheetWorklogItem } from "../timesheet-service";

interface TimesheetTableProps {
  worklogs: TimesheetWorklogItem[];
  workspaceId: string;
}

export function TimesheetTable({ worklogs, workspaceId }: TimesheetTableProps) {
  if (worklogs.length === 0) {
    return (
      <div
        className="rounded-xl border border-rule bg-panel p-12 text-center text-sm text-ink-faint shadow-2xs"
        data-testid="timesheet-empty-state"
      >
        No worklogs recorded for the selected period.
      </div>
    );
  }

  return (
    <div
      className="overflow-x-auto rounded-xl border border-rule bg-panel shadow-2xs"
      data-testid="timesheet-table-container"
    >
      <table className="w-full min-w-[750px] border-collapse text-left text-xs">
        <thead>
          <tr className="border-b border-rule bg-paper/60 text-ink-soft">
            <th className="py-3 px-4 font-semibold text-ink min-w-[120px]">Date</th>
            <th className="py-3 px-4 font-semibold text-ink min-w-[180px]">Member</th>
            <th className="py-3 px-4 font-semibold text-ink min-w-[130px]">Project</th>
            <th className="py-3 px-4 font-semibold text-ink min-w-[200px]">Task</th>
            <th className="py-3 px-4 text-right font-semibold text-ink min-w-[100px]">
              Time Spent
            </th>
            <th className="py-3 px-4 font-semibold text-ink min-w-[220px]">
              Work Description
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-rule text-ink">
          {worklogs.map((log) => {
            const initial = log.authorName.charAt(0).toUpperCase();
            const dateFormatted = formatWeekdayDate(log.startedAt);

            return (
              <tr
                key={log.id}
                className="hover:bg-paper/40 transition-colors"
                data-testid={`timesheet-log-row-${log.id}`}
              >
                {/* Date */}
                <td className="py-3 px-4 font-medium text-ink-soft whitespace-nowrap">
                  {dateFormatted}
                </td>

                {/* Member */}
                <td className="py-3 px-4">
                  <div className="flex items-center gap-2">
                    <span className="grid size-6 shrink-0 place-items-center rounded-md bg-primary-soft text-[11px] font-bold text-primary-ink shadow-2xs">
                      {initial}
                    </span>
                    <span className="font-semibold text-ink truncate max-w-[150px]">
                      {log.authorName}
                    </span>
                  </div>
                </td>

                {/* Project */}
                <td className="py-3 px-4">
                  <Badge tone="neutral" className="text-2xs font-medium">
                    {log.projectName}
                  </Badge>
                </td>

                {/* Task */}
                <td className="py-3 px-4">
                  <Link
                    href={`/workspaces/${workspaceId}/projects/${log.projectId}`}
                    className="font-medium text-ink hover:text-primary transition-colors line-clamp-1"
                    title={log.taskTitle}
                  >
                    {log.taskTitle}
                  </Link>
                </td>

                {/* Time Spent */}
                <td className="py-3 px-4 text-right">
                  <span className="inline-block rounded-md bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary-ink">
                    {formatDuration(log.timeSpentMinutes)}
                  </span>
                </td>

                {/* Description */}
                <td className="py-3 px-4 text-ink-soft">
                  {log.description ? (
                    <p className="line-clamp-2 text-ink">{log.description}</p>
                  ) : (
                    <span className="italic text-ink-faint">No description</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
