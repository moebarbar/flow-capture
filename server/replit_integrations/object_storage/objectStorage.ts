import { Storage, File } from "@google-cloud/storage";
import { Response } from "express";
import { randomUUID } from "crypto";
import {
  ObjectAclPolicy,
  ObjectPermission,
  canAccessObject,
  getObjectAclPolicy,
  setObjectAclPolicy,
} from "./objectAcl";

const REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";

type StorageMode = "service-account" | "adc" | "replit-sidecar" | "unconfigured";

/**
 * Credential resolution, most portable first:
 * 1. GCS_SERVICE_ACCOUNT_JSON (or GOOGLE_APPLICATION_CREDENTIALS_JSON) — the
 *    service-account key JSON pasted into an env var. Works anywhere (Railway).
 * 2. GOOGLE_APPLICATION_CREDENTIALS — standard ADC file path.
 * 3. Replit sidecar (only when running on Replit, detected via REPL_ID).
 */
function createStorageClient(): { client: Storage; mode: StorageMode } {
  const saJson =
    process.env.GCS_SERVICE_ACCOUNT_JSON ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;

  if (saJson) {
    let credentials: Record<string, any>;
    try {
      credentials = JSON.parse(saJson);
    } catch {
      throw new Error(
        "GCS_SERVICE_ACCOUNT_JSON is not valid JSON — paste the full service-account key file contents"
      );
    }
    return {
      client: new Storage({ credentials, projectId: credentials.project_id }),
      mode: "service-account",
    };
  }

  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return { client: new Storage(), mode: "adc" };
  }

  if (process.env.REPL_ID) {
    return {
      client: new Storage({
        credentials: {
          audience: "replit",
          subject_token_type: "access_token",
          token_url: `${REPLIT_SIDECAR_ENDPOINT}/token`,
          type: "external_account",
          credential_source: {
            url: `${REPLIT_SIDECAR_ENDPOINT}/credential`,
            format: {
              type: "json",
              subject_token_field_name: "access_token",
            },
          },
          universe_domain: "googleapis.com",
        },
        projectId: "",
      }),
      mode: "replit-sidecar",
    };
  }

  // No credentials available. Constructing a bare client is safe (no network
  // I/O); actual calls fail and callers should gate on isObjectStorageConfigured().
  return { client: new Storage(), mode: "unconfigured" };
}

const { client: storageClient, mode: storageMode } = createStorageClient();

export const objectStorageClient = storageClient;
export { storageMode };

/** Bucket that holds all app-managed objects. */
export function getDefaultBucketName(): string {
  const explicit =
    process.env.GCS_BUCKET || process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
  if (explicit) return explicit;

  // Legacy Replit layout: PRIVATE_OBJECT_DIR is "/<bucket>/<prefix>"
  const privateDir = process.env.PRIVATE_OBJECT_DIR;
  if (privateDir) {
    const bucket = privateDir.replace(/^\/+/, "").split("/")[0];
    if (bucket) return bucket;
  }

  throw new Error(
    "Object storage not configured: set GCS_BUCKET (bucket name) and GCS_SERVICE_ACCOUNT_JSON (service-account key JSON)"
  );
}

/**
 * Key prefix inside the bucket for app-managed objects. Empty for new setups;
 * derived from PRIVATE_OBJECT_DIR ("/<bucket>/<prefix>") for legacy Replit
 * deployments so existing objects keep resolving.
 */
export function getPrivateKeyPrefix(): string {
  const privateDir = process.env.PRIVATE_OBJECT_DIR;
  if (!privateDir) return "";
  const parts = privateDir.replace(/^\/+/, "").split("/");
  const prefix = parts.slice(1).join("/").replace(/\/+$/, "");
  return prefix ? `${prefix}/` : "";
}

export function isObjectStorageConfigured(): boolean {
  if (storageMode === "unconfigured") return false;
  try {
    getDefaultBucketName();
    return true;
  } catch {
    return false;
  }
}

