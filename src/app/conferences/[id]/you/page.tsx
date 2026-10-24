import Link from "next/link";
import { notFound } from "next/navigation";
import { KIND_WORDS } from "@/domain/conference/details";
import { conferenceContext } from "@/lib/conference/request";
import { togetherEnabled } from "@/lib/conference-together/enabled";
import { MyPresence } from "@/components/conference/MyPresence";
import { Panel, PageHead, PanelHead, wrap } from "@/components/conference/kit";
import { Reminders } from "@/components/conference-together/Reminders";

export const dynamic = "force-dynamic";

/**
 * **You, in this conference.** The name you go by here, whether other
 * members can see you, reminders on this device, and leaving. It used to sit
 * at the foot of the overview; it lives behind the profile menu now, with
 * every control it had.
 */
export default async function YouPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await conferenceContext((await params).id);
  if (!ctx) notFound();
  const { conference: c, viewer } = ctx;
  const words = KIND_WORDS[c.kind];
  const base = `/conferences/${c.id}`;
  const plansOn = c.modules.includes("plans") && togetherEnabled();
  const has = (m: (typeof c.modules)[number]) => c.modules.includes(m);

  return (
    <>
      <PageHead
        eyebrow="Your profile & privacy"
        title={viewer.displayName ?? "You"}
        lede={`How you appear to other ${words.people} in ${c.name}, and what you share. Every choice here can be changed or taken back.`}
      />
      <div
        className={`${wrap} grid gap-6 pt-6 pb-16 lg:grid-cols-[minmax(0,1fr)_360px]`}
      >
        <Panel className="p-5 sm:p-6">
          <PanelHead eyebrow="Profile" title="Your name and who sees it" />
          <div className="mt-5">
            <MyPresence
              conferenceId={c.id}
              you={viewer}
              people={words.people}
            />
          </div>
        </Panel>
        <div className="space-y-5">
          <Panel className="p-5">
            <PanelHead eyebrow="What you share" title="Each one is separate" />
            <ul className="text-cf-slate mt-4 space-y-3 text-[14px]">
              {has("arrivals") ? (
                <li>
                  <Link
                    href={`${base}/arrivals`}
                    className="text-cf-ink font-semibold underline underline-offset-4"
                  >
                    Your flight
                  </Link>{" "}
                  — shown on the board only if you share it and are seen by
                  name.
                </li>
              ) : null}
              {has("people") ? (
                <li>
                  <Link
                    href={`${base}/people#find`}
                    className="text-cf-ink font-semibold underline underline-offset-4"
                  >
                    Where you are
                  </Link>{" "}
                  — only while you choose to share it, for up to four hours.
                </li>
              ) : null}
              {plansOn ? (
                <li>
                  <Link
                    href={`${base}/plans`}
                    className="text-cf-ink font-semibold underline underline-offset-4"
                  >
                    Your plans
                  </Link>{" "}
                  — your answers show your name only if you&apos;re seen.
                </li>
              ) : null}
            </ul>
          </Panel>
          {plansOn ? (
            <Panel className="p-5">
              <PanelHead eyebrow="Notifications" title="Reminders" />
              <p className="text-cf-slate mt-2 text-[14px] leading-relaxed">
                Only for plans you said <em>I&apos;m in</em> to: once on the
                day, once shortly before. Never repeated.
              </p>
              <Reminders conferenceId={c.id} />
            </Panel>
          ) : null}
        </div>
      </div>
    </>
  );
}
