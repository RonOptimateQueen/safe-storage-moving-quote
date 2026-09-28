import type { MovingQuoteFormData } from "../model";
const esc = (v: string) => v.replaceAll("&", "&amp;").replaceAll("<", "&lt;");
export const questionsSection = (d: MovingQuoteFormData["questions"]) => `<fieldset><legend>שאלות והערות</legend>
  <label>האם בבית החדש יש קומה פנימית?<textarea name="questions.internalFloorAtDestination">${esc(d.internalFloorAtDestination)}</textarea></label>
  <label>האם יש חניה למשאית בסמוך לכניסת הבית?<textarea name="questions.truckParkingNearEntrance">${esc(d.truckParkingNearEntrance)}</textarea></label>
  <label>האם תרצו להוסיף עוד משהו לפני סגירת הצעה זו?<textarea name="questions.finalNotes">${esc(d.finalNotes)}</textarea></label>
  <div class="photos"><label>תמונה 1<input type="file" name="photos" accept="image/*"></label><label>תמונה 2<input type="file" name="photos" accept="image/*"></label><label>תמונה 3<input type="file" name="photos" accept="image/*"></label></div>
</fieldset>`;