async function signObjectURL({
  bucketName,
  objectName,
  method,
  ttlSec,
}: {
  bucketName: string;
  objectName: string;
  method: "GET" | "PUT" | "DELETE" | "HEAD";
  ttlSec: number;
}): Promise<string> {
  if (storageMode === "replit-sidecar") {
    const request = {
      bucket_name: bucketName,
      object_name: objectName,
      method,
      expires_at: new Date(Date.now() + ttlSec * 1000).toISOString(),
    };
    const response = await fetch(
      `${REPLIT_SIDECAR_ENDPOINT}/object-storage/signed-object-url`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      }
    );
    if (!response.ok) {
      throw new Error(
        `Failed to sign object URL via Replit sidecar (status ${response.status})`
      );
    }
    const { signed_url: signedURL } = await response.json();
    return signedURL;
  }

  // Standard V4 signing — requires service-account credentials.
  // Content-Type is intentionally not bound so any client can upload.
  const action =
    method === "PUT" ? "write" : method === "DELETE" ? "delete" : "read";
  const [url] = await objectStorageClient
    .bucket(bucketName)
    .file(objectName)
    .getSignedUrl({
      version: "v4",
      action,
      expires: Date.now() + ttlSec * 1000,
    });
  return url;
}

export class ObjectNotFoundError extends Error {
  constructor() {
    super("Object not found");
    this.name = "ObjectNotFoundError";
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

// The object storage service is used to interact with the object storage service.
export class ObjectStorageService {
  constructor() {}

  // Gets the public object search paths (legacy Replit public buckets).
  getPublicObjectSearchPaths(): Array<string> {
    const pathsStr = process.env.PUBLIC_OBJECT_SEARCH_PATHS || "";
    return Array.from(
      new Set(
        pathsStr
          .split(",")
          .map((path) => path.trim())
          .filter((path) => path.length > 0)
      )
    );
  }

  // Search for a public object from the search paths.
  async searchPublicObject(filePath: string): Promise<File | null> {
    for (const searchPath of this.getPublicObjectSearchPaths()) {
      const fullPath = `${searchPath}/${filePath}`;

      // Full path format: /<bucket_name>/<object_name>
      const { bucketName, objectName } = parseObjectPath(fullPath);
      const bucket = objectStorageClient.bucket(bucketName);
      const file = bucket.file(objectName);

      const [exists] = await file.exists();
      if (exists) {
        return file;
      }
    }

    return null;
  }

  // Downloads an object to the response.
  async downloadObject(file: File, res: Response, cacheTtlSec: number = 3600) {
    try {
      const [metadata] = await file.getMetadata();
      const aclPolicy = await getObjectAclPolicy(file);
      const isPublic = aclPolicy?.visibility !== "private";

      // Prevent stored-XSS: an attacker who uploads text/html or SVG must not
      // have it served inline same-origin. Only known-safe media renders inline;
      // everything else is neutralized and forced to download.
      const rawType = (metadata.contentType || "application/octet-stream").toLowerCase();
      const INLINE_SAFE = new Set([
        "image/png", "image/jpeg", "image/jpg", "image/gif", "image/webp",
        "audio/mpeg", "audio/mp3", "audio/wav", "audio/ogg", "video/mp4", "video/webm",
      ]);
      const isInlineSafe = INLINE_SAFE.has(rawType);
      const contentType = isInlineSafe ? rawType : "application/octet-stream";

      res.set({
        "Content-Type": contentType,
        "Content-Length": metadata.size,
        "X-Content-Type-Options": "nosniff",
        "Content-Disposition": isInlineSafe ? "inline" : "attachment",
        "Cache-Control": `${
          isPublic ? "public" : "private"
        }, max-age=${cacheTtlSec}`,
      });

      const stream = file.createReadStream();

      stream.on("error", (err) => {
        console.error("Stream error:", err);
        if (!res.headersSent) {
          res.status(500).json({ error: "Error streaming file" });
        }
      });

      stream.pipe(res);
    } catch (error) {
      console.error("Error downloading file:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Error downloading file" });
      }
    }
  }

  /**
   * Create a presigned upload target. The client PUTs the file to uploadURL;
   * objectPath is what gets stored in the DB and served via GET /objects/...
   */
  async createUploadTarget(): Promise<{ uploadURL: string; objectPath: string }> {
    const bucketName = getDefaultBucketName();
    const key = `uploads/${randomUUID()}`;
    const uploadURL = await signObjectURL({
      bucketName,
      objectName: `${getPrivateKeyPrefix()}${key}`,
      method: "PUT",
      ttlSec: 900,
    });
    return { uploadURL, objectPath: `/objects/${key}` };
  }

  // Back-compat: returns just the presigned URL.
  async getObjectEntityUploadURL(): Promise<string> {
    return (await this.createUploadTarget()).uploadURL;
  }

  /** Read an object (by /objects/... path or bare key) into a Buffer. */
  async readObjectBuffer(objectPathOrKey: string): Promise<Buffer> {
    const path = objectPathOrKey.startsWith("/objects/")
      ? objectPathOrKey
      : `/objects/${objectPathOrKey.replace(/^\/+/, "")}`;
    const file = await this.getObjectEntityFile(path);
    const [buffer] = await file.download();
    return buffer;
  }

