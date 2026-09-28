import { expect, test, type Page } from "@playwright/test";

const fixture = {
  linkStatus: "active",
  customer: { displayName: "לקוח לדוגמה", contactName: "דוגמה", mobilePhone: "0500000000", alternatePhone: null, email: "demo@example.com" },
  meeting: { subject: "הצעת מחיר", scheduledStart: null, ownerName: "שמשון" },
  quoteDefaults: { quoteId: null, version: 1, signatureStatus: "none", form: {
    customer: { displayName: "לקוח לדוגמה", contactName: "דוגמה", mobilePhone: "0500000000", alternatePhone: "", email: "demo@example.com" },
    origin: { city: "הרצליה", address: "הבנים", number: "14", entrance: "", apartment: "10", floor: "3", elevator: true, additionalLoadingAddress: "", accessNotes: "" },
    destination: { city: "תל אביב", address: "דיזנגוף 1", floor: "2", elevator: true, additionalUnloadingAddress: "", notes: "" },
    schedule: { moveDate: "", moveTime: "", packingDate: "", packingTime: "", safeStorage: false },
    cargo: [{ code: "slidingClosets", label: "ארונות הזזה", selected: true, note: "שניים" }, { code: "plants", label: "עציצים", selected: false, note: "" }],
    operations: { truckTypes: ["משאית 7 מ'"], truckNotes: "", estimatedHours: "", cartonsAndPackingNotes: "" }, quoteLines: [],
    questions: { internalFloorAtDestination: "", truckParkingNearEntrance: "", finalNotes: "" },
  }}, cargoOptions: [{ code: "slidingClosets", label: "ארונות הזזה" }], truckOptions: ["משאית 7 מ'", "משאית 6 מ'", "משאית 5 מ'", "משאית 4 מ'", "טרנזית"],
};

async function openFixture(page: Page) {
  await page.addInitScript((data) => { (window as Window & { __MOVING_QUOTE_PREFILL__?: unknown }).__MOVING_QUOTE_PREFILL__ = data; }, fixture);
  await page.goto("/");
}

for (const viewport of [{ name: "portrait", width: 768, height: 1024 }, { name: "landscape", width: 1024, height: 768 }]) {
  test(`iPad Mini ${viewport.name} has no horizontal overflow`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await openFixture(page);
    await expect(page.getByRole("button", { name: "יצירת הצעה ושליחה לחתימה" })).toBeVisible();
    const sizes = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
    expect(sizes.scroll).toBeLessThanOrEqual(sizes.client);
    await expect(page.locator("input").first()).toBeVisible();
  });
}
