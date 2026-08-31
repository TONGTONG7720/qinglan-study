import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { Buffer } from "node:buffer";
import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";

const StorageConfigSchema = z.object({
  endpoint: z.url(),
  region: z.string().trim().min(1).max(120),
  bucket: z.string().trim().min(3).max(63),
  accessKeyId: z.string().trim().min(3).max(128),
  secretAccessKey: z.string().min(8).max(512),
  forcePathStyle: z.enum(["true", "false"]).transform((value) => value === "true"),
  uploadTtlSeconds: z.coerce.number().int().min(60).max(900),
  readTtlSeconds: z.coerce.number().int().min(30).max(300),
  retentionDays: z.coerce.number().int().min(1).max(90),
  serverSideEncryption: z.enum(["none", "AES256"]),
}).strict();

type StorageConfig = z.infer<typeof StorageConfigSchema>;

export interface UploadGrant {
  method: "PUT";
  url: string;
  headers: Record<string, string>;
  expiresAt: Date;
}

export interface UploadDeclaration {
  key: string;
  mimeType: "image/jpeg" | "image/png" | "image/webp";
  sha256: string;
  width: number;
  height: number;
}

export interface StoredObjectHead {
  contentLength: number;
  contentType: string;
  etag: string | null;
  versionId: string | null;
  serverSideEncryption: string | null;
  metadata: Record<string, string>;
}

export interface StoredObjectWriteReceipt {
  etag: string;
  versionId: string | null;
  requestId: string | null;
}

export interface StoredObjectDeleteReceipt {
  requestId: string | null;
  versionId: string | null;
  deleteMarker: boolean;
  absentConfirmed: true;
}

function storageUnavailable(): never {
  throw new ServiceUnavailableException();
}

function notFoundError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const named = "name" in error && (error.name === "NotFound" || error.name === "NoSuchKey");
  if (named) return true;
  if (!("$metadata" in error) || typeof error.$metadata !== "object" || error.$metadata === null) return false;
  return "httpStatusCode" in error.$metadata && error.$metadata.httpStatusCode === 404;
}

@Injectable()
export class S3ObjectStorageService {
  private lastSuccessfulProbeAt = 0;
  private activeProbe: Promise<void> | null = null;

  isEnabled(): boolean {
    return process.env.OBJECT_STORAGE_PROVIDER === "s3";
  }

  retentionExpiresAt(now = new Date()): Date {
    const days = this.configuration().retentionDays;
    return new Date(now.getTime() + days * 24 * 60 * 60 * 1_000);
  }

  async createUploadGrant(declaration: UploadDeclaration, now = new Date()): Promise<UploadGrant> {
    const config = this.configuration();
    const checksum = Buffer.from(declaration.sha256, "hex").toString("base64");
    const command = new PutObjectCommand({
      Bucket: config.bucket,
      Key: declaration.key,
      ContentType: declaration.mimeType,
      IfNoneMatch: "*",
      ChecksumSHA256: checksum,
      Metadata: {
        sha256: declaration.sha256,
        "declared-width": String(declaration.width),
        "declared-height": String(declaration.height),
      },
      ServerSideEncryption: config.serverSideEncryption === "AES256" ? "AES256" : undefined,
    });
    const url = await getSignedUrl(this.client(config), command, {
      expiresIn: config.uploadTtlSeconds,
      signableHeaders: new Set(["content-type", "if-none-match"]),
      unhoistableHeaders: new Set([
        "x-amz-checksum-sha256",
        "x-amz-meta-sha256",
        "x-amz-meta-declared-width",
        "x-amz-meta-declared-height",
        "x-amz-server-side-encryption",
      ]),
    });
    const headers: Record<string, string> = {
      "content-type": declaration.mimeType,
      "if-none-match": "*",
      "x-amz-checksum-sha256": checksum,
      "x-amz-meta-sha256": declaration.sha256,
      "x-amz-meta-declared-width": String(declaration.width),
      "x-amz-meta-declared-height": String(declaration.height),
    };
    if (config.serverSideEncryption === "AES256") {
      headers["x-amz-server-side-encryption"] = "AES256";
    }
    return {
      method: "PUT",
      url,
      headers,
      expiresAt: new Date(now.getTime() + config.uploadTtlSeconds * 1_000),
    };
  }

  async createReadGrant(
    key: string,
    versionId: string | null,
    now = new Date(),
  ): Promise<{ url: string; expiresAt: Date }> {
    const config = this.configuration();
    const url = await getSignedUrl(this.client(config), new GetObjectCommand({
      Bucket: config.bucket,
      Key: key,
      VersionId: versionId ?? undefined,
    }), { expiresIn: config.readTtlSeconds });
    return {
      url,
      expiresAt: new Date(now.getTime() + config.readTtlSeconds * 1_000),
    };
  }

  async headObject(key: string, versionId?: string | null): Promise<StoredObjectHead | null> {
    const config = this.configuration();
    try {
      const result = await this.client(config).send(new HeadObjectCommand({
        Bucket: config.bucket,
        Key: key,
        VersionId: versionId ?? undefined,
      }));
      if (result.ContentLength === undefined || result.ContentType === undefined) {
        throw new Error("OBJECT_METADATA_INCOMPLETE");
      }
      return {
        contentLength: result.ContentLength,
        contentType: result.ContentType,
        etag: result.ETag ?? null,
        versionId: result.VersionId ?? null,
        serverSideEncryption: result.ServerSideEncryption ?? null,
        metadata: result.Metadata ?? {},
      };
    } catch (error) {
      if (notFoundError(error)) return null;
      throw error;
    }
  }

