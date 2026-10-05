import { prisma } from "@/lib/prisma";
import {
  handleApiError,
  jsonSuccess,
  requireApiActor,
} from "@/features/api-keys/api-response";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ workspaceId: string }> },
) {
  try {
    const { workspaceId } = await params;
    const { actor } = await requireApiActor(request, workspaceId);

    const projects = await prisma.project.findMany({
      where: {
        workspaceId: actor.workspaceId,
        archivedAt: null,
      },
      select: {
        id: true,
        name: true,
        description: true,
        workspaceId: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            tasks: true,
            members: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return jsonSuccess(projects);
  } catch (err) {
    return handleApiError(err);
  }
}
