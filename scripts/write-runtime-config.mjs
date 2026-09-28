import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const webhookUrl = process.env.MOVING_QUOTE_WEBHOOK_URL?.trim();
if (!webhookUrl) {
  throw new Error("MOVING_QUOTE_WEBHOOK_URL is required");
}

const parsed = new URL(webhookUrl);
if (parsed.protocol !== "https:") {
  throw new Error("MOVING_QUOTE_WEBHOOK_URL must use HTTPS");
}

const config = {
  prefillUrl: webhookUrl,
  submitUrl: webhookUrl,
  maxPhotoBytes: 8_000_000,
  tokenQueryKey: "token",
};

const contents = `window.__MOVING_QUOTE_CONFIG__ = ${JSON.stringify(config, null, 2)};\n`;
await writeFile(resolve("public/runtime-config.js"), contents, "utf8");
