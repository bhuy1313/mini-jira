import { beginMutation, endMutation } from "@/lib/mutation-busy";

/**
 * Retry helper for fire-and-forget Server Action calls.
 *
 * Rationale: in slow environments (dev server under load, overlapping
 * `router.refresh()` streams) an action POST can abort at the transport
 * level ("destination stream closed early") or hang past any reasonable
 * budget AFTER the request was sent. Such failures throw — or never
 * settle — instead of resolving to `{ error }`.
 *
 * Retrying is only safe for IDEMPOTENT set-operations (field values,
 * moves, toggles). Never use it for creates/uploads — a retried create
 * would duplicate the row. `{ error }` results are returned as-is and
 * never retried.
 *
 * Every attempt is bracketed with the global mutation-busy flag so live
 * refresh loops back off while requests are in flight.
 */
export async function withActionRetry<T>(
  fn: () => Promise<T>,
  options?: { retries?: number; timeoutMs?: number },
): Promise<T> {
  const retries = options?.retries ?? 1;
  const timeoutMs = options?.timeoutMs ?? 8000;
  let lastError: unknown = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    beginMutation();
    try {
      return await withTimeout(fn(), timeoutMs);
    } catch (err) {
      lastError = err;
    } finally {
      endMutation();
    }
  }
  throw lastError;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`Action timed out after ${ms}ms`));
    }, ms);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer !== null) clearTimeout(timer);
  });
}
