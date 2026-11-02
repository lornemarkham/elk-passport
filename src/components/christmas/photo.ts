/**
 * A picked photo → base64 of a JPEG no longer than 1280px on its long edge,
 * small enough for `MAX_PHOTO_CHARS`. The same recipe Hockey's Memories uses
 * (`components/hockey/Memories.tsx`, not exported there); a shared helper is
 * named in the Christmas release notes as a candidate for `src/lib/media`.
 */
const EDGE_PX = 1280;
const MAX_CHARS = 700_000;

export async function shrinkPhoto(file: File): Promise<string> {
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
  for (const quality of [0.82, 0.7, 0.55, 0.4]) {
    const url = canvas.toDataURL("image/jpeg", quality);
    const data = url.slice(url.indexOf(",") + 1);
    if (data.length <= MAX_CHARS) return data;
  }
  throw new Error("too big");
}
