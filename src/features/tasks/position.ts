/**
 * Fractional ordering cho task position trong một cột Kanban (BR-017, FR-052, FR-053).
 *
 * Position là số thực (lưu Decimal 40,20). Chèn giữa hai hàng xóm tính trung
 * điểm; chỉ rebalance cùng cột khi không còn khoảng số hợp lệ.
 */

/** Khoảng cách tối thiểu giữa hai position để còn có thể chèn trung điểm an toàn. */
export const MIN_GAP = 1e-9;

export interface InsertionInput {
  left: number | null;
  right: number | null;
}

export type InsertionResult =
  | { kind: "placed"; position: number }
  | { kind: "rebalance" };

/**
 * Tính position để chèn task vào giữa hai hàng xóm (theo thứ tự duy nhất của cột).
 * - không có hàng xóm nào  → position 0
 * - chỉ có phải (chèn đầu) → right - 1 (có thể âm)
 * - chỉ có trái (chèn cuối) → left + 1
 * - cả hai: trung điểm, nếu gap quá nhỏ → rebalance
 */
export function insertionPosition(input: InsertionInput): InsertionResult {
  const { left, right } = input;
  if (left === null && right === null) return { kind: "placed", position: 0 };
  if (left === null) return { kind: "placed", position: (right ?? 0) - 1 };
  if (right === null) return { kind: "placed", position: (left ?? 0) + 1 };
  if (right - left >= MIN_GAP * 2) {
    return { kind: "placed", position: (left + right) / 2 };
  }
  return { kind: "rebalance" };
}

/**
 * Rebalance toàn bộ cột về các số nguyên đều nhau bắt đầu từ 0 (0,1,2,...),
 * đảm bảo lại còn khoảng trống cho các lần chèn sau (FR-053).
 */
export function rebalancePositions(count: number): number[] {
  return Array.from({ length: count }, (_, i) => i);
}
