import { expect, it } from "vitest";
import { stripJpegMetadata } from "./jpeg";

it("removes EXIF and comments without changing image scan data", () => {
  const jpeg = new Uint8Array([
    255, 216, 255, 225, 0, 6, 69, 120, 105, 102, 255, 254, 0, 4, 72, 73, 255,
    218, 0, 2, 1, 2, 255, 0, 3, 255, 217,
  ]);
  expect([...stripJpegMetadata(jpeg)]).toEqual([
    255, 216, 255, 218, 0, 2, 1, 2, 255, 0, 3, 255, 217,
  ]);
});
it("rejects malformed or truncated images", () => {
  expect(() => stripJpegMetadata(new Uint8Array([1, 2, 3]))).toThrow();
  expect(() =>
    stripJpegMetadata(new Uint8Array([255, 216, 255, 225, 255, 255])),
  ).toThrow();
  expect(() =>
    stripJpegMetadata(new Uint8Array([255, 216, 255, 218, 0, 2, 1, 2])),
  ).toThrow();
});
it("strips metadata between progressive scans", () => {
  const jpeg = new Uint8Array([
    255, 216, 255, 218, 0, 2, 1, 255, 225, 0, 3, 42, 255, 218, 0, 2, 3, 255,
    217,
  ]);
  expect([...stripJpegMetadata(jpeg)]).toEqual([
    255, 216, 255, 218, 0, 2, 1, 255, 218, 0, 2, 3, 255, 217,
  ]);
});
