import { BRAND } from "@/lib/pulse/model";
import { OG_SIZE, ogCard } from "./_ui/ogCard";

export const alt = `${BRAND.name} — ${BRAND.tagline}`;
export const size = OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  return ogCard(BRAND.tagline, ["Ask", "Share", "Compare"]);
}
