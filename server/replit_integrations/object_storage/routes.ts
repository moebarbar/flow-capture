import type { Express } from "express";
import { isAuthenticated } from "../auth/replitAuth";
import {
  objectStorageService,
  isObjectStorageConfigured,
  ObjectNotFoundError,
} from "./objectStorage";

/**
 * Object storage routes.
 *
 * Upload flow:
 * 1. POST /api/uploads/request-url (authenticated) → presigned PUT URL + objectPath
 * 2. Client PUTs the file directly to the presigned URL
 * 3. Client stores objectPath (e.g. "/objects/uploads/<uuid>") in the DB
 *
 * Serving: GET /objects/* streams from the bucket. Paths are unguessable UUIDs
 * and screenshots must render on public share/embed pages, so reads are public.
 */
export function registerObjectStorageRoutes(app: Express): void {
  app.post("/api/uploads/request-url", isAuthenticated, async (req, res) => {
    try {
      if (!isObjectStorageConfigured()) {
        return res.status(503).json({
          error:
            "Object storage is not configured. Set GCS_BUCKET and GCS_SERVICE_ACCOUNT_JSON.",
        });
      }

      const { name, size, contentType } = req.body;

      if (!name) {
        return res.status(400).json({
          error: "Missing required field: name",
        });
      }

      const { uploadURL, objectPath } =
        await objectStorageService.createUploadTarget();

      res.json({
        uploadURL,
        objectPath,
        // Echo back the metadata for client convenience
        metadata: { name, size, contentType },
      });
    } catch (error) {
      console.error("Error generating upload URL:", error);
      res.status(500).json({ error: "Failed to generate upload URL" });
    }
  });

  app.get("/objects/:objectPath(*)", async (req, res) => {
    try {
      if (!isObjectStorageConfigured()) {
        return res.status(404).json({ error: "Object not found" });
      }
      const objectFile = await objectStorageService.getObjectEntityFile(
        req.path
      );
      await objectStorageService.downloadObject(objectFile, res, 86400);
    } catch (error) {
      if (error instanceof ObjectNotFoundError) {
        return res.status(404).json({ error: "Object not found" });
      }
      console.error("Error serving object:", error);
      return res.status(500).json({ error: "Failed to serve object" });
    }
  });
}
