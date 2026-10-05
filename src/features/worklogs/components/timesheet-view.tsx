"use client";

import { useState, useTransition } from "react";
import { formatDuration } from "../duration";
import {
  getWeekDateRange,
  toISODateString,
  type TimesheetReport,
} from "../timesheet-service";
import { getTimesheetReportAction } from "../actions";
import { TimesheetFilterBar } from "./timesheet-filter-bar";
import { TimesheetMatrix } from "./timesheet-matrix";
import { TimesheetTable } from "./timesheet-table";

interface TimesheetViewProps {
  workspaceId: string;
  initialReport: TimesheetReport;
  projects: Array<{ id: string; name: string }>;
  members: Array<{ id: string; name: string }>;
}

export function TimesheetView({
  workspaceId,
  initialReport,
  projects,
  members,
}: TimesheetViewProps) {
  const [report, setReport] = useState<TimesheetReport>(initialReport);
  const [view, setView] = useState<"matrix" | "list">("matrix");
  const [startDate, setStartDate] = useState<string>(initialReport.startDate);
  const [endDate, setEndDate] = useState<string>(initialReport.endDate);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [selectedMemberId, setSelectedMemberId] = useState<string>("");
  const [isPending, startTransition] = useTransition();

  const loadReport = (
    newStart: string,
    newEnd: string,
    projId: string,
    memId: string,
  ) => {
    startTransition(async () => {
      const res = await getTimesheetReportAction(workspaceId, {
        startDate: newStart,
        endDate: newEnd,
        projectId: projId || undefined,
        authorId: memId || undefined,
      });

      if (res.report) {
        setReport(res.report);
      }
    });
  };

  const handleNavigatePrev = () => {
    const s = new Date(startDate);
    s.setDate(s.getDate() - 7);
    const e = new Date(endDate);
    e.setDate(e.getDate() - 7);

    const newStart = toISODateString(s);
    const newEnd = toISODateString(e);
    setStartDate(newStart);
    setEndDate(newEnd);
    loadReport(newStart, newEnd, selectedProjectId, selectedMemberId);
  };

  const handleNavigateNext = () => {
    const s = new Date(startDate);
    s.setDate(s.getDate() + 7);
    const e = new Date(endDate);
    e.setDate(e.getDate() + 7);

    const newStart = toISODateString(s);
    const newEnd = toISODateString(e);
    setStartDate(newStart);
    setEndDate(newEnd);
    loadReport(newStart, newEnd, selectedProjectId, selectedMemberId);
  };

  const handleResetThisWeek = () => {
    const range = getWeekDateRange();
    const newStart = toISODateString(range.startDate);
    const newEnd = toISODateString(range.endDate);
    setStartDate(newStart);
    setEndDate(newEnd);
    loadReport(newStart, newEnd, selectedProjectId, selectedMemberId);
  };

  const handleProjectChange = (projId: string) => {
    setSelectedProjectId(projId);
    loadReport(startDate, endDate, projId, selectedMemberId);
  };

  const handleMemberChange = (memId: string) => {
    setSelectedMemberId(memId);
    loadReport(startDate, endDate, selectedProjectId, memId);
  };

  return (
    <div className="space-y-6" data-testid="timesheet-view">
      {/* ── KPI Stat Cards ── */}
      <div
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
        data-testid="timesheet-stat-cards"
      >
        <div className="rounded-xl border border-rule bg-panel p-5 shadow-2xs">
          <p className="text-xs font-semibold uppercase tracking-wider text-ink-soft">
            Total Hours Logged
          </p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-primary">
            {formatDuration(report.grandTotalMinutes)}
          </p>
          <p className="mt-1 text-xs text-ink-faint">
            across {report.worklogs.length} entries
          </p>
        </div>

        <div className="rounded-xl border border-rule bg-panel p-5 shadow-2xs">
          <p className="text-xs font-semibold uppercase tracking-wider text-ink-soft">
            Active Contributors
          </p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-ink">
            {report.activeContributors}
            <span className="text-sm font-normal text-ink-faint">
              {" "}
              / {members.length} members
            </span>
          </p>
          <p className="mt-1 text-xs text-ink-faint">logged time this period</p>
        </div>

        <div className="rounded-xl border border-rule bg-panel p-5 shadow-2xs">
          <p className="text-xs font-semibold uppercase tracking-wider text-ink-soft">
            Workday Average
          </p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-ink">
            {report.avgHoursPerWorkday}h
          </p>
          <p className="mt-1 text-xs text-ink-faint">average per team workday</p>
        </div>

        <div className="rounded-xl border border-rule bg-panel p-5 shadow-2xs">
          <p className="text-xs font-semibold uppercase tracking-wider text-ink-soft">
            Top Project
          </p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-ink truncate">
            {report.topProject ? report.topProject.name : "None"}
          </p>
          <p className="mt-1 text-xs text-ink-faint">
            {report.topProject
              ? `${formatDuration(report.topProject.minutes)} recorded`
              : "No time logged"}
          </p>
        </div>
      </div>

      {/* ── Filter Bar ── */}
      <TimesheetFilterBar
        workspaceId={workspaceId}
        startDate={startDate}
        endDate={endDate}
        view={view}
        onViewChange={setView}
        onNavigatePrev={handleNavigatePrev}
        onNavigateNext={handleNavigateNext}
        onResetThisWeek={handleResetThisWeek}
        projects={projects}
        selectedProjectId={selectedProjectId}
        onProjectChange={handleProjectChange}
        members={members}
        selectedMemberId={selectedMemberId}
        onMemberChange={handleMemberChange}
      />

      {/* ── Active View (Matrix or Table) ── */}
      <div className={`transition-opacity ${isPending ? "opacity-50" : "opacity-100"}`}>
        {view === "matrix" ? (
          <TimesheetMatrix
            days={report.days}
            rows={report.rows}
            teamDailyMinutes={report.teamDailyMinutes}
            grandTotalMinutes={report.grandTotalMinutes}
          />
        ) : (
          <TimesheetTable worklogs={report.worklogs} workspaceId={workspaceId} />
        )}
      </div>
    </div>
  );
}
