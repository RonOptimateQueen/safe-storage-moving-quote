import { describe, expect, it } from "vitest";
import { validatePhotos } from "../src/photos";

const image = (name = "photo.jpg", type = "image/jpeg", size = 10) => new File([new Uint8Array(size)], name, { type });

describe("validatePhotos", () => {
  it("accepts zero to three JPEG, PNG or HEIC files", () => {
    expect(validatePhotos([], 100)).toEqual([]);
    expect(validatePhotos([image(), image("x.png", "image/png"), image("x.heic", "image/heic")], 100)).toHaveLength(3);
  });

  it("rejects a fourth image", () => {
    expect(() => validatePhotos([image(), image(), image(), image()], 100)).toThrow(/שלוש/);
  });

  it("rejects unsupported MIME and oversize files", () => {
    expect(() => validatePhotos([image("x.gif", "image/gif")], 100)).toThrow(/JPEG|PNG|HEIC/);
    expect(() => validatePhotos([image("x.jpg", "image/jpeg", 101)], 100)).toThrow(/גדולה/);
  });
});
