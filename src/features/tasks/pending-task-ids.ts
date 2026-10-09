/**
 * Registry ánh xạ optimistic temp-id (`temp-…`) sang real id từ server.
 *
 * Đặt vấn đề: Kanban tạo task lạc quan — card temp-id hiện ngay, id thật
 * chỉ có khi `createTaskAction` resolve. Thao tác tiếp theo tới quá nhanh
 * (move/rename/assign trong test nhanh hoặc user nhanh tay) sẽ gửi temp-id
 * lên server và ăn `UnauthorizedError` đúng luật. Registry này cho phép
 * mọi mutation await id thật trước khi bắn request.
 *
 * Chỉ dùng phía client (vòng đời tab browser). Server không bao giờ
 * đọc registry này.
 */
const pending = new Map<string, Promise<string | null>>();

export function trackPendingTask(
  tempId: string,
  realIdPromise: Promise<string | null>,
): void {
  pending.set(tempId, realIdPromise);
}

export function resolvePendingTask(tempId: string, realId: string | null): void {
  pending.set(tempId, Promise.resolve(realId));
}

/** Trả về id thật; id thường đi qua nguyên vẹn, temp-id chờ create resolve. */
export async function resolveRealTaskId(taskId: string): Promise<string> {
  if (!taskId.startsWith("temp-")) return taskId;
  try {
    return (await pending.get(taskId)) ?? taskId;
  } catch {
    return taskId;
  }
}
