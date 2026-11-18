import { BRAND } from "@/lib/pulse/model";
import { OG_SIZE, ogCard } from "./_ui/ogCard";

export const alt = `${BRAND.hub} — ${BRAND.name}`;
export const size = OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  return ogCard(BRAND.hub, [
    "Ask everyone",
    "Ask your friends",
    "Compare answers",
  ]);
}
