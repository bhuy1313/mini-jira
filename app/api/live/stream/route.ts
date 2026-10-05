import { prisma } from "@/lib/prisma";
import { liveHub } from "@/features/live/live-hub";
import { serializeSseEvent, type LiveEvent } from "@/features/live/live-events";
import { auth } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HEARTBEAT_MS = 20_000;

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  const user = session?.user ?? null;
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const url = new URL(request.url);
  const workspaceId = url.searchParams.get("workspaceId");
  if (!workspaceId) {
    return new Response("Missing workspaceId", { status: 400 });
  }

  const membership = await prisma.workspaceMember.findUnique({
    where: { userId_workspaceId: { userId: user.id, workspaceId } },
    select: { userId: true },
  });
  if (!membership) {
    return new Response("Forbidden", { status: 403 });
  }

  const encoder = new TextEncoder();
  let closed = false;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (event: LiveEvent) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(serializeSseEvent(event)));
        } catch {
          // client đã ngắt giữa chừng — bỏ qua frame này.
        }
      };

      const unsubscribe = liveHub.subscribe(workspaceId, user.id, send);

      const heartbeat = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(": ping\n\n"));
        } catch {
          // ignore
        }
      }, HEARTBEAT_MS);

      const cleanup = () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // stream đã đóng.
        }
      };

      // client ngắt kết nối hoặc abort → dọn dẹp.
      request.signal.addEventListener("abort", cleanup, { once: true });

      // retry: tự reconnect sau 3s.
      try {
        controller.enqueue(encoder.encode("retry: 3000\n\n"));
      } catch {
        // ignore
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}