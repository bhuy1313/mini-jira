import { prisma } from "@/lib/prisma";
import {
  handleApiError,
  jsonSuccess,
  requireApiActor,
} from "@/features/api-keys/api-response";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { actor } = await requireApiActor(request);

    const workspace = await prisma.workspace.findUnique({
      where: { id: actor.workspaceId },
      select: {
        id: true,
        name: true,
        description: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!workspace) {
      return handleApiError(new Error("Workspace not found"));
    }

    return jsonSuccess({
      ...workspace,
      role: actor.role,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
