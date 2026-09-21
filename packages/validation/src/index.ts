import { z } from "zod";
export const uuid = z.string().uuid();
export const visitInput = z
  .object({
    id: uuid,
    placeId: uuid,
    date: z.iso.date(),
    title: z.string().max(100).default(""),
    memo: z.string().max(500).default(""),
    tripId: uuid.optional(),
  })
  .strict();
export const importInput = z
  .object({
    importKey: uuid,
    grant: z.string().min(1),
    visits: z.array(visitInput).max(500),
    trips: z
      .array(
        z
          .object({ id: uuid, title: z.string().trim().min(1).max(100) })
          .strict(),
      )
      .max(100)
      .default([]),
  })
  .strict()
  .refine((v) => new Set(v.visits.map((x) => x.id)).size === v.visits.length, {
    message: "Duplicate visit ID",
  });
export const tripInput = z
  .object({ title: z.string().trim().min(1).max(100) })
  .strict();
export const memoryInput = z
  .object({ title: z.string().max(100), memo: z.string().max(500) })
  .strict();
export const uploadInput = z
  .object({
    id: uuid,
    visitId: uuid,
    byteSize: z
      .number()
      .int()
      .positive()
      .max(8 * 1024 * 1024),
    mimeType: z.literal("image/jpeg"),
  })
  .strict();

export const placeInput = z
  .object({
    id: uuid,
    kind: z.enum(["country", "city", "place"]).optional(),
    name: z.string().min(1).max(120),
    country: z.string().min(1).max(100),
    code: z.string().regex(/^[A-Z]{2}$/),
    flag: z.string().max(16),
    coordinates: z.tuple([
      z.number().min(-180).max(180),
      z.number().min(-85).max(85),
    ]),
    image: z.string().max(2048),
    description: z.string().max(250),
  })
  .strict();
