import { describe, expect, it } from "vitest";
import { readRuntimeConfig } from "../src/config";

describe("readRuntimeConfig", () => {
  it("returns only the approved public runtime values", () => {
    expect(
      readRuntimeConfig({
        prefillUrl: "https://example.test/prefill",
        submitUrl: "https://example.test/submit",
      }),
    ).toEqual({
      prefillUrl: "https://example.test/prefill",
      submitUrl: "https://example.test/submit",
      maxPhotoBytes: 8_000_000,
      tokenQueryKey: "token",
    });
  });

  it("fails startup when an endpoint is missing", () => {
    expect(() => readRuntimeConfig({ prefillUrl: "https://example.test/prefill" })).toThrow(
      /חסרה כתובת חיבור/,
    );
  });
});
