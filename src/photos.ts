const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/heic", "image/heif"]);

export function validatePhotos(files: File[], maxPhotoBytes: number): File[] {
  if (files.length > 3) throw new Error("אפשר לצרף עד שלוש תמונות");
  for (const file of files) {
    if (!ALLOWED_TYPES.has(file.type.toLowerCase())) throw new Error("אפשר לצרף תמונות JPEG, PNG או HEIC בלבד");
    if (file.size > maxPhotoBytes) throw new Error(`התמונה ${file.name} גדולה מדי`);
  }
  return files;
}

export async function normalizePhoto(file: File, maxDimension = 2048): Promise<File> {
  if (typeof createImageBitmap !== "function") return file;
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("לא ניתן לעבד את התמונה");
  context.drawImage(bitmap, 0, 0, width, height); bitmap.close();
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error("לא ניתן לעבד את התמונה")), "image/jpeg", 0.86));
  return new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg", lastModified: Date.now() });
}
