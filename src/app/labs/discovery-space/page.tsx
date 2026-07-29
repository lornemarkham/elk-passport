import type { Metadata } from "next";
import { DiscoverySpace } from "@/components/labs/discovery-space/DiscoverySpace";

export const metadata: Metadata = {
  title: "Discovery Space — Passport Labs",
};

export default function DiscoverySpacePage() {
  return <DiscoverySpace />;
}
