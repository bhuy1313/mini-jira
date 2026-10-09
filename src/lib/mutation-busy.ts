/**
 * Global in-flight mutation flag for client Server Action calls.
 *
 * Problem: the board's live/poll refresh loop fires `router.refresh()`
 * on a timer. When a refresh GET races a mutation POST on a slow dev
 * server, one of the streams dies ("destination stream closed early")
 * and the mutation response is lost — the server may even have committed
 * while the client never finds out (stale optimistic state, failed E2E).
 *
 * Every fire-and-forget mutation should bracket its server call with
 * begin/end so refresh schedulers can back off while requests are in
 * flight. Board-level drag/mutate flows additionally keep their local
 * `isMutating` state; this flag covers drawer and child mutations
 * (comments, labels, attachments, worklogs, subtasks, custom fields)
 * that the board state cannot see.
 */
let count = 0;

export function beginMutation(): void {
  count += 1;
}

export function endMutation(): void {
  count = Math.max(0, count - 1);
}

export function isMutationBusy(): boolean {
  return count > 0;
}

/**
 * Bracket a NON-idempotent server call (creates, uploads, deletes) with
 * the busy flag so refresh loops back off. Unlike `withActionRetry` this
 * never retries — a retried create would duplicate the row.
 */
export async function withMutation<T>(fn: () => Promise<T>): Promise<T> {
  beginMutation();
  try {
    return await fn();
  } finally {
    endMutation();
  }
}
