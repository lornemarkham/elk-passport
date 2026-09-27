import type { Metadata } from "next";
import { FoundYou } from "./FoundYou";

export const metadata: Metadata = {
  title: "October found you",
  robots: { index: false, follow: false },
};

/**
 * `/labs/october/found-you`
 *
 * Nothing above it explains it. It begins mid-sentence, as though it had been
 * waiting, which is the only introduction it gets.
 */
export default function Page() {
  return <FoundYou />;
}
