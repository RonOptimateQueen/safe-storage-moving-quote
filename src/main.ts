import "./styles.css";
import { createQuoteApi } from "./api";
import { readRuntimeConfig, type RuntimeConfigSource } from "./config";
import { renderMovingQuoteForm, type PrefillResponse } from "./form";
import { wireSubmission } from "./submission";

const app = document.querySelector<HTMLElement>("#app");
if (!app) throw new Error("Missing app element");
const appElement = app;

type QuoteWindow = Window & { __MOVING_QUOTE_PREFILL__?: PrefillResponse; __MOVING_QUOTE_CONFIG__?: RuntimeConfigSource };
const quoteWindow = window as QuoteWindow;
const injectedPrefill = quoteWindow.__MOVING_QUOTE_PREFILL__;
if (injectedPrefill) {
  try {
    renderMovingQuoteForm(injectedPrefill, appElement);
  } catch {
    showUnavailable();
  }
} else {
  void start();
}

async function start(): Promise<void> {
  appElement.innerHTML = `<section class="shell"><h1>הצעת מחיר להובלה</h1><p>הטופס נטען…</p></section>`;
  try {
    const config = readRuntimeConfig(quoteWindow.__MOVING_QUOTE_CONFIG__ ?? {});
    const token = new URLSearchParams(location.search).get(config.tokenQueryKey) ?? "";
    const api = createQuoteApi(config);
    const prefill = await api.loadPrefill(token);
    const form = renderMovingQuoteForm(prefill, appElement);
    wireSubmission(form, api, token, config.maxPhotoBytes);
  } catch {
    showUnavailable();
  }
}

function showUnavailable(): void {
  appElement.innerHTML = `<section class="shell error"><h1>לא ניתן לפתוח את הטופס</h1><p>יש לפנות למנהל המערכת.</p></section>`;
}
