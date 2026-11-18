import { CHECK_OG_SIZE, checkCard } from "./_ui/checkCard";

export const alt = "Pulse Check — seen a claim? Check what the evidence says.";
export const size = CHECK_OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  return checkCard(null, null);
}
