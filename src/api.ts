import type { PrefillResponse } from "./form";

export interface SubmitResponse { submissionId: string; quoteId: string; quoteVersion: number; status: "sent"; signingRequestId: string }
export interface QuoteSubmission { token: string; clientSubmissionId: string; form: unknown }
type Fetcher = typeof fetch;

export class ApiError extends Error {
  constructor(public code: string, message: string, public status = 0, public retryable = false) { super(message); this.name = "ApiError"; }
}

async function requestJson<T>(fetcher: Fetcher, url: string, init: RequestInit, timeoutMs: number): Promise<T> {
  const controller = new AbortController();
  const timer = globalThis.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetcher(url, { ...init, signal: controller.signal });
    let body: unknown;
    try { body = await response.json(); } catch { throw new ApiError("INVALID_RESPONSE", "השרת החזיר תשובה לא תקינה", response.status, response.status >= 500); }
    if (!response.ok) {
      const error = body as { code?: string; message?: string };
      throw new ApiError(error.code ?? "REQUEST_FAILED", error.message ?? "הפעולה נכשלה", response.status, response.status >= 500);
    }
    return body as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError("NETWORK_ERROR", "לא ניתן להתחבר. בדקו את החיבור ונסו שוב.", 0, true);
  } finally { clearTimeout(timer); }
}

function isSubmitResponse(value: unknown): value is SubmitResponse {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const response = value as Record<string, unknown>;
  return typeof response.submissionId === "string" && response.submissionId.length > 0
    && typeof response.quoteId === "string" && response.quoteId.length > 0
    && typeof response.quoteVersion === "number" && Number.isInteger(response.quoteVersion) && response.quoteVersion >= 1
    && response.status === "sent"
    && typeof response.signingRequestId === "string" && response.signingRequestId.length > 0;
}

export function createQuoteApi(options: { prefillUrl: string; submitUrl: string; fetcher?: Fetcher; timeoutMs?: number }) {
  const fetcher = options.fetcher ?? fetch;
  const timeoutMs = options.timeoutMs ?? 20_000;
  return {
    loadPrefill(token: string): Promise<PrefillResponse> {
      if (!/^[A-Za-z0-9_-]{8,512}$/.test(token)) return Promise.reject(new ApiError("INVALID_TOKEN_FORMAT", "הקישור אינו תקין", 400));
      const url = new URL(options.prefillUrl); url.searchParams.set("token", token);
      return requestJson<PrefillResponse>(fetcher, url.toString(), { method: "GET" }, timeoutMs);
    },
    async submitQuote(payload: QuoteSubmission, photos: File[], idempotencyKey: string): Promise<SubmitResponse> {
      const body = new FormData(); body.append("payload", JSON.stringify(payload));
      for (const photo of photos) body.append("photos", photo, photo.name);
      const response = await requestJson<unknown>(fetcher, options.submitUrl, { method: "POST", headers: { "Idempotency-Key": idempotencyKey }, body }, timeoutMs);
      if (!isSubmitResponse(response)) throw new ApiError("INVALID_RESPONSE", "השרת החזיר תשובת שליחה לא תקינה", 200, true);
      return response;
    },
  };
}
