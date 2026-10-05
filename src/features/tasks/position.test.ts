import { describe, expect, it } from "vitest";

import { insertionPosition, rebalancePositions } from "./position";

describe("position — fractional ordering (FR-052, FR-053)", () => {
  it("không có hàng xóm nào → position 0", () => {
    expect(insertionPosition({ left: null, right: null })).toEqual({ kind: "placed", position: 0 });
  });

  it("chèn đầu cột (chỉ có right) → right - 1", () => {
    expect(insertionPosition({ left: null, right: 5 })).toEqual({ kind: "placed", position: 4 });
    // cho phép âm khi right đã là 0
    expect(insertionPosition({ left: null, right: 0 })).toEqual({ kind: "placed", position: -1 });
  });

  it("chèn cuối cột (chỉ có left) → left + 1", () => {
    expect(insertionPosition({ left: 3, right: null })).toEqual({ kind: "placed", position: 4 });
  });

  it("chèn giữa hai hàng xóm → trung điểm", () => {
    expect(insertionPosition({ left: 0, right: 10 })).toEqual({ kind: "placed", position: 5 });
  });

  it("gap quá nhỏ → rebalance (hết khoảng hợp lệ)", () => {
    const result = insertionPosition({ left: 0, right: 1e-10 });
    expect(result).toEqual({ kind: "rebalance" });
  });

  it("rebalance cột về các số nguyên 0..n-1", () => {
    expect(rebalancePositions(3)).toEqual([0, 1, 2]);
  });
});
