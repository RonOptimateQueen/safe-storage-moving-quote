import { describe, expect, it } from "vitest";
import {
  PrefillSourceError,
  resolveFireberryPrefill,
  type FireberryAccount,
  type FireberryMeeting,
  type FireberryQuote,
  type PrefillResolutionInput,
} from "../src/prefill-resolver";

const meeting: FireberryMeeting = {
  activityid: "event-1",
  subject: "פגישת הצעת מחיר עדכנית",
  scheduledstart: "2026-10-01T09:00:00+03:00",
  objectid: "quote-1",
  objecttypecode: 4,
  ownerid: "owner-live",
  owneridname: "נציגה חיה",
  pcfmeetingtype: 1,
  pcfquote: "quote-1",
};

const quote: FireberryQuote = {
  opportunityid: "quote-1",
  accountid: "account-1",
  contacttid: null,
  ownerid: "owner-old",
  owneridname: "שם ישן",
  pcfquoteversion: 2,
  pcfsignaturestatus: 2,
};

const account: FireberryAccount = {
  accountid: "account-1",
  accountname: "לקוח בדיקה",
  telephone1: "03-1000000",
  telephone2: "03-2000000",
  emailaddress1: "account@example.test",
  billingcity: "תל אביב",
  billingstreet: "רחוב בדיקה",
};

const input = (overrides: Partial<PrefillResolutionInput> = {}): PrefillResolutionInput => ({
  meeting,
  quote,
  account,
  quoteLines: [],
  ...overrides,
});

describe("resolveFireberryPrefill", () => {
  it("uses an Account meeting as the no-quote fallback and accepts zero lines", () => {
    const result = resolveFireberryPrefill(input({
      meeting: { ...meeting, objecttypecode: 1, objectid: "account-1", pcfquote: null },
      quote: null,
    }));

    expect(result.quoteDefaults).toMatchObject({ quoteId: null, version: 1, signatureStatus: "none" });
    expect(result.quoteDefaults.form.quoteLines).toEqual([]);
    expect(result.customer).toEqual({
      displayName: "לקוח בדיקה",
      contactName: null,
      mobilePhone: "03-1000000",
      alternatePhone: "03-2000000",
      email: "account@example.test",
    });
  });

  it("prefers linked Contact phone and email values over Account fallbacks", () => {
    const result = resolveFireberryPrefill(input({
      quote: { ...quote, contacttid: "contact-1" },
      contact: {
        contactid: "contact-1",
        accountid: "account-1",
        fullname: "אשת קשר",
        mobilephone1: "050-1000000",
        telephone2: "050-2000000",
        emailaddress1: "contact@example.test",
      },
    }));

    expect(result.customer).toMatchObject({
      contactName: "אשת קשר",
      mobilePhone: "050-1000000",
      alternatePhone: "050-2000000",
      email: "contact@example.test",
    });
  });

  it("lets a valid quote snapshot win while keeping meeting and owner data live", () => {
    const initial = resolveFireberryPrefill(input());
    const snapshot = structuredClone(initial.quoteDefaults.form);
    snapshot.customer.displayName = "שם שתוקן בטופס";
    snapshot.origin.city = "חיפה";
    snapshot.schedule.moveDate = "2026-11-15";
    snapshot.quoteLines = [{
      productId: "stale",
      description: "שורה ישנה",
      notes: "",
      quantity: "1",
      unit: "",
      unitPriceBeforeVat: "1",
      lineAmountBeforeVat: "1.00",
      includedInTotal: true,
    }];

    const result = resolveFireberryPrefill(input({
      quote: { ...quote, pcfformpayload: JSON.stringify(snapshot) },
      quoteLines: [{
        customobject1000id: "line-1",
        pcfsystemfield100: "quote-1",
        pcfsystemfield101: "product-1",
        pcfsystemfield102: 2,
        pcfsystemfield103: "125.50",
        pcfsystemfield104: "הובלה",
        pcflineid: "QL-000001",
        pcfunit: "יחידה",
        pcfincludedintotal: 1,
      }],
    }));

    expect(result.customer.displayName).toBe("שם שתוקן בטופס");
    expect(result.quoteDefaults.form.origin.city).toBe("חיפה");
    expect(result.quoteDefaults.form.schedule.moveDate).toBe("2026-11-15");
    expect(result.meeting).toEqual({
      subject: "פגישת הצעת מחיר עדכנית",
      scheduledStart: "2026-10-01T09:00:00+03:00",
      ownerName: "נציגה חיה",
    });
    expect(result.quoteDefaults.form.quoteLines).toEqual([expect.objectContaining({
      productId: "product-1",
      quantity: "2",
      unitPriceBeforeVat: "125.50",
      lineAmountBeforeVat: "251.00",
      includedInTotal: true,
    })]);
  });

  it("ignores malformed or structurally invalid snapshots safely", () => {
    for (const pcfformpayload of ["{broken", JSON.stringify({ customer: { displayName: "partial" } })]) {
      const result = resolveFireberryPrefill(input({ quote: { ...quote, pcfformpayload } }));
      expect(result.customer.displayName).toBe("לקוח בדיקה");
      expect(result.quoteDefaults.form.origin.city).toBe("תל אביב");
    }
  });

  it("rejects a quote meeting whose objectid and pcfquote disagree", () => {
    expect(() => resolveFireberryPrefill(input({
      meeting: { ...meeting, objectid: "different-quote" },
    }))).toThrowError(PrefillSourceError);
  });

  it("rejects records that break the meeting-to-quote-to-account chain", () => {
    expect(() => resolveFireberryPrefill(input({ account: { ...account, accountid: "other-account" } })))
      .toThrow(/customer could not be resolved/);
    expect(() => resolveFireberryPrefill(input({
      quoteLines: [{ customobject1000id: "line-1", pcfsystemfield100: "other-quote" }],
    }))).toThrow(/different quote/);
  });
});
