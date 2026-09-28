import { calculateLineAmount, type MovingQuoteFormData, type QuoteLineDraft, type TruckType } from "./model";
import type { PrefillResponse } from "./form";

type FireberryId = string | null | undefined;

export interface FireberryMeeting {
  activityid: string;
  subject?: string | null;
  scheduledstart?: string | null;
  objectid?: FireberryId;
  objecttypecode?: number | string | null;
  ownerid?: FireberryId;
  owneridname?: string | null;
  pcfmeetingtype?: number | string | null;
  pcfquote?: FireberryId;
}

export interface FireberryQuote {
  opportunityid: string;
  accountid?: FireberryId;
  contacttid?: FireberryId;
  ownerid?: FireberryId;
  owneridname?: string | null;
  pcfquoteversion?: number | string | null;
  pcfsignaturestatus?: number | string | null;
  pcfformpayload?: unknown;
}

export interface FireberryAccount {
  accountid: string;
  accountname?: string | null;
  telephone1?: string | null;
  telephone2?: string | null;
  emailaddress1?: string | null;
  billingcity?: string | null;
  billingstreet?: string | null;
}

export interface FireberryContact {
  contactid: string;
  fullname?: string | null;
  mobilephone1?: string | null;
  mobilephone2?: string | null;
  telephone1?: string | null;
  telephone2?: string | null;
  emailaddress1?: string | null;
  accountid?: FireberryId;
}

export interface FireberryQuoteLine {
  customobject1000id: string;
  pcfsystemfield100?: FireberryId;
  pcfsystemfield101?: FireberryId;
  pcfsystemfield101name?: string | null;
  pcfsystemfield102?: number | string | null;
  pcfsystemfield103?: number | string | null;
  pcfsystemfield104?: string | null;
  pcflineid?: string | null;
  pcfunit?: string | null;
  pcfincludedintotal?: boolean | number | string | null;
  name?: string | null;
}

export interface PrefillResolutionInput {
  meeting: FireberryMeeting;
  quote?: FireberryQuote | null;
  account: FireberryAccount;
  contact?: FireberryContact | null;
  quoteLines?: FireberryQuoteLine[];
}

export class PrefillSourceError extends Error {
  readonly code = "PREFILL_SOURCE_ERROR";

  constructor(message: string) {
    super(message);
    this.name = "PrefillSourceError";
  }
}

export const CARGO_OPTIONS = [
  { code: "slidingClosets", label: "ארונות הזזה" },
  { code: "hingedClosets", label: "ארונות ציר" },
  { code: "plants", label: "הובלת עציצים" },
  { code: "piano", label: "הובלת פסנתר" },
  { code: "gardenFurniture", label: "הובלת רהיטי גן" },
  { code: "storageContents", label: "הובלת תכולת מחסן" },
  { code: "carpentry", label: "עבודות נגרות" },
  { code: "safe", label: "כספת" },
  { code: "hangingGarmentRacks", label: "מתקנים לתליית בגדים" },
] as const;

export const TRUCK_OPTIONS: TruckType[] = [
  "משאית 7 מ'",
  "משאית 6 מ'",
  "משאית 5 מ'",
  "משאית 4 מ'",
  "טרנזית",
];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isString = (value: unknown): value is string => typeof value === "string";
const hasStrings = (value: Record<string, unknown>, keys: string[]) =>
  keys.every((key) => isString(value[key]));
const clean = (value: unknown): string => (typeof value === "string" ? value.trim() : "");
const idEquals = (left: FireberryId, right: FireberryId) =>
  clean(left).toLowerCase() === clean(right).toLowerCase();
const first = (...values: unknown[]): string => values.map(clean).find(Boolean) ?? "";

