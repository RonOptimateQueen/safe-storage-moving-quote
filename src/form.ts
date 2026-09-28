import { calculateLineAmount, type CargoItem, type MovingQuoteFormData, type QuoteLineDraft, type TruckType } from "./model";
import { addressesSection } from "./sections/addresses";
import { cargoSection } from "./sections/cargo";
import { customerSection } from "./sections/customer";
import { operationsSection } from "./sections/operations";
import { questionsSection } from "./sections/questions";
import { quoteLinesSection } from "./sections/quote-lines";
import { scheduleSection } from "./sections/schedule";

export interface PrefillResponse {
  linkStatus: "active" | "revoked";
  customer: { displayName: string; contactName: string | null; mobilePhone: string | null; alternatePhone: string | null; email: string | null };
  meeting: { subject: string; scheduledStart: string | null; ownerName: string | null };
  quoteDefaults: { quoteId: string | null; version: number; signatureStatus: "none" | "pending" | "signed" | "rejected" | "cancelled"; form: MovingQuoteFormData };
  cargoOptions: Array<{ code: string; label: string }>;
  truckOptions: TruckType[];
}

const truckTypes = new Set<string>(["משאית 7 מ'", "משאית 6 מ'", "משאית 5 מ'", "משאית 4 מ'", "טרנזית"]);
const signatureStatuses = new Set<string>(["none", "pending", "signed", "rejected", "cancelled"]);

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const isString = (value: unknown): value is string => typeof value === "string";
const isNullableString = (value: unknown): value is string | null => value === null || isString(value);
const isPositiveInteger = (value: unknown): value is number => typeof value === "number" && Number.isInteger(value) && value >= 1;
const hasStrings = (value: Record<string, unknown>, keys: string[]) => keys.every((key) => isString(value[key]));
const isTruckType = (value: unknown): value is TruckType => isString(value) && truckTypes.has(value);
const isSignatureStatus = (value: unknown): value is PrefillResponse["quoteDefaults"]["signatureStatus"] => isString(value) && signatureStatuses.has(value);

function isMovingQuoteFormData(value: unknown): value is MovingQuoteFormData {
  if (!isRecord(value)) return false;
  const { customer, origin, destination, schedule, cargo, operations, quoteLines, questions } = value;
  if (!isRecord(customer) || !hasStrings(customer, ["displayName", "contactName", "mobilePhone", "alternatePhone", "email"])) return false;
  if (!isRecord(origin) || !hasStrings(origin, ["city", "address", "number", "entrance", "apartment", "floor", "additionalLoadingAddress", "accessNotes"]) || typeof origin.elevator !== "boolean") return false;
  if (!isRecord(destination) || !hasStrings(destination, ["city", "address", "floor", "additionalUnloadingAddress", "notes"]) || typeof destination.elevator !== "boolean") return false;
  if (!isRecord(schedule) || !hasStrings(schedule, ["moveDate", "moveTime", "packingDate", "packingTime"]) || typeof schedule.safeStorage !== "boolean") return false;
  if (!Array.isArray(cargo) || !cargo.every((item) => isRecord(item) && hasStrings(item, ["code", "label", "note"]) && typeof item.selected === "boolean")) return false;
  if (!isRecord(operations) || !hasStrings(operations, ["truckNotes", "estimatedHours", "cartonsAndPackingNotes"]) || !Array.isArray(operations.truckTypes) || !operations.truckTypes.every(isTruckType)) return false;
  if (!Array.isArray(quoteLines) || !quoteLines.every((line) => isRecord(line) && hasStrings(line, ["productId", "description", "notes", "quantity", "unit", "unitPriceBeforeVat", "lineAmountBeforeVat"]) && typeof line.includedInTotal === "boolean")) return false;
  return isRecord(questions) && hasStrings(questions, ["internalFloorAtDestination", "truckParkingNearEntrance", "finalNotes"]);
}

function isPrefillResponse(value: unknown): value is PrefillResponse {
  if (!isRecord(value) || (value.linkStatus !== "active" && value.linkStatus !== "revoked") || !isRecord(value.customer) || !isString(value.customer.displayName) || !isNullableString(value.customer.contactName) || !isNullableString(value.customer.mobilePhone) || !isNullableString(value.customer.alternatePhone) || !isNullableString(value.customer.email) || !isRecord(value.meeting) || !isString(value.meeting.subject) || !isNullableString(value.meeting.scheduledStart) || !isNullableString(value.meeting.ownerName) || !isRecord(value.quoteDefaults) || !isNullableString(value.quoteDefaults.quoteId) || !isPositiveInteger(value.quoteDefaults.version) || !isSignatureStatus(value.quoteDefaults.signatureStatus) || !isMovingQuoteFormData(value.quoteDefaults.form) || !Array.isArray(value.cargoOptions) || !value.cargoOptions.every((option) => isRecord(option) && hasStrings(option, ["code", "label"])) || !Array.isArray(value.truckOptions) || !value.truckOptions.every(isTruckType)) {
    return false;
  }
  return true;
}

