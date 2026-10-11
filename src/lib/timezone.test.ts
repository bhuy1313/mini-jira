import { beforeEach, describe, expect, it } from "vitest";

import {
  appTimeZone,
  resetTimeZoneCache,
  toZoneDateString,
  zoneMidnightInstant,
  zoneParts,
} from "./timezone";

beforeEach(() => {
  resetTimeZoneCache();
  delete process.env.APP_TIMEZONE;
});

describe("appTimeZone", () => {
  it("mặc định Asia/Ho_Chi_Minh", () => {
    expect(appTimeZone()).toBe("Asia/Ho_Chi_Minh");
  });

  it("APP_TIMEZONE hợp lệ được dùng", () => {
    process.env.APP_TIMEZONE = "UTC";
    expect(appTimeZone()).toBe("UTC");
  });

  it("APP_TIMEZONE sai rơi về mặc định", () => {
    process.env.APP_TIMEZONE = "Mars/Olympus";
    expect(appTimeZone()).toBe("Asia/Ho_Chi_Minh");
  });
});

describe("zone bucketing — đúng mọi TZ của server", () => {
  // 2026-10-10T00:30+07:00 — nửa đêm VN nhưng vẫn Oct 9 ở UTC.
  const boundary = new Date("2026-10-10T00:30:00+07:00");

  it("toZoneDateString ra ngày VN, không phải ngày UTC", () => {
    expect(toZoneDateString(boundary)).toBe("2026-10-10");
    expect(toZoneDateString(boundary, "UTC")).toBe("2026-10-09");
  });

  it("zoneParts weekday đúng (Oct 10 2026 là thứ Bảy)", () => {
    expect(zoneParts(boundary).weekday).toBe(6);
    expect(zoneParts(boundary).iso).toBe("2026-10-10");
  });

  it("zoneMidnightInstant quy về đúng instant", () => {
    const midnight = zoneMidnightInstant(2026, 10, 10);
    // 00:00 +07 = 17:00 UTC hôm trước
    expect(midnight.toISOString()).toBe("2026-10-09T17:00:00.000Z");
    expect(toZoneDateString(midnight)).toBe("2026-10-10");
  });
});