function isMovingQuoteFormData(value: unknown): value is MovingQuoteFormData {
  if (!isRecord(value)) return false;
  const { customer, origin, destination, schedule, cargo, operations, quoteLines, questions } = value;
  return isRecord(customer)
    && hasStrings(customer, ["displayName", "contactName", "mobilePhone", "alternatePhone", "email"])
    && isRecord(origin)
    && hasStrings(origin, ["city", "address", "number", "entrance", "apartment", "floor", "additionalLoadingAddress", "accessNotes"])
    && typeof origin.elevator === "boolean"
    && isRecord(destination)
    && hasStrings(destination, ["city", "address", "floor", "additionalUnloadingAddress", "notes"])
    && typeof destination.elevator === "boolean"
    && isRecord(schedule)
    && hasStrings(schedule, ["moveDate", "moveTime", "packingDate", "packingTime"])
    && typeof schedule.safeStorage === "boolean"
    && Array.isArray(cargo)
    && cargo.every((item) => isRecord(item) && hasStrings(item, ["code", "label", "note"]) && typeof item.selected === "boolean")
    && isRecord(operations)
    && hasStrings(operations, ["truckNotes", "estimatedHours", "cartonsAndPackingNotes"])
    && Array.isArray(operations.truckTypes)
    && operations.truckTypes.every((truck) => TRUCK_OPTIONS.includes(truck as TruckType))
    && Array.isArray(quoteLines)
    && quoteLines.every((line) => isRecord(line)
      && hasStrings(line, ["productId", "description", "notes", "quantity", "unit", "unitPriceBeforeVat", "lineAmountBeforeVat"])
      && typeof line.includedInTotal === "boolean")
    && isRecord(questions)
    && hasStrings(questions, ["internalFloorAtDestination", "truckParkingNearEntrance", "finalNotes"]);
}

function parseSnapshot(value: unknown): MovingQuoteFormData | null {
  let parsed = value;
  if (typeof value === "string") {
    if (!value.trim()) return null;
    try {
      parsed = JSON.parse(value);
    } catch {
      return null;
    }
  }
  return isMovingQuoteFormData(parsed) ? structuredClone(parsed) : null;
}

function emptyForm(account: FireberryAccount, contact?: FireberryContact | null): MovingQuoteFormData {
  return {
    customer: {
      displayName: clean(account.accountname),
      contactName: clean(contact?.fullname),
      mobilePhone: first(contact?.mobilephone1, contact?.telephone1, account.telephone1),
      alternatePhone: first(contact?.mobilephone2, contact?.telephone2, account.telephone2),
      email: first(contact?.emailaddress1, account.emailaddress1),
    },
    origin: {
      city: clean(account.billingcity),
      address: clean(account.billingstreet),
      number: "",
      entrance: "",
      apartment: "",
      floor: "",
      elevator: false,
      additionalLoadingAddress: "",
      accessNotes: "",
    },
    destination: {
      city: "",
      address: "",
      floor: "",
      elevator: false,
      additionalUnloadingAddress: "",
      notes: "",
    },
    schedule: { moveDate: "", moveTime: "", packingDate: "", packingTime: "", safeStorage: false },
    cargo: CARGO_OPTIONS.map(({ code, label }) => ({ code, label, selected: false, note: "" })),
    operations: { truckTypes: [], truckNotes: "", estimatedHours: "", cartonsAndPackingNotes: "" },
    quoteLines: [],
    questions: { internalFloorAtDestination: "", truckParkingNearEntrance: "", finalNotes: "" },
  };
}

function decimalString(value: unknown, fallback: string): string {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) return String(value);
  if (typeof value === "string" && /^\d+(?:[.,]\d+)?$/.test(value.trim())) return value.trim().replace(",", ".");
  return fallback;
}

function includedInTotal(value: FireberryQuoteLine["pcfincludedintotal"]): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  return ["1", "true", "yes", "כן"].includes(clean(value).toLowerCase());
}

function mapQuoteLine(line: FireberryQuoteLine): QuoteLineDraft {
  const quantity = decimalString(line.pcfsystemfield102, "1");
  const unitPriceBeforeVat = decimalString(line.pcfsystemfield103, "0");
  const amount = calculateLineAmount(quantity, unitPriceBeforeVat);
  if (!amount.ok) throw new PrefillSourceError("Quote line contains an invalid quantity or price");
  return {
    productId: clean(line.pcfsystemfield101),
    description: first(line.pcfsystemfield104, line.pcfsystemfield101name, line.name),
    notes: "",
    quantity,
    unit: clean(line.pcfunit),
    unitPriceBeforeVat,
    lineAmountBeforeVat: amount.value,
    includedInTotal: includedInTotal(line.pcfincludedintotal),
  };
}

