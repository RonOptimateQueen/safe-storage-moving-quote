import type { MovingQuoteFormData } from "../model";

const esc = (value: string) => value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");
const input = (label: string, name: string, value: string, type = "text") =>
  `<label>${label}<input type="${type}" name="${name}" value="${esc(value)}"></label>`;

export function customerSection(data: MovingQuoteFormData["customer"]): string {
  return `<fieldset><legend>פרטי לקוח</legend><div class="grid">
    ${input("שם מלא", "customer.displayName", data.displayName)}
    ${input("איש קשר", "customer.contactName", data.contactName)}
    ${input("טלפון נייד", "customer.mobilePhone", data.mobilePhone, "tel")}
    ${input("טלפון נוסף", "customer.alternatePhone", data.alternatePhone, "tel")}
    ${input("דואר אלקטרוני", "customer.email", data.email, "email")}
  </div></fieldset>`;
}
