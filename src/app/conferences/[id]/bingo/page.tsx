import { notFound } from "next/navigation";
import { conferenceContext } from "@/lib/conference/request";
import { PageHead, wrap } from "@/components/conference/kit";
import { BingoCard } from "@/components/conference/bingo/BingoCard";

export const dynamic = "force-dynamic";

/**
 * **Get-to-know-you Bingo**, the `bingo` module: off unless an organiser
 * switches it on. A Passport game beside the agenda, never presented as the
 * organiser's own Bingo, and never a ranking of anybody.
 */
export default async function BingoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await conferenceContext((await params).id);
  if (!ctx) notFound();
  const { conference: c, viewer } = ctx;
  if (!c.modules.includes("bingo") && viewer.role !== "organiser") notFound();
  return (
    <>
      <PageHead
        eyebrow="A Passport game"
        title="Get-to-know-you Bingo"
        lede="Nine ways to meet someone new. Tap a square when you've done it. It's yours alone: nothing is shared, scored or ranked."
      />
      <div className={`${wrap} max-w-[620px] pt-4 pb-16`}>
        <BingoCard conferenceId={c.id} seed={`${c.id}:${viewer.memberId}`} />
        <p className="text-cf-mist mt-6 text-[13px] leading-relaxed">
          This card is Passport&apos;s optional game. If the agenda has an
          official Bingo, the organiser&apos;s rules are the ones that count.
          {!c.modules.includes("bingo")
            ? " Only organisers can see this page until Bingo is switched on in Organiser settings."
            : ""}
        </p>
      </div>
    </>
  );
}
