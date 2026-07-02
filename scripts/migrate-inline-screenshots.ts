/**
 * One-off migration: move step screenshots stored as inline data URLs
 * (the Railway fallback while GCS was unconfigured) out of Postgres and
 * into object storage, rewriting steps.image_url to /objects/... paths.
 *
 * Usage: tsx scripts/migrate-inline-screenshots.ts [--dry-run]
 */
import { db, pool } from "../server/db";
import { steps } from "@shared/schema";
import { like, eq } from "drizzle-orm";
import crypto from "crypto";
import {
  objectStorageService,
  isObjectStorageConfigured,
} from "../server/replit_integrations/object_storage/objectStorage";

const DRY_RUN = process.argv.includes("--dry-run");

async function main() {
  if (!isObjectStorageConfigured()) {
    console.error(
      "Object storage is not configured. Set GCS_BUCKET and GCS_SERVICE_ACCOUNT_JSON before migrating."
    );
    process.exit(1);
  }

  const rows = await db
    .select({ id: steps.id, flowId: steps.flowId, imageUrl: steps.imageUrl })
    .from(steps)
    .where(like(steps.imageUrl, "data:%"));

  console.log(`Found ${rows.length} steps with inline data-URL screenshots`);
  if (rows.length === 0) return;

  let migrated = 0;
  let failed = 0;
  let bytesFreed = 0;

  for (const row of rows) {
    const match = row.imageUrl!.match(/^data:(image\/[\w+.-]+);base64,(.*)$/s);
    if (!match) {
      console.warn(`  step ${row.id}: unrecognized data URL format, skipping`);
      failed++;
      continue;
    }

    const [, mimeType, base64] = match;
    const ext = mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg";
    const buffer = Buffer.from(base64, "base64");
    const key = `captures/guide-${row.flowId}/migrated-${row.id}-${crypto.randomUUID()}.${ext}`;

    if (DRY_RUN) {
      console.log(`  [dry-run] step ${row.id}: would upload ${buffer.length} bytes → ${key}`);
      migrated++;
      bytesFreed += row.imageUrl!.length;
      continue;
    }

    try {
      const objectPath = await objectStorageService.saveObject(key, buffer, mimeType);
      await db.update(steps).set({ imageUrl: objectPath }).where(eq(steps.id, row.id));
      bytesFreed += row.imageUrl!.length;
      migrated++;
      console.log(`  step ${row.id}: ${(buffer.length / 1024).toFixed(0)}KB → ${objectPath}`);
    } catch (e: any) {
      failed++;
      console.error(`  step ${row.id}: FAILED — ${e.message}`);
    }
  }

  console.log(
    `\nDone. Migrated ${migrated}/${rows.length} (${failed} failed). ` +
      `~${(bytesFreed / 1024 / 1024).toFixed(1)}MB of inline image data removed from Postgres.`
  );
  if (!DRY_RUN && migrated > 0) {
    console.log("Tip: run VACUUM on the database to reclaim space.");
  }
}

main()
  .then(() => pool.end())
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
  });
