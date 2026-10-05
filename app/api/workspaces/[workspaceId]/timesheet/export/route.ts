import { NextResponse } from "next/server";
import { requireActor } from "@/features/workspaces/session";
import { prismaWorklogRepository } from "@/features/worklogs/prisma-worklog-repository";
import { generateTimesheetCsv, type TimesheetCsvRow } from "@/features/worklogs/csv-export";
import { getWeekDateRange, toISODateString } from "@/features/worklogs/timesheet-service";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ workspaceId: string }> },
) {
  try {
    const { workspaceId } = await params;
    const actor = await requireActor(workspaceId);

    const { searchParams } = new URL(request.url);
    const startParam = searchParams.get("startDate");
    const endParam = searchParams.get("endDate");
    const projectId = searchParams.get("projectId") || undefined;
    const userId = searchParams.get("userId") || undefined;

    let startDate: Date;
    let endDate: Date;

    if (startParam && endParam) {
      startDate = new Date(startParam);
      startDate.setHours(0, 0, 0, 0);

      endDate = new Date(endParam);
      endDate.setHours(23, 59, 59, 999);
    } else {
      const defaultRange = getWeekDateRange();
      startDate = defaultRange.startDate;
      endDate = defaultRange.endDate;
    }

    const worklogs = await prismaWorklogRepository.queryTimesheetWorklogs(workspaceId, {
      startDate,
      endDate,
      projectId,
      authorId: userId,
    });

    const csvRows: TimesheetCsvRow[] = worklogs.map((w) => ({
      date: toISODateString(new Date(w.startedAt)),
      memberName: w.authorName,
      memberEmail: w.authorEmail,
      projectName: w.projectName,
      taskId: w.taskId,
      taskTitle: w.taskTitle,
      timeSpentMinutes: w.timeSpentMinutes,
      description: w.description,
      loggedAt: w.createdAt,
    }));

    const csvContent = generateTimesheetCsv(csvRows);
    const startStr = toISODateString(startDate);
    const endStr = toISODateString(endDate);
    const filename = `timesheet-${startStr}-to-${endStr}.csv`;

    return new Response(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    const status = message.includes("Permission") || message.includes("Unauthorized") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