  /** Write a buffer directly to storage. Returns the servable /objects/ path. */
  async saveObject(
    key: string,
    data: Buffer,
    contentType: string,
    metadata?: Record<string, string>
  ): Promise<string> {
    const bucket = objectStorageClient.bucket(getDefaultBucketName());
    const file = bucket.file(`${getPrivateKeyPrefix()}${key}`);
    await file.save(data, {
      contentType,
      metadata: {
        cacheControl: "public, max-age=31536000",
        ...(metadata ? { metadata } : {}),
      },
    });
    return `/objects/${key}`;
  }

  /** Signed read URL for direct access (e.g. audio playback). */
  async getSignedReadUrl(key: string, ttlSec: number): Promise<string> {
    return signObjectURL({
      bucketName: getDefaultBucketName(),
      objectName: `${getPrivateKeyPrefix()}${key}`,
      method: "GET",
      ttlSec,
    });
  }

  /** Delete an object by key (path without the /objects/ prefix). Best-effort. */
  async deleteObject(key: string): Promise<boolean> {
    try {
      const bucket = objectStorageClient.bucket(getDefaultBucketName());
      await bucket.file(`${getPrivateKeyPrefix()}${key}`).delete();
      return true;
    } catch {
      return false;
    }
  }

  // Gets the object entity file from the object path.
  async getObjectEntityFile(objectPath: string): Promise<File> {
    if (!objectPath.startsWith("/objects/")) {
      throw new ObjectNotFoundError();
    }

    // Normalize the key; tolerate historical double-prefixed paths
    // ("/objects//objects/uploads/x") produced by older extension builds.
    let key = objectPath.slice("/objects/".length).replace(/^\/+/, "");
    while (key.startsWith("objects/")) {
      key = key.slice("objects/".length).replace(/^\/+/, "");
    }
    if (!key) {
      throw new ObjectNotFoundError();
    }

    const bucket = objectStorageClient.bucket(getDefaultBucketName());
    const prefix = getPrivateKeyPrefix();
    const candidates = prefix ? [`${prefix}${key}`, key] : [key];
    for (const objectName of candidates) {
      const file = bucket.file(objectName);
      const [exists] = await file.exists();
      if (exists) {
        return file;
      }
    }
    throw new ObjectNotFoundError();
  }

  normalizeObjectEntityPath(rawPath: string): string {
    if (!rawPath.startsWith("https://storage.googleapis.com/")) {
      return rawPath;
    }

    // Signed URL → "/<bucket>/<objectName>"; strip bucket and private prefix.
    const url = new URL(rawPath);
    const segments = url.pathname.replace(/^\/+/, "").split("/");
    let key = segments.slice(1).join("/");

    const prefix = getPrivateKeyPrefix();
    if (prefix && key.startsWith(prefix)) {
      key = key.slice(prefix.length);
    }

    return key ? `/objects/${key}` : url.pathname;
  }

  // Tries to set the ACL policy for the object entity and return the normalized path.
  async trySetObjectEntityAclPolicy(
    rawPath: string,
    aclPolicy: ObjectAclPolicy
  ): Promise<string> {
    const normalizedPath = this.normalizeObjectEntityPath(rawPath);
    if (!normalizedPath.startsWith("/")) {
      return normalizedPath;
    }

    const objectFile = await this.getObjectEntityFile(normalizedPath);
    await setObjectAclPolicy(objectFile, aclPolicy);
    return normalizedPath;
  }

  // Checks if the user can access the object entity.
  async canAccessObjectEntity({
    userId,
    objectFile,
    requestedPermission,
  }: {
    userId?: string;
    objectFile: File;
    requestedPermission?: ObjectPermission;
  }): Promise<boolean> {
    return canAccessObject({
      userId,
      objectFile,
      requestedPermission: requestedPermission ?? ObjectPermission.READ,
    });
  }
}

export const objectStorageService = new ObjectStorageService();

function parseObjectPath(path: string): {
  bucketName: string;
  objectName: string;
} {
  if (!path.startsWith("/")) {
    path = `/${path}`;
  }
  const pathParts = path.split("/");
  if (pathParts.length < 3) {
    throw new Error("Invalid path: must contain at least a bucket name");
  }

  const bucketName = pathParts[1];
  const objectName = pathParts.slice(2).join("/");

  return {
    bucketName,
    objectName,
  };
}
