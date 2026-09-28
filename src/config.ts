export interface RuntimeConfig {
  prefillUrl: string;
  submitUrl: string;
  maxPhotoBytes: number;
  tokenQueryKey: string;
}

export type RuntimeConfigSource = Partial<Record<keyof RuntimeConfig, string | number>>;

export function readRuntimeConfig(source: RuntimeConfigSource): RuntimeConfig {
  const prefillUrl = String(source.prefillUrl ?? "").trim();
  const submitUrl = String(source.submitUrl ?? "").trim();
  if (!prefillUrl || !submitUrl) {
    throw new Error("חסרה כתובת חיבור לטופס. יש לפנות למנהל המערכת.");
  }

  const maxPhotoBytes = Number(source.maxPhotoBytes ?? 8_000_000);
  if (!Number.isSafeInteger(maxPhotoBytes) || maxPhotoBytes <= 0) {
    throw new Error("הגדרת גודל התמונות אינה תקינה");
  }

  const tokenQueryKey = String(source.tokenQueryKey ?? "token").trim();
  if (!tokenQueryKey) throw new Error("חסר שם פרמטר הקישור");

  return { prefillUrl, submitUrl, maxPhotoBytes, tokenQueryKey };
}
