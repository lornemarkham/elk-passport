import type { Metadata } from "next";
import Link from "next/link";
import { presetFrom } from "@/lib/pulse/templates";
import { CreatePulse } from "./CreatePulse";

export const metadata: Metadata = { title: "Ask a question" };

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function NewPulse({ searchParams }: Props) {
  const sp = await searchParams;
  const preset = presetFrom({
    t: sp.t,
    kind: sp.kind,
    private: sp.private,
    q: sp.q,
  });
  return (
    <>
      <p className="pt-4 text-[13px]">
        <Link
          href="/labs/pulse"
          className="font-medium text-[#5c6370] hover:text-[#14161a]"
        >
          ← All the ways to ask
        </Link>
      </p>
      <h1
        className="font-heading pt-2 text-[32px] leading-tight font-bold tracking-tight"
        data-testid="pulse-create-title"
      >
        {preset.title}
      </h1>
      <p className="mt-2 mb-6 text-[15px] text-[#5c6370]">{preset.line}</p>
      <CreatePulse
        key={`${preset.kind}:${preset.template}:${preset.prefix}`}
        preset={preset}
      />
    </>
  );
}