export function requireActivePrefill(value: unknown): PrefillResponse {
  if (!isPrefillResponse(value) || value.linkStatus !== "active") {
    throw new Error("PREFILL_UNAVAILABLE");
  }
  return value;
}

const read = (form: HTMLFormElement, name: string) => (form.elements.namedItem(name) as HTMLInputElement | HTMLTextAreaElement | null)?.value ?? "";
const checked = (form: HTMLFormElement, name: string) => Boolean((form.elements.namedItem(name) as HTMLInputElement | null)?.checked);

export function renderMovingQuoteForm(prefill: PrefillResponse, target: Element): HTMLFormElement {
  const activePrefill = requireActivePrefill(prefill);
  const data = activePrefill.quoteDefaults.form;
  const form = document.createElement("form");
  form.dir = "rtl";
  form.dataset.version = String(activePrefill.quoteDefaults.version);
  form.innerHTML = `<header><h1>הצעת מחיר להובלה</h1><p>${activePrefill.meeting.ownerName ? `נציג: ${activePrefill.meeting.ownerName}` : ""}</p></header>${customerSection(data.customer)}${addressesSection(data)}${scheduleSection(data.schedule)}${cargoSection(data.cargo)}${operationsSection(data.operations, activePrefill.truckOptions)}${quoteLinesSection(data.quoteLines)}${questionsSection(data.questions)}<button type="submit">יצירת הצעה ושליחה לחתימה</button>`;
  (form as HTMLFormElement & { _initialData?: MovingQuoteFormData })._initialData = structuredClone(data);
  target.replaceChildren(form);
  return form;
}

export function serializeMovingQuoteForm(form: HTMLFormElement): MovingQuoteFormData {
  const initial = (form as HTMLFormElement & { _initialData?: MovingQuoteFormData })._initialData;
  if (!initial) throw new Error("הטופס לא אותחל");
  const result = structuredClone(initial);
  for (const key of Object.keys(result.customer) as Array<keyof typeof result.customer>) result.customer[key] = read(form, `customer.${key}`);
  const originText = ["city", "address", "number", "entrance", "apartment", "floor", "additionalLoadingAddress", "accessNotes"] as const;
  for (const key of originText) result.origin[key] = read(form, `origin.${key}`);
  result.origin.elevator = checked(form, "origin.elevator");
  const destinationText = ["city", "address", "floor", "additionalUnloadingAddress", "notes"] as const;
  for (const key of destinationText) result.destination[key] = read(form, `destination.${key}`);
  result.destination.elevator = checked(form, "destination.elevator");
  result.schedule.moveDate = read(form, "schedule.moveDate"); result.schedule.moveTime = read(form, "schedule.moveTime"); result.schedule.packingDate = read(form, "schedule.packingDate"); result.schedule.packingTime = read(form, "schedule.packingTime"); result.schedule.safeStorage = checked(form, "schedule.safeStorage");
  result.cargo = result.cargo.map((item): CargoItem => ({ ...item, selected: checked(form, `cargo.${item.code}.selected`), note: read(form, `cargo.${item.code}.note`) }));
  result.operations.truckTypes = [...form.querySelectorAll<HTMLInputElement>("[name='operations.truckTypes']:checked")].map((x) => x.value as TruckType);
  result.operations.truckNotes = read(form, "operations.truckNotes"); result.operations.estimatedHours = read(form, "operations.estimatedHours"); result.operations.cartonsAndPackingNotes = read(form, "operations.cartonsAndPackingNotes");
  result.quoteLines = result.quoteLines.map((line, index): QuoteLineDraft => {
    const quantity = read(form, `quoteLines.${index}.quantity`);
    const unitPriceBeforeVat = read(form, `quoteLines.${index}.unitPriceBeforeVat`);
    const amount = calculateLineAmount(quantity, unitPriceBeforeVat);
    if (!amount.ok) throw new Error(amount.message);
    return {
      ...line,
      description: read(form, `quoteLines.${index}.description`),
      notes: read(form, `quoteLines.${index}.notes`),
      quantity,
      unit: read(form, `quoteLines.${index}.unit`),
      unitPriceBeforeVat,
      lineAmountBeforeVat: amount.value,
      includedInTotal: checked(form, `quoteLines.${index}.includedInTotal`),
    };
  });
  result.questions.internalFloorAtDestination = read(form, "questions.internalFloorAtDestination"); result.questions.truckParkingNearEntrance = read(form, "questions.truckParkingNearEntrance"); result.questions.finalNotes = read(form, "questions.finalNotes");
  return result;
}
