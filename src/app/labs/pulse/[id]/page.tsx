import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import {
  BRAND,
  isCircleCode,
  isPulseId,
  kindOf,
  type Pulse,
} from "@/lib/pulse/model";
import { ballotToken } from "@/lib/pulse/service";
import { aiConfigured } from "@/lib/pulse/sourceCheck";
import { experience } from "@/lib/pulse/templates";
import { NotReady, pulseKey, pulseStore } from "@/lib/pulse/store";
import { PulseRoom } from "../_ui/PulseRoom";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

async function find(id: string): Promise<Pulse | null | "not-ready"> {
  if (!isPulseId(id)) return null;
  try {
    const pulse = await pulseStore().get(id);
    return pulse && pulse.status !== "removed" ? pulse : null;
  } catch (e) {
    if (e instanceof NotReady) return "not-ready";
    throw e;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const pulse = await find(id);
  if (!pulse || pulse === "not-ready") return { title: BRAND.name };
  const kind = kindOf(pulse);
  const description =
    pulse.description ??
    (kind === "decide"
      ? "Yes, no or not yet? Add your answer and a line of advice — no account needed."
      : kind === "rank"
        ? `Put ${pulse.options.map((o) => o.label).join(", ")} in order and see the group's ranking.`
        : kind === "normal"
          ? "Pick your range, anonymously, and see where you sit. Small groups stay hidden."
          : `${pulse.options.map((o) => o.label).join(" · ")} — add your answer and see what people really think.`);
  const site =
    kind === "pulse" ? BRAND.name : `${experience(kind).name} · ${BRAND.name}`;
  return {
    title: { absolute: `${pulse.question} — ${site}` },
    description,
    // Shared by link only: reachable through the link, never indexed.
    ...(pulse.unlisted ? { robots: { index: false, follow: false } } : {}),
    openGraph: {
      title: pulse.question,
      description,
      siteName: site,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: pulse.question,
      description,
    },
  };
}

export default async function PulsePage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;
  const pulse = await find(id);
  if (pulse === "not-ready")
    return (
      <p className="mt-8 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-[15px] text-amber-900">
        People&apos;s Pulse is still being set up here. Try again soon.
      </p>
    );
  if (!pulse) notFound();
  const c = typeof sp.c === "string" ? sp.c : null;
  // A Pulse Check's poll lives on its check, beside the evidence.
  if (kindOf(pulse) === "check")
    redirect(`/check/${pulse.id}${isCircleCode(c) ? `?c=${c}` : ""}`);
  const key = pulseKey();
  if (!key) notFound();
  return (
    <PulseRoom
      pulse={pulse}
      ballot={ballotToken(key, pulse.id, new Date())}
      via={isCircleCode(c) ? c : null}
      fresh={sp.new === "1"}
      ai={aiConfigured()}
    />
  );
}
