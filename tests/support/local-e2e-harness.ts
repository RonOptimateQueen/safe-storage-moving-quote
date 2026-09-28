import type { QuoteSubmission, SubmitResponse } from "../../src/api";
import { calculateIncludedTotal, calculateLineAmount, type MovingQuoteFormData, type QuoteLineDraft } from "../../src/model";
import {
  resolveFireberryPrefill,
  type FireberryAccount,
  type FireberryMeeting,
  type FireberryQuote,
  type FireberryQuoteLine,
} from "../../src/prefill-resolver";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface LocalQuoteRecord {
  opportunityid: string;
  accountid: string;
  ownerid: string;
  pcfquotestatus: 2 | 3;
  pcfquoteversion: number;
  pcfquotediscount: 0;
  pcfquotepayable: string;
  pcfformpayload: MovingQuoteFormData;
  pcfeasydoid: string;
  pcfsignedon: string | null;
}

export interface LocalQuoteLineRecord extends QuoteLineDraft {
  customobject1000id: string;
  pcfsystemfield100: string;
}

export interface LocalCalendarEvent {
  activityid: string;
  kind: "move" | "packing";
  scheduledstart: string;
  scheduledend: string;
  pcfjob: string;
}

export interface LocalJobRecord {
  customobject1006id: string;
  pcfcustomer: string;
  pcfquote: string;
  pcfjobstatus: 1 | 7;
  pcfscheduledon: string | null;
  pcfpackingon: string | null;
  pcfmoveevent: string | null;
  pcfpackingevent: string | null;
}

export interface LocalSimulationCounts {
  accounts: number;
  meetings: number;
  quotes: number;
  quoteLines: number;
  signingProcesses: number;
  jobs: number;
  calendarEvents: number;
}

interface LocalSimulationSeed {
  account: FireberryAccount;
  meeting: FireberryMeeting;
  quote?: FireberryQuote | null;
  quoteLines?: FireberryQuoteLine[];
}

interface SignOptions {
  callbackId: string;
  signedOn: string;
}

export type LocalQuoteSubmission = Omit<QuoteSubmission, "form"> & { form: MovingQuoteFormData };

