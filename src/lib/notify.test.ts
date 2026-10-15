import { beforeEach, describe, expect, it, vi } from "vitest";

import { toast } from "react-toastify";
import {
  NAV_LOADING_ID,
  notifyCreated,
  notifyDeleted,
  notifyError,
  notifyMoved,
  notifyNavigationDone,
  notifyNavigationStart,
  notifyUpdated,
} from "./notify";

vi.mock("react-toastify", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(),
    dismiss: vi.fn(),
    isActive: vi.fn(),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("notify — text cố định, không nội dung user-generated", () => {
  it("CRUD/move dùng mẫu cố định theo loại", () => {
    notifyCreated("task");
    notifyUpdated("comment");
    notifyDeleted("label");
    notifyMoved("task");
    expect(toast.success).toHaveBeenNthCalledWith(1, "Task created");
    expect(toast.success).toHaveBeenNthCalledWith(2, "Comment updated");
    expect(toast.success).toHaveBeenNthCalledWith(3, "Label deleted");
    expect(toast.success).toHaveBeenNthCalledWith(4, "Task moved");
  });

  it("không có API nào nhận tên/title động", () => {
    // Khóa quy ước bằng type: helper chỉ nhận NotifyKind + message lỗi hệ thống.
    // Nếu ai đó thêm tham số title/name vào đây, test này phải được cập nhật
    // có chủ đích (và E2E strict-violation sẽ nhắc).
    const fns = [notifyCreated, notifyUpdated, notifyDeleted, notifyMoved];
    for (const fn of fns) {
      expect(fn.length).toBe(1);
    }
  });

  it("notifyError fallback khi thiếu message", () => {
    notifyError();
    expect(toast.error).toHaveBeenCalledWith("Something went wrong. Please try again.");
    notifyError("Network down");
    expect(toast.error).toHaveBeenCalledWith("Network down");
  });

  it("navigation loading dùng id cố định, text cố định", () => {
    vi.mocked(toast.isActive).mockReturnValue(false);
    notifyNavigationStart();
    expect(toast.loading).toHaveBeenCalledWith("Đang tải trang...", {
      toastId: NAV_LOADING_ID,
      autoClose: false,
      closeButton: false,
    });
    notifyNavigationDone();
    expect(toast.dismiss).toHaveBeenCalledWith(NAV_LOADING_ID);
  });

  it("không spam toast khi navigation đã pending", () => {
    vi.mocked(toast.isActive).mockReturnValue(true);
    const id = notifyNavigationStart();
    expect(toast.loading).not.toHaveBeenCalled();
    expect(id).toBe(NAV_LOADING_ID);
  });
});
