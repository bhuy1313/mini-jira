import { prisma } from "@/lib/prisma";
import { prismaAttachmentRepository } from "@/features/attachments/prisma-attachment-repository";
import { attachmentStorage } from "@/features/attachments/attachment-storage";
import { getSessionUser } from "@/features/workspaces/session";

export const runtime = "nodejs";

/**
 * Download attachment kèm auth: chỉ member của workspace chứa task mới tải được.
 * Trả 404 khi không tồn tại hoặc không có quyền để không làm lộ dữ liệu.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ attachmentId: string }> },
) {
  const { attachmentId } = await params;

  const user = await getSessionUser();
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const attachment = await prismaAttachmentRepository.getAttachment(attachmentId);
  if (!attachment) {
    return new Response("Not found", { status: 404 });
  }

  const membership = await prisma.workspaceMember.findUnique({
    where: { userId_workspaceId: { userId: user.id, workspaceId: attachment.workspaceId } },
    select: { userId: true },
  });
  if (!membership) {
    return new Response("Not found", { status: 404 });
  }

  const bytes = await attachmentStorage.read(attachment.storageKey);
  if (!bytes) {
    return new Response("Not found", { status: 404 });
  }

  const filename = encodeURIComponent(attachment.filename);
  const blob = new Blob([bytes.slice().buffer]);
  return new Response(blob, {
    headers: {
      "Content-Type": attachment.mimeType || "application/octet-stream",
      "Content-Length": String(attachment.size),
      "Content-Disposition": `attachment; filename*=UTF-8''${filename}`,
      "Cache-Control": "private, max-age=60",
    },
  });
}