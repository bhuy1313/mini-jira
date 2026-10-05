import { beforeEach, describe, expect, it, vi } from "vitest";

import { createR2Storage } from "./r2-attachment-storage";
import { getAttachmentStorageDriverName } from "./attachment-storage";

const mockSend = vi.fn();

vi.mock("@aws-sdk/client-s3", () => {
  return {
    S3Client: vi.fn(function () {
      return { send: mockSend };
    }),
    PutObjectCommand: vi.fn(function (input) {
      return { type: "PutObject", input };
    }),
    GetObjectCommand: vi.fn(function (input) {
      return { type: "GetObject", input };
    }),
    DeleteObjectCommand: vi.fn(function (input) {
      return { type: "DeleteObject", input };
    }),
  };
});

describe("R2AttachmentStorage", () => {
  const config = {
    accountId: "test-account",
    accessKeyId: "test-key",
    secretAccessKey: "test-secret",
    bucketName: "test-bucket",
  };

  const storage = createR2Storage(config);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("saves object to R2 bucket via PutObjectCommand", async () => {
    mockSend.mockResolvedValueOnce({});

    const data = new Uint8Array([1, 2, 3]);
    await storage.save({
      storageKey: "task-1/sample.png",
      data,
      mimeType: "image/png",
    });

    expect(mockSend).toHaveBeenCalledTimes(1);
    const command = mockSend.mock.calls[0][0];
    expect(command.type).toBe("PutObject");
    expect(command.input).toEqual({
      Bucket: "test-bucket",
      Key: "task-1/sample.png",
      Body: data,
      ContentType: "image/png",
    });
  });

  it("reads object bytes from R2 via GetObjectCommand", async () => {
    const expectedBytes = new Uint8Array([10, 20, 30]);
    mockSend.mockResolvedValueOnce({
      Body: {
        transformToByteArray: vi.fn().mockResolvedValueOnce(expectedBytes),
      },
    });

    const result = await storage.read("task-1/sample.png");

    expect(mockSend).toHaveBeenCalledTimes(1);
    const command = mockSend.mock.calls[0][0];
    expect(command.type).toBe("GetObject");
    expect(command.input).toEqual({
      Bucket: "test-bucket",
      Key: "task-1/sample.png",
    });
    expect(result).toEqual(expectedBytes);
  });

  it("returns null when object does not exist (NoSuchKey)", async () => {
    const notFoundError = new Error("Not found");
    notFoundError.name = "NoSuchKey";
    mockSend.mockRejectedValueOnce(notFoundError);

    const result = await storage.read("non-existent-key");
    expect(result).toBeNull();
  });

  it("returns null when object returns 404 httpStatusCode", async () => {
    const errorWith404 = {
      $metadata: { httpStatusCode: 404 },
    };
    mockSend.mockRejectedValueOnce(errorWith404);

    const result = await storage.read("missing-key");
    expect(result).toBeNull();
  });

  it("rethrows unexpected errors on read", async () => {
    const fatalError = new Error("Connection refused");
    mockSend.mockRejectedValueOnce(fatalError);

    await expect(storage.read("some-key")).rejects.toThrow("Connection refused");
  });

  it("deletes object from R2 via DeleteObjectCommand", async () => {
    mockSend.mockResolvedValueOnce({});

    await storage.delete("task-1/sample.png");

    expect(mockSend).toHaveBeenCalledTimes(1);
    const command = mockSend.mock.calls[0][0];
    expect(command.type).toBe("DeleteObject");
    expect(command.input).toEqual({
      Bucket: "test-bucket",
      Key: "task-1/sample.png",
    });
  });

  it("ignores NoSuchKey when deleting non-existent object", async () => {
    const notFoundError = new Error("Not found");
    notFoundError.name = "NoSuchKey";
    mockSend.mockRejectedValueOnce(notFoundError);

    await expect(storage.delete("already-deleted")).resolves.toBeUndefined();
  });
});

describe("AttachmentStorage Dispatcher Driver Resolution", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  it("resolves to 'r2' when all 4 R2 environment variables are set", () => {
    process.env.R2_ACCOUNT_ID = "acc-123";
    process.env.R2_ACCESS_KEY_ID = "key-123";
    process.env.R2_SECRET_ACCESS_KEY = "sec-123";
    process.env.R2_BUCKET_NAME = "bucket-123";

    expect(getAttachmentStorageDriverName()).toBe("r2");
  });

  it("resolves to 'local' in development even without R2 vars", () => {
    delete process.env.R2_ACCOUNT_ID;
    delete process.env.R2_ACCESS_KEY_ID;
    delete process.env.R2_SECRET_ACCESS_KEY;
    delete process.env.R2_BUCKET_NAME;
    delete process.env.ATTACHMENT_UPLOAD_DIR;
    process.env.NODE_ENV = "development";

    expect(getAttachmentStorageDriverName()).toBe("local");
  });

  it("resolves to 'local' when ATTACHMENT_UPLOAD_DIR is set (self-hosted)", () => {
    delete process.env.R2_ACCOUNT_ID;
    process.env.ATTACHMENT_UPLOAD_DIR = "/mnt/data/uploads";
    process.env.NODE_ENV = "production";

    expect(getAttachmentStorageDriverName()).toBe("local");
  });

  it("resolves to 'noop' on production serverless without any storage config", () => {
    delete process.env.R2_ACCOUNT_ID;
    delete process.env.R2_ACCESS_KEY_ID;
    delete process.env.R2_SECRET_ACCESS_KEY;
    delete process.env.R2_BUCKET_NAME;
    delete process.env.ATTACHMENT_UPLOAD_DIR;
    process.env.NODE_ENV = "production";

    expect(getAttachmentStorageDriverName()).toBe("noop");
  });
});

