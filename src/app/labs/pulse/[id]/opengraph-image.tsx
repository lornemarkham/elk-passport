import { BRAND, isPulseId } from "@/lib/pulse/model";
import { pulseStore } from "@/lib/pulse/store";
import { OG_SIZE, ogCard } from "../_ui/ogCard";

export const alt = `A question on ${BRAND.name}`;
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const pulse = isPulseId(id)
    ? await pulseStore()
        .get(id)
        .catch(() => null)
    : null;
  if (!pulse || pulse.status !== "live")
    return ogCard(BRAND.tagline, [
      "Ask a question",
      "Share it",
      "See the answers",
    ]);
  return ogCard(
    pulse.question,
    pulse.options.map((o) => o.label),
  );
}
