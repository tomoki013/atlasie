import postgres from "postgres";
import type { z } from "zod";
import type { visitInput } from "../../../packages/validation/src";

type VisitInput = z.infer<typeof visitInput>;
export class ArchiveRepository {
  readonly sql;
  constructor(connection: string) {
    this.sql = postgres(connection, {
      max: 5,
      prepare: false,
      connect_timeout: 10,
      idle_timeout: 10,
    });
  }
  async close() {
    await this.sql.end({ timeout: 2 });
  }
  async identity(issuer: string, subject: string): Promise<string> {
    const [row] = await this
      .sql`SELECT resolve_identity(${issuer},${subject}) AS id`;
    return row.id;
  }
  async owned<T>(
    userId: string,
    run: (tx: postgres.TransactionSql) => Promise<T>,
  ): Promise<T> {
    const result = await this.sql.begin(async (tx) => {
      await tx`SELECT set_config('app.user_id',${userId},true)`;
      return { value: await run(tx) };
    });
    return result.value;
  }
  async me(uid: string) {
    return this.owned(uid, async (tx) => {
      const [user] =
        await tx`SELECT id,display_name AS "displayName",deleting FROM users WHERE id=${uid}`;
      return user;
    });
  }
  async visits(
    uid: string,
    limit = 20,
    offset = 0,
    country = "",
    year = "",
    tripId = "",
  ) {
    return this.owned(
      uid,
      async (tx) =>
        tx`SELECT v.id,v.place_id AS "placeId",v.trip_id AS "tripId",to_char(v.visited_on,'YYYY-MM-DD') AS date,coalesce(m.title,'') AS title,coalesce(m.body,'') AS memo,coalesce((SELECT jsonb_agg(jsonb_build_object('id',p.id,'status',p.status)) FROM photos p WHERE p.visit_id=v.id AND p.user_id=${uid}),'[]') AS photos FROM visits v JOIN places location ON location.id=v.place_id LEFT JOIN memories m ON m.visit_id=v.id AND m.user_id=v.user_id WHERE v.user_id=${uid} AND (${tripId} = '' OR v.trip_id::text=${tripId}) AND (${country} = '' OR location.country_code=${country}) AND (${year} = '' OR to_char(v.visited_on,'YYYY')=${year}) ORDER BY v.visited_on DESC,v.id LIMIT ${limit} OFFSET ${offset}`,
    );
  }
  async writeVisit(tx: postgres.TransactionSql, uid: string, v: VisitInput) {
    // A globally colliding UUID never updates an existing user's data.
    const rows =
      await tx`INSERT INTO visits(id,user_id,place_id,trip_id,visited_on) VALUES(${v.id},${uid},${v.placeId},${v.tripId ?? null},${v.date}) ON CONFLICT(id) DO NOTHING RETURNING id`;
    if (!rows.length) {
      const [own] =
        await tx`SELECT id FROM visits WHERE id=${v.id} AND user_id=${uid}`;
      if (!own) throw new Error("Resource unavailable");
      return;
    }
    await tx`INSERT INTO memories(user_id,visit_id,title,body) VALUES(${uid},${v.id},${v.title},${v.memo})`;
  }
  async createVisit(uid: string, v: VisitInput) {
    await this.owned(uid, (tx) => this.writeVisit(tx, uid, v));
    return { id: v.id };
  }
  async import(
    uid: string,
    key: string,
    digest: string,
    visits: VisitInput[],
    trips: { id: string; title: string }[] = [],
  ) {
    return this.owned(uid, async (tx) => {
      await tx`SELECT pg_advisory_xact_lock(hashtextextended(${uid + key},0))`;
      const [existing] =
        await tx`SELECT result,digest FROM guest_imports WHERE user_id=${uid} AND import_key=${key}`;
      if (existing) {
        if (existing.digest !== digest) throw new ImportConflict();
        return existing.result;
      }
      for (const trip of trips) {
        const inserted =
          await tx`INSERT INTO trips(id,user_id,title) VALUES(${trip.id},${uid},${trip.title}) ON CONFLICT(id) DO NOTHING RETURNING id`;
        if (!inserted.length) {
          const [own] =
            await tx`SELECT id FROM trips WHERE id=${trip.id} AND user_id=${uid}`;
          if (!own) throw new Error("Trip unavailable");
        }
      }
      for (const v of visits) await this.writeVisit(tx, uid, v);
      const result = { visitIds: visits.map((v) => v.id) };
      await tx`INSERT INTO guest_imports(user_id,import_key,digest,result) VALUES(${uid},${key},${digest},${tx.json(result)})`;
      return result;
    });
  }
  async map(uid: string, bbox: number[]) {
    return this.owned(
      uid,
      async (
        tx,
      ) => tx`WITH summary AS (SELECT p.country_code AS code,count(*)::int AS visits,count(DISTINCT v.place_id)::int AS places FROM visits v JOIN places p ON p.id=v.place_id WHERE v.user_id=${uid} AND ST_Intersects(p.location::geometry,ST_MakeEnvelope(${bbox[0]},${bbox[1]},${bbox[2]},${bbox[3]},4326)) GROUP BY p.country_code)
    SELECT s.*,r.id AS "placeId",(SELECT ph.id FROM photos ph JOIN visits pv ON pv.id=ph.visit_id WHERE ph.user_id=${uid} AND ph.status='ready' AND pv.place_id=r.id ORDER BY ph.created_at DESC LIMIT 1) AS "photoId",(SELECT count(*)::int FROM photos ph JOIN visits pv ON pv.id=ph.visit_id JOIN places pp ON pp.id=pv.place_id WHERE ph.user_id=${uid} AND ph.status='ready' AND pp.country_code=s.code) AS photos
    FROM summary s LEFT JOIN LATERAL (SELECT p.id FROM visits v JOIN places p ON p.id=v.place_id WHERE v.user_id=${uid} AND p.country_code=s.code ORDER BY EXISTS(SELECT 1 FROM photos WHERE visit_id=v.id AND status='ready') DESC,v.visited_on DESC,v.id LIMIT 1) r ON true`,
    );
  }
  async stats(uid: string) {
    return this.owned(uid, async (tx) => {
      const [stats] =
        await tx`SELECT count(*)::int AS visits,count(DISTINCT place_id)::int AS places,count(DISTINCT CASE WHEN p.kind<>'country' THEN place_id END)::int AS cities,coalesce(jsonb_agg(DISTINCT to_char(v.visited_on,'YYYY')),'[]') AS years,count(DISTINCT p.country_code)::int AS countries,(SELECT count(*)::int FROM photos WHERE user_id=${uid} AND status='ready') AS photos,(SELECT count(*)::int FROM trips WHERE user_id=${uid}) AS trips,(SELECT count(*)::int FROM memories WHERE user_id=${uid} AND (title<>'' OR body<>'')) AS memories FROM visits v JOIN places p ON p.id=v.place_id WHERE v.user_id=${uid}`;
      return stats;
    });
  }
}
export class ImportConflict extends Error {}
