import { PHOTO_EDGE_PX } from "@/domain/hockey/memories";

/**
 * **A picked photo → base64 of a JPEG no longer than 1280 px on its long edge.**
 *
 * Hockey Night's Memories shrink (`components/hockey/Memories.tsx`, private
 * there), lifted here unchanged so Conference uses the same rule instead of
 * a second one: the phone's orientation is honoured, and quality steps down
 * until the picture fits the album's cap (`PHOTO_MAX_CHARS`). Hockey can
 * import this and drop its copy; that edit is Hockey's lane's to make.
 *
 * Browser only.
 */
export async function shrinkPhoto(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file, {
    imageOrientation: "from-image",
  });
  const scale = Math.min(
    1,
    PHOTO_EDGE_PX / Math.max(bitmap.width, bitmap.height),
  );
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no canvas");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  for (const quality of [0.82, 0.7, 0.55]) {
    const url = canvas.toDataURL("image/jpeg", quality);
    const data = url.slice(url.indexOf(",") + 1);
    if (data.length <= 700_000) return data;
  }
  throw new Error("too big");
}
