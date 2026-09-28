export type TruckType =
  | "משאית 7 מ'"
  | "משאית 6 מ'"
  | "משאית 5 מ'"
  | "משאית 4 מ'"
  | "טרנזית";

export interface CargoItem {
  code: string;
  label: string;
  selected: boolean;
  note: string;
}

export interface QuoteLineDraft {
  productId: string;
  description: string;
  notes: string;
  quantity: string;
  unit: string;
  unitPriceBeforeVat: string;
  lineAmountBeforeVat: string;
  includedInTotal: boolean;
}

export interface MovingQuoteFormData {
  customer: {
    displayName: string;
    contactName: string;
    mobilePhone: string;
    alternatePhone: string;
    email: string;
  };
  origin: {
    city: string;
    address: string;
    number: string;
    entrance: string;
    apartment: string;
    floor: string;
    elevator: boolean;
    additionalLoadingAddress: string;
    accessNotes: string;
  };
  destination: {
    city: string;
    address: string;
    floor: string;
    elevator: boolean;
    additionalUnloadingAddress: string;
    notes: string;
  };
  schedule: {
    moveDate: string;
    moveTime: string;
    packingDate: string;
    packingTime: string;
    safeStorage: boolean;
  };
  cargo: CargoItem[];
  operations: {
    truckTypes: TruckType[];
    truckNotes: string;
    estimatedHours: string;
    cartonsAndPackingNotes: string;
  };
  quoteLines: QuoteLineDraft[];
  questions: {
    internalFloorAtDestination: string;
    truckParkingNearEntrance: string;
    finalNotes: string;
  };
}

type MoneyField = "quantity" | "unitPriceBeforeVat" | "lineAmountBeforeVat";
export type CalculationResult =
  | { ok: true; value: string }
  | { ok: false; field: MoneyField; message: string };

const DECIMAL_PATTERN = /^\d+(?:\.\d+)?$/;

function parseDecimal(value: string, field: MoneyField, maxDecimals?: number) {
  const normalized = value.trim().replace(",", ".");
  if (!DECIMAL_PATTERN.test(normalized)) {
    return { ok: false as const, field, message: "יש להזין מספר חיובי תקין" };
  }

  const [whole, fraction = ""] = normalized.split(".");
  if (maxDecimals !== undefined && fraction.length > maxDecimals) {
    return {
      ok: false as const,
      field,
      message: `אפשר להזין עד ${maxDecimals} ספרות אחרי הנקודה`,
    };
  }

  return {
    ok: true as const,
    integer: BigInt(`${whole}${fraction}`),
    scale: 10n ** BigInt(fraction.length),
  };
}

function formatAgorot(agorot: bigint): string {
  const shekels = agorot / 100n;
  const remainder = (agorot % 100n).toString().padStart(2, "0");
  return `${shekels}.${remainder}`;
}

function roundFraction(numerator: bigint, denominator: bigint): bigint {
  return (numerator + denominator / 2n) / denominator;
}

export function calculateLineAmount(quantity: string, unitPriceBeforeVat: string): CalculationResult {
  if (quantity.trim() === "" && unitPriceBeforeVat.trim() === "") {
    return { ok: true, value: "0.00" };
  }

  const parsedQuantity = parseDecimal(quantity, "quantity");
  if (!parsedQuantity.ok) return parsedQuantity;

  const parsedPrice = parseDecimal(unitPriceBeforeVat, "unitPriceBeforeVat", 2);
  if (!parsedPrice.ok) return parsedPrice;

  const priceAgorot = parsedPrice.integer * (100n / parsedPrice.scale);
  const amountAgorot = roundFraction(
    parsedQuantity.integer * priceAgorot,
    parsedQuantity.scale,
  );
  return { ok: true, value: formatAgorot(amountAgorot) };
}

export function calculateIncludedTotal(lines: QuoteLineDraft[]): CalculationResult {
  let total = 0n;
  for (const line of lines) {
    if (!line.includedInTotal) continue;
    const amount = parseDecimal(line.lineAmountBeforeVat, "lineAmountBeforeVat", 2);
    if (!amount.ok) return amount;
    total += amount.integer * (100n / amount.scale);
  }
  return { ok: true, value: formatAgorot(total) };
}
