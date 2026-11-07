/**
 * A picked photo → a small JPEG data URL a phone can keep for a while.
 *
 * 960 px on the long edge at a modest quality is about 60–120 KB, so a day's
 * worth fits in the browser's storage. It is still a JPEG (the first bytes
 * are `/9j/`), so sharing one with the group later needs no conversion
 * (ADR 014's ceiling is 700,000 characters). Browser only.
 */
const EDGE_PX = 960;

export async function shrinkForDevice(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file, {
    imageOrientation: "from-image",
  });
  const scale = Math.min(1, EDGE_PX / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no canvas");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.68);
}
