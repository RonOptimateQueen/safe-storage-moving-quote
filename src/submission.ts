import type { createQuoteApi } from "./api";
import { serializeMovingQuoteForm } from "./form";
import { normalizePhoto, validatePhotos } from "./photos";

type QuoteApi = ReturnType<typeof createQuoteApi>;
const SESSION_KEY_PREFIX = "movingQuoteSubmission:";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function sessionKey(token: string): string {
  return `${SESSION_KEY_PREFIX}${encodeURIComponent(token)}`;
}

export function currentSubmissionId(token: string): string {
  const key = sessionKey(token);
  const existing = sessionStorage.getItem(key);
  if (existing && UUID_PATTERN.test(existing)) return existing;
  const created = crypto.randomUUID(); sessionStorage.setItem(key, created); return created;
}

export function resetSubmissionId(token: string): void { sessionStorage.removeItem(sessionKey(token)); }

export function wireSubmission(form: HTMLFormElement, api: QuoteApi, token: string, maxPhotoBytes: number): void {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = form.querySelector<HTMLButtonElement>("button[type='submit']")!;
    let message = form.querySelector<HTMLElement>("[data-submit-message]");
    if (!message) { message = document.createElement("p"); message.dataset.submitMessage = ""; form.append(message); }
    button.disabled = true; message.textContent = "שולח את ההצעה…";
    try {
      const fileInputs = [...form.querySelectorAll<HTMLInputElement>("input[type='file']")];
      const raw = fileInputs.flatMap((input) => [...(input.files ?? [])]);
      validatePhotos(raw, maxPhotoBytes);
      const photos = await Promise.all(raw.map((photo) => normalizePhoto(photo)));
      const submissionId = currentSubmissionId(token);
      await api.submitQuote({ token, clientSubmissionId: submissionId, form: serializeMovingQuoteForm(form) }, photos, submissionId);
      resetSubmissionId(token); message.textContent = "ההצעה נוצרה ונשלחה ללקוח לחתימה."; button.textContent = "נשלח בהצלחה";
    } catch (error) {
      message.textContent = error instanceof Error ? error.message : "השליחה נכשלה. אפשר לנסות שוב.";
      button.disabled = false;
    }
  });
}
