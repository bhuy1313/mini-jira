import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

import type { AttachmentStorage } from "./attachment-service";

export interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
}

export function createR2Storage(config: R2Config): AttachmentStorage {
  const client = new S3Client({
    region: "auto",
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });

  return {
    async save(input) {
      await client.send(
        new PutObjectCommand({
          Bucket: config.bucketName,
          Key: input.storageKey,
          Body: input.data,
          ContentType: input.mimeType,
        }),
      );
    },

    async read(storageKey) {
      try {
        const response = await client.send(
          new GetObjectCommand({
            Bucket: config.bucketName,
            Key: storageKey,
          }),
        );

        if (!response.Body) {
          return null;
        }

        return await response.Body.transformToByteArray();
      } catch (error: unknown) {
        const err = error as { name?: string; $metadata?: { httpStatusCode?: number } };
        if (err.name === "NoSuchKey" || err.$metadata?.httpStatusCode === 404) {
          return null;
        }
        throw error;
      }
    },

    async delete(storageKey) {
      try {
        await client.send(
          new DeleteObjectCommand({
            Bucket: config.bucketName,
            Key: storageKey,
          }),
        );
      } catch (error: unknown) {
        const err = error as { name?: string; $metadata?: { httpStatusCode?: number } };
        if (err.name === "NoSuchKey" || err.$metadata?.httpStatusCode === 404) {
          return;
        }
        throw error;
      }
    },
  };
}
