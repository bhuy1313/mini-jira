"use client";

import { useEffect, useRef } from "react";

import type { LiveEvent } from "@/features/live/live-events";

/**
 * Client hook mở 1 kết nối SSE tới `/api/live/stream?workspaceId=...` và gọi
 * `onEvent` cho mọi event nhận được (ROADMAP Mốc 14).
 *
 * `onEvent` được giữ trong ref để không đóng/mở lại kết nối khi handler thay
 * đổi theo render; connection tự reconnect theo `retry:` của server. Khi
 * `workspaceId` undefined (chưa có) hoặc unmount thì đóng stream.
 */
export function useLiveEvents(
  workspaceId: string | undefined,
  onEvent: (event: LiveEvent) => void,
): void {
  const handlerRef = useRef(onEvent);

  useEffect(() => {
    handlerRef.current = onEvent;
  });

  useEffect(() => {
    if (!workspaceId) return;

    let source: EventSource | null = null;
    try {
      source = new EventSource(
        `/api/live/stream?workspaceId=${encodeURIComponent(workspaceId)}`,
      );

      function handle(message: MessageEvent<string>) {
        try {
          handlerRef.current(JSON.parse(message.data) as LiveEvent);
        } catch {
          // frame không hợp lệ — bỏ qua.
        }
      }

      source.addEventListener("board", handle);
      source.addEventListener("notify", handle);
      source.addEventListener("notifyRead", handle);
    } catch {
      // EventSource failed or unsupported
    }

    // Fast polling fallback for Serverless environments (like Vercel) where SSE memory is isolated
    const interval = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        handlerRef.current({ kind: "board", workspaceId } as unknown as LiveEvent);
      }
    }, 1500);

    const handleSync = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        handlerRef.current({ kind: "board", workspaceId } as unknown as LiveEvent);
      }
    };

    window.addEventListener("focus", handleSync);
    document.addEventListener("visibilitychange", handleSync);

    return () => {
      source?.close();
      clearInterval(interval);
      window.removeEventListener("focus", handleSync);
      document.removeEventListener("visibilitychange", handleSync);
    };
  }, [workspaceId]);
}