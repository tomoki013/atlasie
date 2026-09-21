import { openDB } from "idb";
import type { Archive } from "../../../packages/domain/src";

const db = () =>
  openDB("travel-archive", 1, {
    upgrade(db) {
      db.createObjectStore("archive");
    },
  });
export async function readArchive(): Promise<Archive> {
  const store = await db();
  return (
    (await store.get("archive", "guest")) ?? {
      version: 1,
      importKey: crypto.randomUUID(),
      visits: [],
    }
  );
}
export async function writeArchive(value: Archive) {
  const store = await db();
  await store.put("archive", value, "guest");
}
export async function preparePhoto(file: File): Promise<string> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw new Error("JPG・PNG・WebP形式の写真を選んでください。");
  if (file.size > 20 * 1024 * 1024)
    throw new Error("写真は1枚20MB以内で選んでください。");
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("写真を読み込めませんでした。");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.85);
}
