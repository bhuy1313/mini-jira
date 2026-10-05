import { redirect } from "next/navigation";
import { ClockIcon } from "@/components/ui/icons";
import { requireActor } from "@/features/workspaces/session";
import { getWorkspaceContext } from "@/features/workspaces/queries";
import { getWorkspaceProjectLists } from "@/features/projects/queries";
import { prismaWorklogRepository } from "@/features/worklogs/prisma-worklog-repository";
import { prismaWorkspaceRepository } from "@/features/workspaces/prisma-workspace-repository";
import {
  createTimesheetService,
  getWeekDateRange,
} from "@/features/worklogs/timesheet-service";
import { TimesheetView } from "@/features/worklogs/components/timesheet-view";

export const dynamic = "force-dynamic";
export const metadata = { title: "Timesheet & Worklogs" };

const timesheetService = createTimesheetService({
  repo: prismaWorklogRepository,
  getMembers: async (workspaceId: string) => {
    const members = await prismaWorkspaceRepository.listMembersWithUsers(workspaceId);
    return members.map((m) => ({
      id: m.userId,
      name: m.name,
      email: m.email,
    }));
  },
});

export default async function TimesheetPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  const actor = await requireActor(workspaceId).catch(() => null);
  if (!actor) redirect("/workspaces");

  const [{ ws, members }, projectLists] = await Promise.all([
    getWorkspaceContext(workspaceId),
    getWorkspaceProjectLists(workspaceId),
  ]);

  const defaultRange = getWeekDateRange();
  const initialReport = await timesheetService.getTimesheetReport(actor, {
    startDate: defaultRange.startDate,
    endDate: defaultRange.endDate,
  });

  const projectsSummary = projectLists.active.map((p) => ({
    id: p.id,
    name: p.name,
  }));

  const membersSummary = members.map((m) => ({
    id: m.userId,
    name: m.name,
  }));

  return (
    <div className="space-y-6">
      {/* ── Standardized Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-rule pb-5">
        <div className="flex items-center gap-3.5">
          <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary-ink shadow-2xs border border-primary/20">
            <ClockIcon className="size-6" />
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-ink">
              Timesheet & Worklogs
            </h1>
            <p className="mt-1 text-sm text-ink-soft">
              Track team work hours, review weekly timesheets, and export data for {ws.name}.
            </p>
          </div>
        </div>
      </div>

      {/* ── Main View Component ── */}
      <TimesheetView
        workspaceId={workspaceId}
        initialReport={initialReport}
        projects={projectsSummary}
        members={membersSummary}
      />
    </div>
  );
}
