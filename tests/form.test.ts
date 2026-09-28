// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { renderMovingQuoteForm, serializeMovingQuoteForm, type PrefillResponse } from "../src/form";

const prefill: PrefillResponse = {
  linkStatus: "active",
  customer: {
    displayName: "ישראל ישראלי",
    contactName: "ישראל",
    mobilePhone: "050-0000000",
    alternatePhone: null,
    email: "israel@example.com",
  },
  meeting: { subject: "הצעת מחיר", scheduledStart: null, ownerName: "שמשון" },
  quoteDefaults: {
    quoteId: null,
    version: 1,
    signatureStatus: "none",
    form: {
      customer: { displayName: "ישראל ישראלי", contactName: "ישראל", mobilePhone: "050-0000000", alternatePhone: "", email: "israel@example.com" },
      origin: { city: "הרצליה", address: "הבנים", number: "14", entrance: "", apartment: "10", floor: "3", elevator: true, additionalLoadingAddress: "", accessNotes: "" },
      destination: { city: "", address: "", floor: "", elevator: false, additionalUnloadingAddress: "", notes: "" },
      schedule: { moveDate: "", moveTime: "", packingDate: "", packingTime: "", safeStorage: false },
      cargo: [{ code: "slidingClosets", label: "ארונות הזזה", selected: false, note: "" }],
      operations: { truckTypes: [], truckNotes: "", estimatedHours: "", cartonsAndPackingNotes: "" },
      quoteLines: [],
      questions: { internalFloorAtDestination: "", truckParkingNearEntrance: "", finalNotes: "" },
    },
  },
  cargoOptions: [{ code: "slidingClosets", label: "ארונות הזזה" }],
  truckOptions: ["משאית 7 מ'", "משאית 6 מ'", "משאית 5 מ'", "משאית 4 מ'", "טרנזית"],
};

describe("moving quote form", () => {
  it("renders one RTL form with all core sections and one submit button", () => {
    document.body.innerHTML = "<main id='app'></main>";
    const form = renderMovingQuoteForm(prefill, document.querySelector("#app")!);
    expect(form.dir).toBe("rtl");
    expect(form.querySelectorAll("fieldset").length).toBeGreaterThanOrEqual(7);
    expect(form.querySelector<HTMLInputElement>("[name='customer.email']")?.value).toBe("israel@example.com");
    expect(form.querySelector("[name='origin.city']")).not.toBeNull();
    expect(form.querySelector("[name='destination.city']")).not.toBeNull();
    expect(form.querySelector("[name='schedule.moveDate']")).not.toBeNull();
    expect(form.querySelector("[name='schedule.moveTime']")).not.toBeNull();
    expect(form.querySelector("[name='schedule.packingDate']")).not.toBeNull();
    expect(form.querySelector("[name='schedule.packingTime']")).not.toBeNull();
    expect(form.querySelectorAll("input[type='file']")).toHaveLength(3);
    expect(form.querySelectorAll("button[type='submit']")).toHaveLength(1);
  });

  it("serializes packing date and time together with the other schedule fields", () => {
    document.body.innerHTML = "<main id='app'></main>";
    const form = renderMovingQuoteForm(prefill, document.querySelector("#app")!);
    (form.elements.namedItem("schedule.packingDate") as HTMLInputElement).value = "2026-10-19";
    (form.elements.namedItem("schedule.packingTime") as HTMLInputElement).value = "13:00";

    expect(serializeMovingQuoteForm(form).schedule).toMatchObject({
      packingDate: "2026-10-19",
      packingTime: "13:00",
    });
  });

  it("supports per-cargo notes and exact truck multi-selection", () => {
    document.body.innerHTML = "<main id='app'></main>";
    const form = renderMovingQuoteForm(prefill, document.querySelector("#app")!);
    expect(form.querySelector("[name='cargo.slidingClosets.selected']")).not.toBeNull();
    expect(form.querySelector("[name='cargo.slidingClosets.note']")).not.toBeNull();
    const trucks = [...form.querySelectorAll<HTMLInputElement>("[name='operations.truckTypes']")];
    expect(trucks.map((input) => input.value)).toEqual(prefill.truckOptions);
    trucks[0].checked = true;
    trucks[4].checked = true;
    expect(serializeMovingQuoteForm(form).operations.truckTypes).toEqual(["משאית 7 מ'", "טרנזית"]);
  });

  it("serializes edited quote lines and recalculates their amount", () => {
    document.body.innerHTML = "<main id='app'></main>";
    const withLine: PrefillResponse = structuredClone(prefill);
    withLine.quoteDefaults.form.quoteLines = [{
      productId: "product-1",
      description: "הובלה",
      notes: "",
      quantity: "1",
      unit: "יחידה",
      unitPriceBeforeVat: "100.00",
      lineAmountBeforeVat: "100.00",
      includedInTotal: true,
    }];
    const form = renderMovingQuoteForm(withLine, document.querySelector("#app")!);
    (form.elements.namedItem("quoteLines.0.description") as HTMLInputElement).value = "הובלה ואריזה";
    (form.elements.namedItem("quoteLines.0.notes") as HTMLInputElement).value = "כולל קרטונים";
    (form.elements.namedItem("quoteLines.0.quantity") as HTMLInputElement).value = "2";
    (form.elements.namedItem("quoteLines.0.unitPriceBeforeVat") as HTMLInputElement).value = "125.50";
    (form.elements.namedItem("quoteLines.0.includedInTotal") as HTMLInputElement).checked = false;

    expect(serializeMovingQuoteForm(form).quoteLines).toEqual([{
      productId: "product-1",
      description: "הובלה ואריזה",
      notes: "כולל קרטונים",
      quantity: "2",
      unit: "יחידה",
      unitPriceBeforeVat: "125.50",
      lineAmountBeforeVat: "251.00",
      includedInTotal: false,
    }]);
  });

  it.each([
    ["a revoked link", { ...prefill, linkStatus: "revoked" }],
    ["a malformed root customer", { ...prefill, customer: { ...prefill.customer, displayName: null } }],
    ["a malformed form", { ...prefill, quoteDefaults: { ...prefill.quoteDefaults, form: { ...prefill.quoteDefaults.form, customer: { ...prefill.quoteDefaults.form.customer, email: undefined } } } }],
  ])("rejects %s before rendering prefill data", (_name, invalidPrefill) => {
    document.body.innerHTML = "<main id='app'>טוען</main>";
    const app = document.querySelector("#app")!;

    expect(() => renderMovingQuoteForm(invalidPrefill as PrefillResponse, app)).toThrow(/PREFILL_UNAVAILABLE/);
    expect(app.textContent).toBe("טוען");
    expect(app.textContent).not.toContain("ישראל ישראלי");
  });
});
