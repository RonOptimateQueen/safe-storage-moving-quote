import { describe, expect, it } from "vitest";
import {
  calculateIncludedTotal,
  calculateLineAmount,
  type QuoteLineDraft,
} from "../src/model";

const line = (overrides: Partial<QuoteLineDraft> = {}): QuoteLineDraft => ({
  productId: "fixture-product",
  description: "שירות בדיקה בלבד",
  notes: "",
  quantity: "2",
  unit: "יחידה",
  unitPriceBeforeVat: "125.50",
  lineAmountBeforeVat: "251.00",
  includedInTotal: true,
  ...overrides,
});

describe("calculateLineAmount", () => {
  it("multiplies quantity by the unit price without floating-point drift", () => {
    expect(calculateLineAmount("3", "0.10")).toEqual({ ok: true, value: "0.30" });
  });

  it("supports decimal quantities and rounds to whole agorot", () => {
    expect(calculateLineAmount("1.5", "10.01")).toEqual({ ok: true, value: "15.02" });
  });

  it("treats two empty fields as an empty zero-valued line", () => {
    expect(calculateLineAmount("", "")).toEqual({ ok: true, value: "0.00" });
  });

  it.each([
    ["-1", "20", "quantity"],
    ["abc", "20", "quantity"],
    ["1", "-20", "unitPriceBeforeVat"],
    ["1", "abc", "unitPriceBeforeVat"],
  ])("rejects invalid values", (quantity, unitPrice, field) => {
    const result = calculateLineAmount(quantity, unitPrice);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.field).toBe(field);
      expect(result.message).toMatch(/[א-ת]/);
    }
  });
});

describe("calculateIncludedTotal", () => {
  it("sums included rows and ignores excluded rows", () => {
    expect(
      calculateIncludedTotal([
        line(),
        line({ lineAmountBeforeVat: "99.99", includedInTotal: false }),
        line({ lineAmountBeforeVat: "10.05" }),
      ]),
    ).toEqual({ ok: true, value: "261.05" });
  });

  it("rejects a non-numeric stored line amount", () => {
    const result = calculateIncludedTotal([line({ lineAmountBeforeVat: "oops" })]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.field).toBe("lineAmountBeforeVat");
  });
});
