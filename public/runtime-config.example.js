// Copy to runtime-config.js only for local testing.
// Never commit a live Make webhook URL.
window.__MOVING_QUOTE_CONFIG__ = {
  prefillUrl: "https://replace-with-make-webhook.example/prefill",
  submitUrl: "https://replace-with-make-webhook.example/submit",
  maxPhotoBytes: 8000000,
  tokenQueryKey: "token",
};
