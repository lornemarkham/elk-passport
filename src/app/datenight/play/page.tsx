import type { Metadata } from "next";
import { Start } from "@/components/date-night/connect/Start";

export const metadata: Metadata = {
  title: "Connect & Play · Date Night",
  description:
    "Questions and games for two. Open it on a date, no sign-up, nothing to install.",
};

export default function ConnectAndPlayPage() {
  return <Start />;
}
