/**
 * Lỗi authorization chuẩn hoá cho service layer. Dùng để phân biệt "không có
 * quyền" (mà không tiết lộ nguyên nhân) khỏi lỗi kinh doanh khác khi trả về API.
 */
export class UnauthorizedError extends Error {
  constructor(message = "You do not have permission to perform this action.") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

/** Ném UnauthorizedError nếu `allowed === false`. */
export function assertPermission(allowed: boolean, message?: string): void {
  if (!allowed) throw new UnauthorizedError(message);
}

/** Lỗi validate dữ liệu đầu vào hợp lệ về auth nhưng sai định dạng nghiệp vụ. */
export class ValidationError extends Error {
  constructor(message = "Invalid input.") {
    super(message);
    this.name = "ValidationError";
  }
}

/** Lỗi không tìm thấy tài nguyên. */
export class NotFoundError extends Error {
  constructor(message = "Resource not found.") {
    super(message);
    this.name = "NotFoundError";
  }
}

