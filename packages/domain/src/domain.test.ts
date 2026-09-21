import { describe, expect, it } from "vitest";
import { demoVisits, places } from "../../../apps/web/lib/data";
import { importInput, visitInput } from "../../validation/src";
import { summarize } from "./index";

describe("Visit model", () => {
  it("counts repeat visits independently without a mandatory trip", () => {
    const visits = [demoVisits[0], { ...demoVisits[0], id: "repeat" }];
    expect(summarize(visits, places)).toMatchObject({
      countries: 1,
      places: 1,
      visits: 2,
      trips: 0,
    });
  });
  it("accepts a visit without a trip or a long diary", () => {
    expect(
      visitInput.parse({
        id: crypto.randomUUID(),
        placeId: places[0].id,
        date: "2026-09-05",
      }),
    ).toMatchObject({ title: "", memo: "" });
  });
  it("rejects impossible dates and client ownership injection", () => {
    expect(
      visitInput.safeParse({
        id: crypto.randomUUID(),
        placeId: places[0].id,
        date: "2026-02-30",
      }).success,
    ).toBe(false);
    expect(
      visitInput.safeParse({
        id: crypto.randomUUID(),
        placeId: places[0].id,
        date: "2026-09-05",
        userId: crypto.randomUUID(),
      }).success,
    ).toBe(false);
  });
  it("rejects duplicate import visit IDs", () => {
    const v = {
      id: crypto.randomUUID(),
      placeId: places[0].id,
      date: "2026-09-05",
    };
    expect(
      importInput.safeParse({
        importKey: crypto.randomUUID(),
        grant: "x",
        visits: [v, v],
      }).success,
    ).toBe(false);
  });
});
