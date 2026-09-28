import type { MovingQuoteFormData } from "../model";
export const scheduleSection = (d: MovingQuoteFormData["schedule"]) => `<fieldset><legend>מועדים</legend><div class="grid">
  <label>מועד הובלה<input type="date" name="schedule.moveDate" value="${d.moveDate}"></label>
  <label>שעת הובלה<input type="time" name="schedule.moveTime" value="${d.moveTime}"></label>
  <label>מועד אריזה<input type="date" name="schedule.packingDate" value="${d.packingDate}"></label>
  <label>שעת אריזה<input type="time" name="schedule.packingTime" value="${d.packingTime}"></label>
  <label class="check"><input type="checkbox" name="schedule.safeStorage" ${d.safeStorage ? "checked" : ""}>אחסון בטוח</label>
</div></fieldset>`;