function addHours(localDateTime: string, hours: number): string {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})$/.exec(localDateTime);
  if (!match) throw new Error(`Invalid local date-time: ${localDateTime}`);
  const minutes = Number(match[2]) * 60 + Number(match[3]) + hours * 60;
  const date = new Date(`${match[1]}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + Math.floor(minutes / 1440));
  const normalized = ((minutes % 1440) + 1440) % 1440;
  return `${date.toISOString().slice(0, 10)}T${String(Math.floor(normalized / 60)).padStart(2, "0")}:${String(normalized % 60).padStart(2, "0")}`;
}

function localDateTime(date: string, time: string): string | null {
  if (!date || !time) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) {
    throw new Error("Invalid schedule value");
  }
  return `${date}T${time}`;
}

function canonicalLines(lines: QuoteLineDraft[]): QuoteLineDraft[] {
  return lines.map((line) => {
    const amount = calculateLineAmount(line.quantity, line.unitPriceBeforeVat);
    if (!amount.ok) throw new Error(amount.message);
    return { ...structuredClone(line), lineAmountBeforeVat: amount.value };
  });
}

export class LocalMovingQuoteSimulation {
  readonly account: FireberryAccount;
  readonly meeting: FireberryMeeting;
  readonly sourceQuote: FireberryQuote | null;
  readonly sourceQuoteLines: FireberryQuoteLine[];
  readonly quotes: LocalQuoteRecord[] = [];
  readonly quoteLines: LocalQuoteLineRecord[] = [];
  readonly signingProcesses = new Set<string>();
  readonly jobs: LocalJobRecord[] = [];
  readonly calendarEvents: LocalCalendarEvent[] = [];

  private readonly submissionResults = new Map<string, SubmitResponse>();
  private readonly callbackJobs = new Map<string, LocalJobRecord>();

  constructor(seed: LocalSimulationSeed) {
    this.account = structuredClone(seed.account);
    this.meeting = structuredClone(seed.meeting);
    this.sourceQuote = structuredClone(seed.quote ?? null);
    this.sourceQuoteLines = structuredClone(seed.quoteLines ?? []);
  }

  loadPrefill() {
    return resolveFireberryPrefill({
      account: this.account,
      meeting: this.meeting,
      quote: this.sourceQuote,
      quoteLines: this.sourceQuoteLines,
    });
  }

  submit(payload: LocalQuoteSubmission, idempotencyKey: string): SubmitResponse {
    if (!UUID_PATTERN.test(idempotencyKey) || payload.clientSubmissionId !== idempotencyKey) {
      throw new Error("INVALID_SUBMISSION");
    }
    const replay = this.submissionResults.get(idempotencyKey);
    if (replay) return structuredClone(replay);

    const lines = canonicalLines(payload.form.quoteLines);
    const total = calculateIncludedTotal(lines);
    if (!total.ok) throw new Error(total.message);

    const quoteId = `local-quote-${this.quotes.length + 1}`;
    const signingRequestId = `local-signing-${this.signingProcesses.size + 1}`;
    const quote: LocalQuoteRecord = {
      opportunityid: quoteId,
      accountid: this.account.accountid,
      ownerid: String(this.meeting.ownerid ?? ""),
      pcfquotestatus: 2,
      pcfquoteversion: 1,
      pcfquotediscount: 0,
      pcfquotepayable: total.value,
      pcfformpayload: { ...structuredClone(payload.form), quoteLines: lines },
      pcfeasydoid: signingRequestId,
      pcfsignedon: null,
    };
    this.quotes.push(quote);
    lines.forEach((line, index) => this.quoteLines.push({
      ...line,
      customobject1000id: `local-line-${index + 1}`,
      pcfsystemfield100: quoteId,
    }));
    this.signingProcesses.add(signingRequestId);

    const response: SubmitResponse = {
      submissionId: payload.clientSubmissionId,
      quoteId,
      quoteVersion: 1,
      status: "sent",
      signingRequestId,
    };
    this.submissionResults.set(idempotencyKey, response);
    return structuredClone(response);
  }

  signQuote(quoteId: string, options: SignOptions): LocalJobRecord {
    const replay = this.callbackJobs.get(options.callbackId);
    if (replay) return structuredClone(replay);

    const quote = this.quotes.find((candidate) => candidate.opportunityid === quoteId);
    if (!quote) throw new Error("QUOTE_NOT_FOUND");
    quote.pcfquotestatus = 3;
    quote.pcfsignedon = options.signedOn;

    const moveStart = localDateTime(quote.pcfformpayload.schedule.moveDate, quote.pcfformpayload.schedule.moveTime);
    const packingStart = localDateTime(
      quote.pcfformpayload.schedule.packingDate,
      quote.pcfformpayload.schedule.packingTime,
    );
    const jobId = `local-job-${this.jobs.length + 1}`;
    const job: LocalJobRecord = {
      customobject1006id: jobId,
      pcfcustomer: quote.accountid,
      pcfquote: quote.opportunityid,
      pcfjobstatus: moveStart ? 1 : 7,
      pcfscheduledon: moveStart,
      pcfpackingon: packingStart,
      pcfmoveevent: null,
      pcfpackingevent: null,
    };

    if (moveStart) job.pcfmoveevent = this.upsertEvent(jobId, "move", moveStart).activityid;
    if (packingStart) job.pcfpackingevent = this.upsertEvent(jobId, "packing", packingStart).activityid;
    this.jobs.push(job);
    this.callbackJobs.set(options.callbackId, job);
    return structuredClone(job);
  }

  counts(): LocalSimulationCounts {
    return {
      accounts: 1,
      meetings: 1,
      quotes: this.quotes.length,
      quoteLines: this.quoteLines.length,
      signingProcesses: this.signingProcesses.size,
      jobs: this.jobs.length,
      calendarEvents: this.calendarEvents.length,
    };
  }

  private upsertEvent(jobId: string, kind: LocalCalendarEvent["kind"], start: string): LocalCalendarEvent {
    const existing = this.calendarEvents.find((event) => event.pcfjob === jobId && event.kind === kind);
    if (existing) {
      existing.scheduledstart = start;
      existing.scheduledend = addHours(start, 2);
      return existing;
    }
    const event: LocalCalendarEvent = {
      activityid: `local-event-${this.calendarEvents.length + 1}`,
      kind,
      scheduledstart: start,
      scheduledend: addHours(start, 2),
      pcfjob: jobId,
    };
    this.calendarEvents.push(event);
    return event;
  }
}
