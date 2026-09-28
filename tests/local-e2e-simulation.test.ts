import { describe, expect, it } from "vitest";
import { calculateIncludedTotal } from "../src/model";
import { LocalMovingQuoteSimulation, type LocalQuoteSubmission } from "./support/local-e2e-harness";

const submissionId = "11111111-2222-4333-8444-555555555555";

function newCustomerSimulation() {
  return new LocalMovingQuoteSimulation({
    account: {
      accountid: "account-e2e-01",
      accountname: "בדיקת E2E — לקוח חדש 01 (דוגמה)",
      telephone1: "050-0000001",
      emailaddress1: "moving-quote-e2e@example.test",
      billingcity: "תל אביב",
      billingstreet: "רחוב בדיקה",
    },
    meeting: {
      activityid: "meeting-e2e-01",
      subject: "בדיקת E2E — פגישת הצעת מחיר (דוגמה)",
      scheduledstart: "2026-10-05T10:00:00+03:00",
      objectid: "account-e2e-01",
      objecttypecode: 1,
      ownerid: "owner-e2e-01",
      owneridname: "נציגת בדיקה",
      pcfmeetingtype: 1,
      pcfquote: null,
    },
  });
}

function editedSubmission(simulation: LocalMovingQuoteSimulation): LocalQuoteSubmission {
  const prefill = simulation.loadPrefill();
  const form = structuredClone(prefill.quoteDefaults.form);
  form.customer.email = "corrected-e2e@example.test";
  form.destination.city = "חיפה";
  form.destination.address = "רחוב היעד 8";
  form.schedule.moveDate = "2026-10-20";
  form.schedule.moveTime = "09:00";
  form.schedule.packingDate = "2026-10-19";
  form.schedule.packingTime = "13:00";
  form.operations.truckTypes = ["משאית 5 מ'"];
  form.quoteLines = [
    { productId: "product-move", description: "הובלה", notes: "", quantity: "2", unit: "יחידה", unitPriceBeforeVat: "100", lineAmountBeforeVat: "9999.99", includedInTotal: true },
    { productId: "product-packing", description: "אריזה", notes: "", quantity: "3", unit: "שעה", unitPriceBeforeVat: "50", lineAmountBeforeVat: "0.01", includedInTotal: true },
  ];
  return { token: "opaque_token_e2e_01", clientSubmissionId: submissionId, form };
}

describe("local-only moving quote end-to-end simulation", () => {
  it("simulates new customer through signature, job and two-hour calendar events", () => {
    const simulation = newCustomerSimulation();
    const prefill = simulation.loadPrefill();

    expect(prefill.customer).toMatchObject({
      displayName: "בדיקת E2E — לקוח חדש 01 (דוגמה)",
      email: "moving-quote-e2e@example.test",
    });
    expect(prefill.quoteDefaults).toMatchObject({ quoteId: null, version: 1, signatureStatus: "none" });

    const payload = editedSubmission(simulation);
    const first = simulation.submit(payload, submissionId);
    const conflictingRetry = structuredClone(payload);
    conflictingRetry.form.quoteLines[0].quantity = "999";
    const retry = simulation.submit(conflictingRetry, submissionId);

    expect(retry).toEqual(first);
    expect(simulation.counts()).toEqual({
      accounts: 1,
      meetings: 1,
      quotes: 1,
      quoteLines: 2,
      signingProcesses: 1,
      jobs: 0,
      calendarEvents: 0,
    });
    expect(simulation.quoteLines.map((line) => line.lineAmountBeforeVat)).toEqual(["200.00", "150.00"]);
    expect(calculateIncludedTotal(simulation.quoteLines)).toEqual({ ok: true, value: "350.00" });
    expect(simulation.quotes[0]).toMatchObject({
      pcfquotestatus: 2,
      pcfquoteversion: 1,
      pcfquotediscount: 0,
      pcfquotepayable: "350.00",
      pcfsignedon: null,
    });
    expect(simulation.quotes[0].pcfformpayload.customer.email).toBe("corrected-e2e@example.test");

    const callback = { callbackId: "easydo-callback-e2e-01", signedOn: "2026-10-06T12:00:00+03:00" };
    const job = simulation.signQuote(first.quoteId, callback);
    const callbackRetry = simulation.signQuote(first.quoteId, callback);

    expect(callbackRetry).toEqual(job);
    expect(job).toMatchObject({
      pcfcustomer: "account-e2e-01",
      pcfquote: first.quoteId,
      pcfjobstatus: 1,
      pcfscheduledon: "2026-10-20T09:00",
      pcfpackingon: "2026-10-19T13:00",
    });
    expect(simulation.quotes[0]).toMatchObject({ pcfquotestatus: 3, pcfsignedon: callback.signedOn });
    expect(simulation.calendarEvents).toEqual([
      expect.objectContaining({ kind: "move", scheduledstart: "2026-10-20T09:00", scheduledend: "2026-10-20T11:00" }),
      expect.objectContaining({ kind: "packing", scheduledstart: "2026-10-19T13:00", scheduledend: "2026-10-19T15:00" }),
    ]);
    expect(simulation.counts()).toEqual({
      accounts: 1,
      meetings: 1,
      quotes: 1,
      quoteLines: 2,
      signingProcesses: 1,
      jobs: 1,
      calendarEvents: 2,
    });
  });

  it("rejects a mismatched idempotency header before creating anything", () => {
    const simulation = newCustomerSimulation();
    const payload = editedSubmission(simulation);

    expect(() => simulation.submit(payload, "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee")).toThrow("INVALID_SUBMISSION");
    expect(simulation.counts()).toMatchObject({ quotes: 0, quoteLines: 0, signingProcesses: 0 });
  });

  it("creates an awaiting-scheduling job without a move event when date or time is absent", () => {
    const simulation = newCustomerSimulation();
    const payload = editedSubmission(simulation);
    payload.form.schedule.moveTime = "";
    payload.form.schedule.packingDate = "";
    payload.form.schedule.packingTime = "";
    const response = simulation.submit(payload, submissionId);

    const job = simulation.signQuote(response.quoteId, { callbackId: "easydo-callback-e2e-02", signedOn: "2026-10-06T12:00:00+03:00" });

    expect(job).toMatchObject({ pcfjobstatus: 7, pcfscheduledon: null, pcfmoveevent: null, pcfpackingevent: null });
    expect(simulation.calendarEvents).toHaveLength(0);
  });
});
