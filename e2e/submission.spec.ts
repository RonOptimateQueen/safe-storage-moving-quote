import { expect, test } from "@playwright/test";

const prefill = {
  linkStatus: "active", customer: { displayName: "לקוח לדוגמה", contactName: "דוגמה", mobilePhone: "0500000000", alternatePhone: null, email: "demo@example.com" }, meeting: { subject: "הצעת מחיר", scheduledStart: null, ownerName: "שמשון" },
  quoteDefaults: { quoteId: null, version: 1, signatureStatus: "none", form: { customer: { displayName: "לקוח לדוגמה", contactName: "דוגמה", mobilePhone: "0500000000", alternatePhone: "", email: "demo@example.com" }, origin: { city: "הרצליה", address: "הבנים", number: "14", entrance: "", apartment: "10", floor: "3", elevator: true, additionalLoadingAddress: "", accessNotes: "" }, destination: { city: "", address: "", floor: "", elevator: false, additionalUnloadingAddress: "", notes: "" }, schedule: { moveDate: "", moveTime: "", packingDate: "", packingTime: "", safeStorage: false }, cargo: [], operations: { truckTypes: [], truckNotes: "", estimatedHours: "", cartonsAndPackingNotes: "" }, quoteLines: [], questions: { internalFloorAtDestination: "", truckParkingNearEntrance: "", finalNotes: "" } } }, cargoOptions: [], truckOptions: ["משאית 7 מ'", "משאית 6 מ'", "משאית 5 מ'", "משאית 4 מ'", "טרנזית"],
};

test("shows success only after the submit endpoint confirms", async ({ page }) => {
  await page.addInitScript(() => { (window as Window & { __MOVING_QUOTE_CONFIG__?: unknown }).__MOVING_QUOTE_CONFIG__ = { prefillUrl: "http://127.0.0.1:4173/api/prefill", submitUrl: "http://127.0.0.1:4173/api/submit", maxPhotoBytes: 8000000, tokenQueryKey: "token" }; });
  await page.route("**/api/prefill?token=valid-opaque-token", (route) => route.fulfill({ json: prefill }));
  await page.route("**/api/submit", async (route) => {
    expect(route.request().headers()["idempotency-key"]).toBeTruthy();
    await route.fulfill({ json: { submissionId: "s1", quoteId: "q1", quoteVersion: 1, status: "sent", signingRequestId: "e1" } });
  });
  await page.goto("/?token=valid-opaque-token");
  await page.getByRole("button", { name: "יצירת הצעה ושליחה לחתימה" }).click();
  await expect(page.getByText("ההצעה נוצרה ונשלחה ללקוח לחתימה.")).toBeVisible();
});

test("keeps entered values and enables retry after a failed submit", async ({ page }) => {
  await page.addInitScript(() => { (window as Window & { __MOVING_QUOTE_CONFIG__?: unknown }).__MOVING_QUOTE_CONFIG__ = { prefillUrl: "http://127.0.0.1:4173/api/prefill", submitUrl: "http://127.0.0.1:4173/api/submit" }; });
  await page.route("**/api/prefill?token=valid-opaque-token", (route) => route.fulfill({ json: prefill }));
  await page.route("**/api/submit", (route) => route.fulfill({ status: 502, json: { code: "DOWNSTREAM_ERROR", message: "השליחה נכשלה" } }));
  await page.goto("/?token=valid-opaque-token");
  const city = page.locator("[name='destination.city']"); await city.fill("חולון");
  const button = page.getByRole("button", { name: "יצירת הצעה ושליחה לחתימה" }); await button.click();
  await expect(page.getByText("השליחה נכשלה")).toBeVisible();
  await expect(city).toHaveValue("חולון"); await expect(button).toBeEnabled();
});

test("does not render PII for a revoked prefill response", async ({ page }) => {
  await page.addInitScript(() => { (window as Window & { __MOVING_QUOTE_CONFIG__?: unknown }).__MOVING_QUOTE_CONFIG__ = { prefillUrl: "http://127.0.0.1:4173/api/prefill", submitUrl: "http://127.0.0.1:4173/api/submit" }; });
  await page.route("**/api/prefill?token=valid-opaque-token", (route) => route.fulfill({ json: { ...prefill, linkStatus: "revoked" } }));

  await page.goto("/?token=valid-opaque-token");

  await expect(page.getByRole("heading", { name: "לא ניתן לפתוח את הטופס" })).toBeVisible();
  await expect(page.getByText("לקוח לדוגמה")).toHaveCount(0);
  await expect(page.getByText("demo@example.com")).toHaveCount(0);
});

