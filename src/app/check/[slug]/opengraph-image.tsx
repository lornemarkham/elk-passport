import { idFromSlug } from "@/lib/pulse/check";
import { checkStore } from "@/lib/pulse/checkStore";
import { pulseStore } from "@/lib/pulse/store";
import { CHECK_OG_SIZE, checkCard } from "../_ui/checkCard";

export const alt = "A Pulse Check: is this claim true?";
export const size = CHECK_OG_SIZE;
export const contentType = "image/png";

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const id = idFromSlug(slug);
  const [pulse, stored] = id
    ? await Promise.all([
        pulseStore()
          .get(id)
          .catch(() => null),
        Promise.resolve()
          .then(() => checkStore().get(id))
          .catch(() => null),
      ])
    : [null, null];
  if (!pulse || !stored || pulse.status !== "live")
    return checkCard(null, null);
  return checkCard(stored.check.claim.text, stored.check.assessment);
}
