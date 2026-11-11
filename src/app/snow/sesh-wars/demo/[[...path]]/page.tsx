import type { Metadata } from "next";
import { DemoSesh } from "@/components/snow/sesh/SeshApp";

export const metadata: Metadata = {
  title: "Sesh Wars demo — Snow — Passport",
  description:
    "Try Sesh Wars with 30 fictional riders: watch a clip, challenge a rider, vote, chirp, see a champion crowned and earn a patch. Nothing leaves your phone.",
  robots: { index: false },
};

/** Demo Mode: the whole thing runs on the visitor's phone (useDemo). */
export default async function SeshWarsDemo({
  params,
}: {
  params: Promise<{ path?: string[] }>;
}) {
  const { path = [] } = await params;
  return <DemoSesh path={path} />;
}
