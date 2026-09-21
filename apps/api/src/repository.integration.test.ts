import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ArchiveRepository, ImportConflict } from "./repository";

const connection = process.env.TEST_DATABASE_URL;
describe.skipIf(!connection)(
  "PostgreSQL repository under a non-owner RLS role",
  () => {
    let repo: ArchiveRepository;
    let alice: string;
    let bob: string;
    const key = crypto.randomUUID();
    const run = crypto.randomUUID();
    const v = {
      id: crypto.randomUUID(),
      placeId: "00000000-0000-4000-8000-000000000001",
      date: "2026-09-05",
      title: "Private memory",
      memo: "Private text",
    };
    beforeAll(async () => {
      repo = new ArchiveRepository(connection ?? "");
      alice = await repo.identity(
        "https://integration.test/",
        `google-oauth2|${run}`,
      );
      bob = await repo.identity("https://integration.test/", `apple|${run}`);
    });
    afterAll(async () => {
      if (repo) {
        await repo.owned(alice, async (tx) => {
          await tx`DELETE FROM users WHERE id=${alice}`;
        });
        await repo.owned(bob, async (tx) => {
          await tx`DELETE FROM users WHERE id=${bob}`;
        });
        await repo.close();
      }
    });
    it("uses a restricted database role", async () => {
      const [r] =
        await repo.sql`SELECT rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user`;
      expect(r).toMatchObject({ rolsuper: false, rolbypassrls: false });
    });
    it("keeps providers separate and resolves identity idempotently", async () => {
      expect(alice).not.toBe(bob);
      expect(
        await repo.identity(
          "https://integration.test/",
          `google-oauth2|${run}`,
        ),
      ).toBe(alice);
    });
    it("serializes concurrent import retries and creates exactly one record", async () => {
      const results = await Promise.all([
        repo.import(alice, key, "hash", [v]),
        repo.import(alice, key, "hash", [v]),
      ]);
      expect(results[0]).toEqual(results[1]);
      expect(await repo.visits(alice)).toHaveLength(1);
    });
    it("rejects reusing an import key for different data", async () => {
      await expect(
        repo.import(alice, key, "changed", [{ ...v, title: "Changed" }]),
      ).rejects.toBeInstanceOf(ImportConflict);
    });
    it("rolls back the entire import when a later visit is invalid", async () => {
      await expect(
        repo.import(alice, crypto.randomUUID(), "rollback", [
          { ...v, id: crypto.randomUUID() },
          { ...v, id: crypto.randomUUID(), placeId: crypto.randomUUID() },
        ]),
      ).rejects.toThrow();
      expect(await repo.visits(alice)).toHaveLength(1);
    });
    it("denies cross-user reads and UUID collision takeover", async () => {
      expect(await repo.visits(bob)).toEqual([]);
      await expect(
        repo.createVisit(bob, { ...v, title: "Taken over" }),
      ).rejects.toThrow();
      expect((await repo.visits(alice))[0].title).toBe("Private memory");
    });
    it("aggregates without exposing memory text in map responses", async () => {
      const result = await repo.map(alice, [-180, -85, 180, 85]);
      expect(result[0]).toMatchObject({ code: "GR", visits: 1, places: 1 });
      expect(JSON.stringify(result)).not.toContain("Private");
    });
    it("imports trip groups atomically and filters visits by trip", async () => {
      const trip = { id: crypto.randomUUID(), title: "Island journey" };
      const visit = { ...v, id: crypto.randomUUID(), tripId: trip.id };
      await repo.import(alice, crypto.randomUUID(), "trip", [visit], [trip]);
      const rows = await repo.visits(alice, 20, 0, "", "", trip.id);
      expect(rows).toHaveLength(1);
      expect(rows[0].tripId).toBe(trip.id);
      const invalidTrip = { id: crypto.randomUUID(), title: "Rollback" };
      await expect(
        repo.import(
          alice,
          crypto.randomUUID(),
          "bad-trip",
          [
            {
              ...visit,
              id: crypto.randomUUID(),
              tripId: invalidTrip.id,
              placeId: crypto.randomUUID(),
            },
          ],
          [invalidTrip],
        ),
      ).rejects.toThrow();
      const absent = await repo.owned(
        alice,
        (tx) => tx`SELECT id FROM trips WHERE id=${invalidTrip.id}`,
      );
      expect(absent).toHaveLength(0);
    });
  },
);
