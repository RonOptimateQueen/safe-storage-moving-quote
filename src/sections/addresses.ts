import type { MovingQuoteFormData } from "../model";

const esc = (v: string) => v.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");
const i = (label: string, name: string, value: string) => `<label>${label}<input name="${name}" value="${esc(value)}"></label>`;
const c = (label: string, name: string, checked: boolean) => `<label class="check"><input type="checkbox" name="${name}" ${checked ? "checked" : ""}>${label}</label>`;

export function addressesSection(data: MovingQuoteFormData): string {
  return `<fieldset><legend>כתובת העמסה</legend><div class="grid">
    ${i("עיר", "origin.city", data.origin.city)}${i("רחוב", "origin.address", data.origin.address)}${i("מספר", "origin.number", data.origin.number)}
    ${i("כניסה", "origin.entrance", data.origin.entrance)}${i("דירה", "origin.apartment", data.origin.apartment)}${i("קומה", "origin.floor", data.origin.floor)}
    ${c("מעלית", "origin.elevator", data.origin.elevator)}${i("כתובת העמסה נוספת", "origin.additionalLoadingAddress", data.origin.additionalLoadingAddress)}
    <label class="wide">הערות גישה<textarea name="origin.accessNotes">${esc(data.origin.accessNotes)}</textarea></label>
  </div></fieldset>
  <fieldset><legend>כתובת פריקה</legend><div class="grid">
    ${i("עיר", "destination.city", data.destination.city)}${i("כתובת", "destination.address", data.destination.address)}${i("קומה", "destination.floor", data.destination.floor)}
    ${c("מעלית", "destination.elevator", data.destination.elevator)}${i("כתובת פריקה נוספת", "destination.additionalUnloadingAddress", data.destination.additionalUnloadingAddress)}
    <label class="wide">הערות<textarea name="destination.notes">${esc(data.destination.notes)}</textarea></label>
  </div></fieldset>`;
}
