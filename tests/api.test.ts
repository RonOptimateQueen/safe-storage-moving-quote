import { describe, expect, it, vi } from "vitest";
import { ApiError, createQuoteApi } from "../src/api";

describe("quote API", () => {
  it("loads a confirmed JSON prefill", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ linkStatus: "active" }), { status: 200, headers: { "content-type": "application/json" } }));
    const api = createQuoteApi({ prefillUrl: "https://test/prefill", submitUrl: "https://test/submit", fetcher });
    await expect(api.loadPrefill("opaque-token")).resolves.toMatchObject({ linkStatus: "active" });
    expect(fetcher).toHaveBeenCalledWith("https://test/prefill?token=opaque-token", expect.objectContaining({ signal: expect.any(AbortSignal) }));
  });

  it.each(["", "spaces are invalid", "x"])('rejects invalid token "%s"', async (token) => {
    const api = createQuoteApi({ prefillUrl: "https://test/prefill", submitUrl: "https://test/submit", fetcher: vi.fn() });
    await expect(api.loadPrefill(token)).rejects.toMatchObject({ code: "INVALID_TOKEN_FORMAT" });
  });

  it("surfaces structured non-2xx errors", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ code: "LINK_REVOKED", message: "הקישור בוטל" }), { status: 401, headers: { "content-type": "application/json" } }));
    const api = createQuoteApi({ prefillUrl: "https://test/prefill", submitUrl: "https://test/submit", fetcher });
    await expect(api.loadPrefill("valid-opaque-token")).rejects.toEqual(expect.objectContaining({ code: "LINK_REVOKED", status: 401 }));
  });

  it("confirms multipart submit and preserves the idempotency key", async () => {
    const response = { submissionId: "s1", quoteId: "q1", quoteVersion: 1, status: "sent", signingRequestId: "e1" };
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify(response), { status: 200, headers: { "content-type": "application/json" } }));
    const api = createQuoteApi({ prefillUrl: "https://test/prefill", submitUrl: "https://test/submit", fetcher });
    await expect(api.submitQuote({ token: "valid-opaque-token", clientSubmissionId: "c1", form: {} }, [], "idem-1")).resolves.toEqual(response);
    expect(fetcher).toHaveBeenCalledWith("https://test/submit", expect.objectContaining({ method: "POST", headers: { "Idempotency-Key": "idem-1" }, body: expect.any(FormData) }));
  });

  it("rejects a 2xx submit response that does not prove the full send completed", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: "sent" }), { status: 200, headers: { "content-type": "application/json" } }));
    const api = createQuoteApi({ prefillUrl: "https://test/prefill", submitUrl: "https://test/submit", fetcher });
    await expect(api.submitQuote({ token: "valid-opaque-token", clientSubmissionId: "c1", form: {} }, [], "idem-1"))
      .rejects.toMatchObject({ code: "INVALID_RESPONSE", retryable: true });
  });

  it("turns a network failure into a retryable API error", async () => {
    const api = createQuoteApi({ prefillUrl: "https://test/prefill", submitUrl: "https://test/submit", fetcher: vi.fn().mockRejectedValue(new TypeError("offline")) });
    await expect(api.loadPrefill("valid-opaque-token")).rejects.toBeInstanceOf(ApiError);
  });
});