  async readObject(key: string, maximumBytes: number, versionId?: string | null): Promise<Uint8Array> {
    const config = this.configuration();
    const result = await this.client(config).send(new GetObjectCommand({
      Bucket: config.bucket,
      Key: key,
      VersionId: versionId ?? undefined,
    }));
    if (result.ContentLength === undefined || result.ContentLength > maximumBytes || result.Body === undefined) {
      throw new Error("OBJECT_SIZE_INVALID");
    }
    const bytes = await result.Body.transformToByteArray();
    if (bytes.byteLength > maximumBytes || bytes.byteLength !== result.ContentLength) {
      throw new Error("OBJECT_SIZE_INVALID");
    }
    return bytes;
  }

  async writeVerifiedObject(input: {
    key: string;
    body: Uint8Array;
    mimeType: string;
    sha256: string;
  }): Promise<StoredObjectWriteReceipt> {
    const config = this.configuration();
    const result = await this.client(config).send(new PutObjectCommand({
      Bucket: config.bucket,
      Key: input.key,
      Body: input.body,
      ContentLength: input.body.byteLength,
      ContentType: input.mimeType,
      ChecksumSHA256: Buffer.from(input.sha256, "hex").toString("base64"),
      Metadata: { sha256: input.sha256, verified: "true" },
      ServerSideEncryption: config.serverSideEncryption === "AES256" ? "AES256" : undefined,
    }));
    if (result.ETag === undefined) throw new Error("OBJECT_WRITE_RECEIPT_MISSING");
    return {
      etag: result.ETag,
      versionId: result.VersionId ?? null,
      requestId: result.$metadata.requestId ?? null,
    };
  }

  async deleteObject(key: string, versionId?: string | null): Promise<StoredObjectDeleteReceipt> {
    const config = this.configuration();
    const current = versionId === undefined || versionId === null
      ? await this.headObject(key)
      : null;
    if ((versionId === undefined || versionId === null) && current === null) {
      return {
        requestId: null,
        versionId: null,
        deleteMarker: false,
        absentConfirmed: true,
      };
    }
    const effectiveVersionId = versionId ?? current?.versionId ?? null;
    const result = await this.client(config).send(new DeleteObjectCommand({
      Bucket: config.bucket,
      Key: key,
      VersionId: effectiveVersionId ?? undefined,
    }));
    const remaining = await this.headObject(key, effectiveVersionId);
    if (remaining !== null) throw new Error("OBJECT_DELETE_NOT_CONFIRMED");
    return {
      requestId: result.$metadata.requestId ?? null,
      versionId: result.VersionId ?? effectiveVersionId,
      deleteMarker: result.DeleteMarker === true,
      absentConfirmed: true,
    };
  }

  async probe(): Promise<void> {
    if (Date.now() - this.lastSuccessfulProbeAt < 60_000) return;
    if (this.activeProbe !== null) {
      await this.activeProbe;
      return;
    }
    const probe = this.runProbe();
    this.activeProbe = probe;
    try {
      await probe;
      this.lastSuccessfulProbeAt = Date.now();
    } finally {
      this.activeProbe = null;
    }
  }

  private async runProbe(): Promise<void> {
    const config = this.configuration();
    await this.client(config).send(new HeadBucketCommand({ Bucket: config.bucket }));
    const key = `incoming/system-health/${randomUUID()}`;
    const body = Buffer.from("qinglang-private-storage-probe-v1", "utf8");
    const sha256 = createHash("sha256").update(body).digest("hex");
    let versionId: string | null = null;
    try {
      const write = await this.writeVerifiedObject({ key, body, mimeType: "application/octet-stream", sha256 });
      versionId = write.versionId;
      const head = await this.headObject(key, versionId);
      if (
        head?.contentLength !== body.byteLength
        || (config.serverSideEncryption === "AES256" && head.serverSideEncryption !== "AES256")
      ) {
        throw new Error("OBJECT_STORAGE_PROBE_METADATA_FAILED");
      }
      const read = await this.readObject(key, body.byteLength, versionId);
      if (!Buffer.from(read).equals(body)) throw new Error("OBJECT_STORAGE_PROBE_READ_FAILED");
    } finally {
      await this.deleteObject(key, versionId);
    }
  }

  private configuration(): StorageConfig {
    if (!this.isEnabled()) return storageUnavailable();
    return StorageConfigSchema.parse({
      endpoint: process.env.OBJECT_STORAGE_ENDPOINT,
      region: process.env.OBJECT_STORAGE_REGION,
      bucket: process.env.OBJECT_STORAGE_BUCKET,
      accessKeyId: process.env.OBJECT_STORAGE_ACCESS_KEY_ID,
      secretAccessKey: process.env.OBJECT_STORAGE_SECRET_ACCESS_KEY,
      forcePathStyle: process.env.OBJECT_STORAGE_FORCE_PATH_STYLE ?? "false",
      uploadTtlSeconds: process.env.OBJECT_STORAGE_UPLOAD_TTL_SECONDS ?? "300",
      readTtlSeconds: process.env.OBJECT_STORAGE_READ_TTL_SECONDS ?? "120",
      retentionDays: process.env.OBJECT_STORAGE_RETENTION_DAYS ?? "30",
      serverSideEncryption: process.env.OBJECT_STORAGE_SSE ?? "AES256",
    });
  }

  private client(config: StorageConfig): S3Client {
    return new S3Client({
      endpoint: config.endpoint,
      region: config.region,
      forcePathStyle: config.forcePathStyle,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }
}
