import type { Metadata } from "next";
import { MotionLab } from "@/components/motion-lab/MotionLab";

export const metadata: Metadata = {
  title: "Motion Lab — Passport",
};

export default function MotionLabPage() {
  return <MotionLab />;
}
