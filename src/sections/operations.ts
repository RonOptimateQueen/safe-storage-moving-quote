import type { MovingQuoteFormData, TruckType } from "../model";
const esc = (v: string) => v.replaceAll("&", "&amp;").replaceAll('"', "&quot;");
export const operationsSection = (d: MovingQuoteFormData["operations"], trucks: TruckType[]) => `<fieldset><legend>ביצוע ההובלה</legend>
  <div class="truck-grid">${trucks.map((t) => `<label class="check"><input type="checkbox" name="operations.truckTypes" value="${t}" ${d.truckTypes.includes(t) ? "checked" : ""}>${t}</label>`).join("")}</div>
  <div class="grid"><label>הערות למשאיות<textarea name="operations.truckNotes">${esc(d.truckNotes)}</textarea></label><label>הערכת שעות<input name="operations.estimatedHours" inputmode="decimal" value="${esc(d.estimatedHours)}"></label><label>קרטונים ואריזה<textarea name="operations.cartonsAndPackingNotes">${esc(d.cartonsAndPackingNotes)}</textarea></label></div>
</fieldset>`;
