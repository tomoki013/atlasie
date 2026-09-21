import "fake-indexeddb/auto";
import { expect, it } from "vitest";
import { readArchive, writeArchive } from "./guest";

it("persists guest import identity and visits across reads without a server", async () => {
  const first = await readArchive();
  const visit = {
    id: crypto.randomUUID(),
    placeId: crypto.randomUUID(),
    date: "2026-09-05",
    title: "京都",
    memo: "テスト記録",
    photos: [],
  };
  await writeArchive({ ...first, visits: [visit] });
  expect(await readArchive()).toEqual({ ...first, visits: [visit] });
});
