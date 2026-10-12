import { describe, expect, it } from "vitest";

import { isAttachmentsEnabled } from "./attachment-storage";

describe("isAttachmentsEnabled — freeze đính kèm khi không có storage", () => {
  it("flag tường minh thắng driver", () => {
    const prevFlag = process.env.ATTACHMENTS_ENABLED;
    try {
      process.env.ATTACHMENTS_ENABLED = "1";
      expect(isAttachmentsEnabled()).toBe(true);
      process.env.ATTACHMENTS_ENABLED = "0";
      expect(isAttachmentsEnabled()).toBe(false);
    } finally {
      if (prevFlag === undefined) delete process.env.ATTACHMENTS_ENABLED;
      else process.env.ATTACHMENTS_ENABLED = prevFlag;
    }
  });

  it("mặc định bám driver (vitest chạy NODE_ENV=test → local → bật)", () => {
    const prevFlag = process.env.ATTACHMENTS_ENABLED;
    try {
      delete process.env.ATTACHMENTS_ENABLED;
      expect(isAttachmentsEnabled()).toBe(true);
    } finally {
      if (prevFlag === undefined) delete process.env.ATTACHMENTS_ENABLED;
      else process.env.ATTACHMENTS_ENABLED = prevFlag;
    }
  });
});
