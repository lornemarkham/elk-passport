import type { Metadata } from "next";
import { ShareForm } from "@/components/insiders/ShareForm";
import { actor } from "@/lib/insiders/service";

export const metadata: Metadata = {
  title: "Know something we're missing? — Go Have a Day",
};

export const dynamic = "force-dynamic";

export default async function SharePage() {
  const me = await actor().catch(() => null);
  const as =
    me && me.role !== "visitor" ? (me.ambassador?.name ?? me.who) : null;
  return (
    <>
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
        <h1 className="ghad-display text-4xl leading-tight font-extrabold tracking-[-0.03em] sm:text-5xl">
          Know something we&apos;re missing?
        </h1>
        <p className="mt-3 text-lg text-black/70">
          The race nobody advertises, the club that meets on Thursdays, the jam
          behind the pub. Tell us in a sentence, say it out loud, or snap the
          poster.
        </p>
        <div className="mt-8">
          <ShareForm asAmbassador={as} />
        </div>
      </main>
    </>
  );
}