test("shows the same generic screen for malformed prefill JSON", async ({ page }) => {
  await page.addInitScript(() => { (window as Window & { __MOVING_QUOTE_CONFIG__?: unknown }).__MOVING_QUOTE_CONFIG__ = { prefillUrl: "http://127.0.0.1:4173/api/prefill", submitUrl: "http://127.0.0.1:4173/api/submit" }; });
  await page.route("**/api/prefill?token=valid-opaque-token", (route) => route.fulfill({ json: { ...prefill, quoteDefaults: { ...prefill.quoteDefaults, form: { ...prefill.quoteDefaults.form, customer: { ...prefill.quoteDefaults.form.customer, email: null } } } } }));

  await page.goto("/?token=valid-opaque-token");

  await expect(page.getByRole("heading", { name: "לא ניתן לפתוח את הטופס" })).toBeVisible();
  await expect(page.getByText("יש לפנות למנהל המערכת.")).toBeVisible();
  await expect(page.getByText("לקוח לדוגמה")).toHaveCount(0);
});

test("uses one UUID for the payload and idempotency header across a retry", async ({ page }) => {
  await page.addInitScript(() => { (window as Window & { __MOVING_QUOTE_CONFIG__?: unknown }).__MOVING_QUOTE_CONFIG__ = { prefillUrl: "http://127.0.0.1:4173/api/prefill", submitUrl: "http://127.0.0.1:4173/api/submit" }; });
  await page.route("**/api/prefill?token=valid-opaque-token", (route) => route.fulfill({ json: prefill }));
  const attempts: Array<{ key: string | undefined; clientSubmissionId: string | undefined }> = [];
  await page.route("**/api/submit", async (route) => {
    const body = route.request().postData() ?? "";
    attempts.push({ key: route.request().headers()["idempotency-key"], clientSubmissionId: body.match(/"clientSubmissionId":"([^"]+)"/)?.[1] });
    await route.fulfill(attempts.length === 1
      ? { status: 502, json: { code: "DOWNSTREAM_ERROR", message: "השליחה נכשלה" } }
      : { json: { submissionId: "s1", quoteId: "q1", quoteVersion: 1, status: "sent", signingRequestId: "e1" } });
  });

  await page.goto("/?token=valid-opaque-token");
  const button = page.getByRole("button", { name: "יצירת הצעה ושליחה לחתימה" });
  await button.click();
  await expect(page.getByText("השליחה נכשלה")).toBeVisible();
  await button.click();
  await expect(page.getByText("ההצעה נוצרה ונשלחה ללקוח לחתימה.")).toBeVisible();

  expect(attempts).toHaveLength(2);
  expect(attempts[0].key).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  expect(attempts[0].clientSubmissionId).toBe(attempts[0].key);
  expect(attempts[1]).toEqual(attempts[0]);
});

test("does not reuse a failed submission identifier for another token", async ({ page }) => {
  await page.addInitScript(() => { (window as Window & { __MOVING_QUOTE_CONFIG__?: unknown }).__MOVING_QUOTE_CONFIG__ = { prefillUrl: "http://127.0.0.1:4173/api/prefill", submitUrl: "http://127.0.0.1:4173/api/submit" }; });
  await page.route("**/api/prefill?token=*", (route) => route.fulfill({ json: prefill }));
  const keys: string[] = [];
  await page.route("**/api/submit", async (route) => {
    keys.push(route.request().headers()["idempotency-key"]!);
    await route.fulfill({ status: 502, json: { code: "DOWNSTREAM_ERROR", message: "השליחה נכשלה" } });
  });

  const button = page.getByRole("button", { name: "יצירת הצעה ושליחה לחתימה" });
  await page.goto("/?token=first-opaque-token");
  await button.click();
  await expect(page.getByText("השליחה נכשלה")).toBeVisible();
  await page.goto("/?token=second-opaque-token");
  await button.click();
  await expect(page.getByText("השליחה נכשלה")).toBeVisible();

  expect(keys).toHaveLength(2);
  expect(keys[0]).not.toBe(keys[1]);
});