function quoteVersion(value: FireberryQuote["pcfquoteversion"]): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isInteger(parsed) && parsed >= 1 ? parsed : 1;
}

function signatureStatus(value: FireberryQuote["pcfsignaturestatus"]): PrefillResponse["quoteDefaults"]["signatureStatus"] {
  const normalized = clean(value).toLowerCase();
  if (["none", "pending", "signed", "rejected", "cancelled"].includes(normalized)) {
    return normalized as PrefillResponse["quoteDefaults"]["signatureStatus"];
  }
  return ({ "1": "none", "2": "pending", "3": "signed", "4": "rejected", "5": "cancelled" } as const)[normalized as "1"] ?? "none";
}

export function resolveFireberryPrefill(input: PrefillResolutionInput): PrefillResponse {
  const { meeting, quote = null, account, contact = null, quoteLines = [] } = input;
  if (!clean(meeting.activityid) || Number(meeting.pcfmeetingtype) !== 1 || !clean(meeting.ownerid)) {
    throw new PrefillSourceError("The source meeting is missing or is not a quote meeting");
  }

  const objectType = Number(meeting.objecttypecode);
  const linkedQuoteId = clean(meeting.pcfquote);
  let accountId = "";

  if (linkedQuoteId) {
    if (!quote || !idEquals(quote.opportunityid, linkedQuoteId)) {
      throw new PrefillSourceError("The linked quote could not be resolved");
    }
    if (objectType === 4 && !idEquals(meeting.objectid, linkedQuoteId)) {
      throw new PrefillSourceError("The meeting points to a different quote");
    }
    accountId = clean(quote.accountid);
  } else if (objectType === 1) {
    if (quote) throw new PrefillSourceError("An unlinked quote was supplied for an account meeting");
    accountId = clean(meeting.objectid);
  } else {
    throw new PrefillSourceError("The meeting has no supported customer source");
  }

  if (!accountId || !idEquals(account.accountid, accountId)) {
    throw new PrefillSourceError("The linked customer could not be resolved");
  }

  const contactId = clean(quote?.contacttid);
  if (contactId && (!contact || !idEquals(contact.contactid, contactId))) {
    throw new PrefillSourceError("The linked contact could not be resolved");
  }
  if (contact && contact.accountid && !idEquals(contact.accountid, accountId)) {
    throw new PrefillSourceError("The linked contact belongs to a different customer");
  }

  if (!linkedQuoteId && quoteLines.length) {
    throw new PrefillSourceError("Quote lines were supplied without a quote");
  }
  for (const line of quoteLines) {
    if (!idEquals(line.pcfsystemfield100, linkedQuoteId)) {
      throw new PrefillSourceError("A quote line belongs to a different quote");
    }
  }

  const base = emptyForm(account, contactId ? contact : null);
  const snapshot = quote ? parseSnapshot(quote.pcfformpayload) : null;
  const form = snapshot ?? base;
  form.quoteLines = quoteLines
    .slice()
    .sort((left, right) => first(left.pcflineid, left.customobject1000id).localeCompare(first(right.pcflineid, right.customobject1000id)))
    .map(mapQuoteLine);

  return {
    linkStatus: "active",
    customer: {
      displayName: form.customer.displayName,
      contactName: form.customer.contactName || null,
      mobilePhone: form.customer.mobilePhone || null,
      alternatePhone: form.customer.alternatePhone || null,
      email: form.customer.email || null,
    },
    meeting: {
      subject: clean(meeting.subject),
      scheduledStart: clean(meeting.scheduledstart) || null,
      ownerName: first(meeting.owneridname, quote?.owneridname) || null,
    },
    quoteDefaults: {
      quoteId: linkedQuoteId || null,
      version: quote ? quoteVersion(quote.pcfquoteversion) : 1,
      signatureStatus: quote ? signatureStatus(quote.pcfsignaturestatus) : "none",
      form,
    },
    cargoOptions: CARGO_OPTIONS.map(({ code, label }) => ({ code, label })),
    truckOptions: [...TRUCK_OPTIONS],
  };
}
