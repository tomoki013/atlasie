import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { jwtVerify, SignJWT } from "jose";
import { z } from "zod";
import { verifyAccessToken } from "../../../packages/auth/src";
import { verifyTurnstile } from "../../../packages/auth/src/turnstile";
import { stripJpegMetadata } from "../../../packages/storage/src/jpeg";
import { signedR2Url } from "../../../packages/storage/src/signed-url";
import {
  importInput,
  memoryInput,
  placeInput,
  tripInput,
  uploadInput,
  uuid,
  visitInput,
} from "../../../packages/validation/src";
import { cleanupPhotos } from "./cleanup";
import { publicMcp } from "./public-mcp";
import { ArchiveRepository, ImportConflict } from "./repository";

type Variables = { userId: string; repo: ArchiveRepository };
const app = new Hono<{ Bindings: WorkerBindings; Variables: Variables }>();
app.use("*", async (c, next) => {
  c.header("X-Content-Type-Options", "nosniff");
  c.header("Referrer-Policy", "no-referrer");
  c.header("Cache-Control", "no-store");
  c.header("X-Robots-Tag", "noindex, nofollow");
  await next();
});
app.use("*", (c, next) =>
  cors({
    origin: c.env.WEB_ORIGIN,
    allowMethods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Authorization", "Content-Type", "MCP-Protocol-Version"],
    maxAge: 600,
  })(c, next),
);
app.use(
  "*",
  bodyLimit({
    maxSize: 1024 * 1024,
    onError: (c) => c.json({ error: "payload_too_large" }, 413),
  }),
);
app.onError((error, c) => {
  if (error instanceof HTTPException)
    return c.json({ error: error.message }, error.status);
  if (error instanceof z.ZodError)
    return c.json({ error: "invalid_request" }, 400);
  if (error instanceof ImportConflict)
    return c.json({ error: "import_key_conflict" }, 409);
  return c.json({ error: "service_error" }, 503);
});
app.get("/v1/health", (c) => c.json({ status: "ok" }));
app.post("/v1/auth/save-intent", async (c) => {
  if (!c.env.TURNSTILE_SECRET_KEY || !c.env.SAVE_INTENT_SECRET)
    throw new HTTPException(503, { message: "save_unavailable" });
  const ip = c.req.header("CF-Connecting-IP") || "local";
  if (!(await c.env.WRITE_LIMITER.limit({ key: `save:${ip}` })).success)
    throw new HTTPException(429, { message: "rate_limited" });
  const input = z
    .object({ token: z.string().min(1).max(2048), importKey: uuid })
    .strict()
    .parse(await c.req.json());
  const result = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    {
      method: "POST",
      body: new URLSearchParams({
        secret: c.env.TURNSTILE_SECRET_KEY,
        response: input.token,
      }),
    },
  );
  const validation = z
    .object({
      success: z.boolean(),
      hostname: z.string().optional(),
      action: z.string().optional(),
    })
    .parse(await result.json());
  if (
    !validation.success ||
    validation.hostname !== c.env.TURNSTILE_HOSTNAME ||
    validation.action !== "guest-save"
  )
    throw new HTTPException(403, { message: "verification_failed" });
  const grant = await new SignJWT({ importKey: input.importKey })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer("travel-archive")
    .setAudience("guest-import")
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(new TextEncoder().encode(c.env.SAVE_INTENT_SECRET));
  return c.json({ grant });
});
app.get("/v1/public/:slug", async (c) => {
  const slug = uuid.parse(c.req.param("slug"));
  const repo = new ArchiveRepository(c.env.HYPERDRIVE.connectionString);
  try {
    const [row] =
      await repo.sql`SELECT public_profile(${slug}::uuid) AS profile`;
    if (!row.profile) throw new HTTPException(404, { message: "not_found" });
    return c.json(row.profile);
  } finally {
    await repo.close();
  }
});
app.post("/v1/reports", async (c) => {
  if (!c.env.TURNSTILE_SECRET_KEY)
    throw new HTTPException(503, { message: "report_unavailable" });
  if (
    !(
      await c.env.WRITE_LIMITER.limit({
        key: `report:${c.req.header("CF-Connecting-IP") ?? "local"}`,
      })
    ).success
  )
    throw new HTTPException(429, { message: "rate_limited" });
  const input = z
    .object({
      slug: uuid,
      reason: z.enum(["privacy", "spam", "other"]),
      token: z.string().min(1).max(2048),
    })
    .strict()
    .parse(await c.req.json());
  if (
    !(await verifyTurnstile(
      input.token,
      c.env.TURNSTILE_SECRET_KEY,
      c.env.TURNSTILE_HOSTNAME,
      "report",
    ))
  )
    throw new HTTPException(403, { message: "verification_failed" });
  const repo = new ArchiveRepository(c.env.HYPERDRIVE.connectionString);
  try {
    await repo.sql`SELECT record_public_report(${input.slug}::uuid,${input.reason})`;
    return c.json({ status: "accepted" }, 202);
  } finally {
    await repo.close();
  }
});
app.post("/v1/mcp", async (c) => {
  const origin = c.req.header("Origin");
  if (origin && origin !== c.env.WEB_ORIGIN)
    throw new HTTPException(403, { message: "origin_denied" });
  const version = c.req.header("MCP-Protocol-Version");
  if (version && version !== "2025-11-25")
    throw new HTTPException(400, { message: "supported_protocol_2025-11-25" });
  const result = await publicMcp(await c.req.json(), c.env);
  return result === null ? c.body(null, 202) : c.json(result);
});
app.get("/v1/mcp", (c) => c.json({ error: "sse_not_supported" }, 405));
app.use("/v1/*", async (c, next) => {
  if (!c.env.AUTH0_DOMAIN || !c.env.AUTH0_AUDIENCE)
    throw new HTTPException(503, { message: "auth_unconfigured" });
  const header = c.req.header("Authorization");
  if (!header?.startsWith("Bearer "))
    throw new HTTPException(401, { message: "unauthorized" });
  let identity: { issuer: string; subject: string };
  try {
    identity = await verifyAccessToken(
      header.slice(7),
      c.env.AUTH0_DOMAIN,
      c.env.AUTH0_AUDIENCE,
    );
  } catch {
    throw new HTTPException(401, { message: "unauthorized" });
  }
  if (
    c.req.method !== "GET" &&
    !(await c.env.WRITE_LIMITER.limit({ key: `write:${identity.subject}` }))
      .success
  )
    throw new HTTPException(429, { message: "rate_limited" });
  const repo = new ArchiveRepository(c.env.HYPERDRIVE.connectionString);
  c.set("repo", repo);
  try {
    const uid = await repo.identity(identity.issuer, identity.subject);
    c.set("userId", uid);
    const user = await repo.me(uid);
    if (!user) throw new HTTPException(401, { message: "unauthorized" });
    if (
      user.deleting &&
      !(c.req.method === "DELETE" && c.req.path === "/v1/me")
    )
      throw new HTTPException(409, { message: "account_deleting" });
    await next();
  } finally {
    await repo.close();
  }
});
app.get("/v1/me", async (c) => c.json(await c.var.repo.me(c.var.userId)));
app.patch("/v1/me", async (c) => {
  const input = z
    .object({ displayName: z.string().trim().min(1).max(80) })
    .strict()
    .parse(await c.req.json());
  await c.var.repo.owned(c.var.userId, async (tx) => {
    await tx`UPDATE users SET display_name=${input.displayName} WHERE id=${c.var.userId}`;
  });
  return c.json({ displayName: input.displayName });
});
app.get("/v1/places", async (c) => {
  const q = z
    .string()
    .max(100)
    .parse(c.req.query("q") ?? "");
  const offset = z.coerce
    .number()
    .int()
    .min(0)
    .parse(c.req.query("offset") ?? 0);
  const visited = c.req.query("visited") === "true";
  const rows = await c.var.repo.owned(
    c.var.userId,
    async (tx) =>
      tx`SELECT p.id,p.name,p.kind,p.country_code AS code,c.name AS country,jsonb_build_array(ST_X(p.location::geometry),ST_Y(p.location::geometry)) AS coordinates FROM places p JOIN countries c ON c.code=p.country_code WHERE p.name ILIKE ${`%${q}%`} AND (${!visited} OR EXISTS(SELECT 1 FROM visits v WHERE v.place_id=p.id AND v.user_id=${c.var.userId})) ORDER BY p.id LIMIT 100 OFFSET ${offset}`,
  );
  return c.json({
    items: rows.map((p) => ({
      ...p,
      flag: String.fromCodePoint(
        ...[...p.code].map((x: string) => 127397 + x.charCodeAt(0)),
      ),
      image: "/place-placeholder.svg",
      description: p.country,
    })),
  });
});
app.post("/v1/places", async (c) => {
  const p = placeInput.parse(await c.req.json());
  await c.var.repo.owned(c.var.userId, async (tx) => {
    const [existing] = await tx`SELECT id FROM places WHERE id=${p.id}`;
    if (existing) return;
    await tx`INSERT INTO places(id,user_id,country_code,name,location,kind) VALUES(${p.id},${c.var.userId},${p.code},${p.name},ST_SetSRID(ST_MakePoint(${p.coordinates[0]},${p.coordinates[1]}),4326)::geography,${p.kind ?? "place"})`;
  });
  return c.json({ id: p.id }, 201);
});
app.get("/v1/visits", async (c) => {
  const limit = z.coerce
    .number()
    .int()
    .min(1)
    .max(100)
    .parse(c.req.query("limit") ?? 20);
  const offset = z.coerce
    .number()
    .int()
    .min(0)
    .parse(c.req.query("offset") ?? 0);
  const country = z
    .string()
    .regex(/^([A-Z]{2})?$/)
    .parse(c.req.query("country") ?? "");
  const year = z
    .string()
    .regex(/^(\d{4})?$/)
    .parse(c.req.query("year") ?? "");
  return c.json({
    items: await c.var.repo.visits(
      c.var.userId,
      limit,
      offset,
      country,
      year,
      uuid.optional().parse(c.req.query("tripId")) ?? "",
    ),
  });
});
app.post("/v1/visits", async (c) =>
  c.json(
    await c.var.repo.createVisit(
      c.var.userId,
      visitInput.parse(await c.req.json()),
    ),
    201,
  ),
);
app.patch("/v1/visits/:id", async (c) => {
  const id = uuid.parse(c.req.param("id"));
  const input = z
    .object({ tripId: uuid.nullable() })
    .strict()
    .parse(await c.req.json());
  const rows = await c.var.repo.owned(
    c.var.userId,
    async (tx) =>
      tx`UPDATE visits SET trip_id=${input.tripId} WHERE id=${id} AND user_id=${c.var.userId} RETURNING id`,
  );
  if (!rows.length) throw new HTTPException(404, { message: "not_found" });
  return c.json({ id });
});
app.delete("/v1/visits/:id", async (c) => {
  const id = uuid.parse(c.req.param("id"));
  await c.var.repo.owned(c.var.userId, async (tx) => {
    const [visit] =
      await tx`SELECT id FROM visits WHERE id=${id} AND user_id=${c.var.userId} FOR UPDATE`;
    if (!visit) throw new HTTPException(404, { message: "not_found" });
    const photos =
      await tx`SELECT storage_key,display_key FROM photos WHERE visit_id=${id} AND user_id=${c.var.userId}`;
    for (const p of photos) {
      await tx`INSERT INTO cleanup_jobs(user_id,object_keys) VALUES(${c.var.userId},${[p.storage_key, ...(p.display_key ? [p.display_key] : [])]})`;
      await c.env.PHOTOS.delete([
        p.storage_key,
        ...(p.display_key ? [p.display_key] : []),
      ]);
    }
    await tx`DELETE FROM visits WHERE id=${id} AND user_id=${c.var.userId}`;
  });
  return c.body(null, 204);
});
app.patch("/v1/memories/:visitId", async (c) => {
  const id = uuid.parse(c.req.param("visitId"));
  const input = memoryInput.parse(await c.req.json());
  const rows = await c.var.repo.owned(
    c.var.userId,
    async (tx) =>
      tx`UPDATE memories SET title=${input.title},body=${input.memo} WHERE visit_id=${id} AND user_id=${c.var.userId} RETURNING id`,
  );
  if (!rows.length) throw new HTTPException(404, { message: "not_found" });
  return c.json({ id: rows[0].id });
});
app.post("/v1/guest/import", async (c) => {
  const input = importInput.parse(await c.req.json());
  if (!c.env.SAVE_INTENT_SECRET)
    throw new HTTPException(503, { message: "save_unavailable" });
  try {
    const { payload } = await jwtVerify(
      input.grant,
      new TextEncoder().encode(c.env.SAVE_INTENT_SECRET),
      {
        algorithms: ["HS256"],
        issuer: "travel-archive",
        audience: "guest-import",
      },
    );
    if (payload.importKey !== input.importKey) throw new Error();
  } catch {
    throw new HTTPException(403, { message: "verification_expired" });
  }
  const digest = Array.from(
    new Uint8Array(
      await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(
          JSON.stringify(
            input.trips.length
              ? { visits: input.visits, trips: input.trips }
              : input.visits,
          ),
        ),
      ),
    ),
  )
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("");
  return c.json(
    await c.var.repo.import(
      c.var.userId,
      input.importKey,
      digest,
      input.visits,
      input.trips,
    ),
  );
});
app.get("/v1/stats", async (c) => c.json(await c.var.repo.stats(c.var.userId)));
app.get("/v1/map", async (c) => {
  const bbox = z
    .array(z.coerce.number().finite())
    .length(4)
    .parse((c.req.query("bbox") ?? "-180,-85,180,85").split(","));
  if (
    bbox[0] < -180 ||
    bbox[2] > 180 ||
    bbox[1] < -90 ||
    bbox[3] > 90 ||
    bbox[0] > bbox[2] ||
    bbox[1] > bbox[3]
  )
    throw new HTTPException(400, { message: "invalid_bbox" });
  return c.json({ countries: await c.var.repo.map(c.var.userId, bbox) });
});
app.get("/v1/trips", async (c) =>
  c.json({
    items: await c.var.repo.owned(
      c.var.userId,
      async (tx) =>
        tx`SELECT id,title FROM trips WHERE user_id=${c.var.userId} ORDER BY created_at DESC`,
    ),
  }),
);
app.post("/v1/trips", async (c) => {
  const input = tripInput.parse(await c.req.json());
  const [trip] = await c.var.repo.owned(
    c.var.userId,
    async (tx) =>
      tx`INSERT INTO trips(user_id,title) VALUES(${c.var.userId},${input.title}) RETURNING id,title`,
  );
  return c.json(trip, 201);
});
app.delete("/v1/trips/:id", async (c) => {
  const id = uuid.parse(c.req.param("id"));
  await c.var.repo.owned(c.var.userId, async (tx) => {
    const [trip] =
      await tx`SELECT id FROM trips WHERE id=${id} AND user_id=${c.var.userId} FOR UPDATE`;
    if (!trip) throw new HTTPException(404, { message: "not_found" });
    await tx`UPDATE visits SET trip_id=null WHERE trip_id=${id} AND user_id=${c.var.userId}`;
    await tx`DELETE FROM trips WHERE id=${id} AND user_id=${c.var.userId}`;
  });
  return c.body(null, 204);
});
app.get("/v1/share", async (c) => {
  const share = await c.var.repo.owned(c.var.userId, async (tx) => {
    const [row] =
      await tx`INSERT INTO share_configurations(user_id) VALUES(${c.var.userId}) ON CONFLICT(user_id) DO UPDATE SET user_id=excluded.user_id RETURNING slug,enabled`;
    return row;
  });
  return c.json(share);
});
app.put("/v1/share", async (c) => {
  const input = z
    .object({ enabled: z.boolean() })
    .strict()
    .parse(await c.req.json());
  const [share] = await c.var.repo.owned(
    c.var.userId,
    async (tx) =>
      tx`INSERT INTO share_configurations(user_id,enabled) VALUES(${c.var.userId},${input.enabled}) ON CONFLICT(user_id) DO UPDATE SET enabled=excluded.enabled RETURNING slug,enabled`,
  );
  return c.json(share);
});
function storageConfig(env: WorkerBindings) {
  return {
    accountId: env.R2_ACCOUNT_ID,
    bucket: env.R2_BUCKET_NAME,
    accessKey: env.R2_ACCESS_KEY_ID,
    secretKey: env.R2_SECRET_ACCESS_KEY,
  };
}
app.post("/v1/photos/upload", async (c) => {
  const input = uploadInput.parse(await c.req.json());
  const uid = c.var.userId;
  const key = `${uid}/original/${input.id}.jpg`;
  const url = await signedR2Url(storageConfig(c.env), key, "PUT");
  await c.var.repo.owned(uid, async (tx) => {
    const [visit] =
      await tx`SELECT id FROM visits WHERE id=${input.visitId} AND user_id=${uid} FOR UPDATE`;
    if (!visit) throw new HTTPException(404, { message: "not_found" });
    const [existing] =
      await tx`SELECT id,visit_id,status FROM photos WHERE id=${input.id} AND user_id=${uid}`;
    if (existing) {
      if (existing.visit_id !== input.visitId)
        throw new HTTPException(409, { message: "photo_conflict" });
      return;
    }
    const [count] =
      await tx`SELECT count(*)::int AS total FROM photos WHERE visit_id=${input.visitId} AND user_id=${uid}`;
    if (count.total >= 10)
      throw new HTTPException(400, { message: "photo_limit" });
    await tx`INSERT INTO photos(id,user_id,visit_id,storage_key,mime_type,byte_size) VALUES(${input.id},${uid},${input.visitId},${key},${input.mimeType},${input.byteSize})`;
  });
  return c.json({ id: input.id, url, expiresIn: 300 }, 201);
});
app.post("/v1/photos/:id/complete", async (c) => {
  const id = uuid.parse(c.req.param("id"));
  const uid = c.var.userId;
  await c.var.repo.owned(uid, async (tx) => {
    const [photo] =
      await tx`SELECT * FROM photos WHERE id=${id} AND user_id=${uid} FOR UPDATE`;
    if (!photo) throw new HTTPException(404, { message: "not_found" });
    if (photo.status === "ready") return;
    const object = await c.env.PHOTOS.get(photo.storage_key);
    if (!object) throw new HTTPException(400, { message: "upload_missing" });
    if (object.size > 8 * 1024 * 1024 || object.size !== photo.byte_size) {
      await c.env.PHOTOS.delete(photo.storage_key);
      throw new HTTPException(400, { message: "invalid_photo_size" });
    }
    let bytes: Uint8Array;
    try {
      bytes = stripJpegMetadata(new Uint8Array(await object.arrayBuffer()));
    } catch {
      throw new HTTPException(400, { message: "invalid_photo" });
    }
    const key = `${uid}/display/${id}.jpg`;
    await c.env.PHOTOS.put(key, bytes, {
      httpMetadata: {
        contentType: "image/jpeg",
        cacheControl: "private, max-age=300",
      },
    });
    await tx`UPDATE photos SET display_key=${key},status='ready' WHERE id=${id} AND user_id=${uid}`;
  });
  return c.json({ id, status: "ready" });
});
app.get("/v1/photos/:id/url", async (c) => {
  const id = uuid.parse(c.req.param("id"));
  const [photo] = await c.var.repo.owned(
    c.var.userId,
    async (tx) =>
      tx`SELECT display_key FROM photos WHERE id=${id} AND user_id=${c.var.userId} AND status='ready'`,
  );
  if (!photo) throw new HTTPException(404, { message: "not_found" });
  return c.json({
    url: await signedR2Url(storageConfig(c.env), photo.display_key, "GET"),
    expiresIn: 300,
  });
});
app.delete("/v1/photos/:id", async (c) => {
  const id = uuid.parse(c.req.param("id"));
  await c.var.repo.owned(c.var.userId, async (tx) => {
    const [photo] =
      await tx`SELECT storage_key,display_key FROM photos WHERE id=${id} AND user_id=${c.var.userId} FOR UPDATE`;
    if (!photo) throw new HTTPException(404, { message: "not_found" });
    const keys = [
      photo.storage_key,
      ...(photo.display_key ? [photo.display_key] : []),
    ];
    await tx`INSERT INTO cleanup_jobs(user_id,object_keys) VALUES(${c.var.userId},${keys})`;
    await c.env.PHOTOS.delete(keys);
    await tx`DELETE FROM photos WHERE id=${id} AND user_id=${c.var.userId}`;
  });
  return c.body(null, 204);
});
app.delete("/v1/me", async (c) => {
  const uid = c.var.userId;
  await c.var.repo.owned(uid, async (tx) => {
    await tx`UPDATE users SET deleting=true WHERE id=${uid}`;
    await tx`INSERT INTO cleanup_jobs(user_id) VALUES(${uid})`;
    await tx`UPDATE share_configurations SET enabled=false WHERE user_id=${uid}`;
  });
  // Entire private prefix, including abandoned uploads. Retry remains safe after failures.
  let cursor: string | undefined;
  do {
    const objects = await c.env.PHOTOS.list({
      prefix: `${uid}/`,
      cursor,
      limit: 1000,
    });
    if (objects.objects.length)
      await c.env.PHOTOS.delete(objects.objects.map((o) => o.key));
    cursor = objects.truncated ? objects.cursor : undefined;
  } while (cursor);
  await c.var.repo.owned(uid, async (tx) => {
    await tx`DELETE FROM users WHERE id=${uid}`;
  });
  return c.body(null, 204);
});
app.notFound((c) => c.json({ error: "not_found" }, 404));

export { app };
export default {
  fetch: app.fetch,
  scheduled: async (_event: ScheduledController, env: WorkerBindings) => {
    await cleanupPhotos(env);
  },
};
