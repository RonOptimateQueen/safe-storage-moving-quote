import type { CargoItem } from "../model";
const esc = (v: string) => v.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");
export const cargoSection = (items: CargoItem[]) => `<fieldset><legend>תכולה מיוחדת</legend><div class="choice-list">${items.map((x) => `<div class="choice-row"><label class="check"><input type="checkbox" name="cargo.${x.code}.selected" ${x.selected ? "checked" : ""}>${esc(x.label)}</label><label>הערה<input name="cargo.${x.code}.note" value="${esc(x.note)}"></label></div>`).join("")}</div></fieldset>`;
