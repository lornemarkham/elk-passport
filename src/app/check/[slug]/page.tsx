import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import {
  ASSESSMENT_INFO,
  ASK_INFO,
  CHECK_BRAND,
  SEEN_ON,
  idFromSlug,
  limitations,
  type CheckData,
} from "@/lib/pulse/check";
import { authorOf, isCheckCreator, postToken } from "@/lib/pulse/checkService";
import { checkStore } from "@/lib/pulse/checkStore";
import { existingDevice } from "@/lib/pulse/http";
import { BRAND, isCircleCode, scopeLabel, type Pulse } from "@/lib/pulse/model";
import { ballotToken } from "@/lib/pulse/service";
import { NotReady, pulseKey, pulseStore } from "@/lib/pulse/store";
import { Report } from "@/app/labs/pulse/_ui/Report";
import { CheckPoll } from "../_ui/CheckPoll";
import { CheckShare, CircleProvider, VisitCounter } from "../_ui/CheckShare";
import { CorrectCheck } from "../_ui/CorrectCheck";
import { Discussion } from "../_ui/Discussion";
import { AssessmentCard, Sources, fmtDay } from "../_ui/Evidence";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

async function find(
  slug: string,
): Promise<{ pulse: Pulse; check: CheckData } | null | "not-ready"> {
  const id = idFromSlug(slug);
  if (!id) return null;
  try {
    const [pulse, stored] = await Promise.all([
      pulseStore().get(id),
      checkStore().get(id),
    ]);
    if (!pulse || !stored || pulse.status === "removed") return null;
    return { pulse, check: stored.check };
  } catch (e) {
    if (e instanceof NotReady) return "not-ready";
    throw e;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const found = await find(slug);
  if (!found || found === "not-ready") return { title: CHECK_BRAND.name };
  const { check } = found;
  const status = ASSESSMENT_INFO[check.assessment].label;
  const title = `Is this true? “${check.claim.text}”`;
  const description = `${status} — so far. Check the sources and have your say on ${BRAND.name}. Not independently verified.`;
  return {
    title: { absolute: `${title} — ${CHECK_BRAND.name}` },
    description,
    alternates: { canonical: `/check/${check.slug}` },
    openGraph: {
      title,
      description,
      siteName: `${CHECK_BRAND.name} · ${BRAND.name}`,
      type: "article",
      url: `/check/${check.slug}`,
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

const kicker = "text-[12px] font-bold tracking-[0.16em] uppercase";

export default async function CheckPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = await searchParams;
  const found = await find(slug);
  if (found === "not-ready")
    return (
      <p className="mt-8 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-[15px] text-amber-900">
        Pulse Check is still being set up here. Try again soon.
      </p>
    );
  if (!found) notFound();
  const { pulse, check } = found;
  const c = typeof sp.c === "string" && isCircleCode(sp.c) ? sp.c : null;
  if (slug !== check.slug)
    permanentRedirect(`/check/${check.slug}${c ? `?c=${c}` : ""}`);
  const key = pulseKey();
  if (!key) notFound();
  const now = new Date();
  const device = await existingDevice();
  const checks = checkStore();
  const [mine, posts] = await Promise.all([
    isCheckCreator(checks, key, pulse.id, device),
    checks.posts(pulse.id, authorOf(key, device)).catch(() => []),
  ]);
  const path = `/check/${check.slug}`;
  const fresh = sp.new === "1";
  const paused = pulse.status === "review";
  const parts = check.parts;
  const stated = [
    ["Figures", parts.figures],
    ["Dates", parts.dates],
    ["Places", parts.places],
    ["Organisations", parts.organisations],
    ["Key words", parts.terms],
  ].filter(([, v]) => (v as string[]).length) as [string, string[]][];

  return (
    <CircleProvider>
      <VisitCounter pulseId={pulse.id} />
      <article className="grid grid-cols-[minmax(0,1fr)] gap-6">
        <header className="pt-3">
          <p className={`${kicker} text-[#e5484d]`}>
            Pulse Check · Is this true?
          </p>
          <p className="mt-1 flex flex-wrap gap-x-3 text-[13px] font-medium text-[#5c6370]">
            <span>{scopeLabel(pulse.scope)}</span>
            <span>Seen on {SEEN_ON[check.claim.seenOn]}</span>
            <span>Investigated {fmtDay(check.investigatedAt)}</span>
          </p>
          <h1
            className="font-heading mt-3 text-[27px] leading-[1.2] font-bold tracking-tight sm:text-[34px]"
            data-testid="check-claim"
          >
            “{check.claim.text}”
          </h1>
          <p className="mt-2 text-[13px] text-[#5c6370]">
            The claim, as the person who asked wrote it out
            {check.claim.form === "screenshot" || check.claim.form === "photo"
              ? " from a screenshot"
              : check.claim.form === "headline"
                ? " from a headline"
                : ""}
            .{" "}
            {check.claim.url ? (
              <a
                href={check.claim.url}
                target="_blank"
                rel="noopener noreferrer nofollow ugc"
                className="font-medium text-[#2a78d6] underline underline-offset-2"
              >
                Where it was posted
              </a>
            ) : null}
          </p>
          {check.why ? (
            <div
              className="mt-4 rounded-2xl bg-[#f3f1ec] p-4"
              data-testid="check-why"
            >
              <p className={`${kicker} text-[#5c6370]`}>Why they asked</p>
              <p className="mt-1 text-[16px] leading-relaxed">{check.why}</p>
            </div>
          ) : null}
        </header>

        {paused ? (
          <p
            className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-[15px] text-amber-900"
            data-testid="check-review"
          >
            This Pulse Check has been reported and is paused while a moderator
            looks at it. You can still read it.
          </p>
        ) : null}

        {fresh ? (
          <CheckShare path={path} claim={check.claim.text} fresh />
        ) : null}

        <AssessmentCard
          assessment={check.assessment}
          suggested={check.suggested}
          summary={check.summary}
          investigatedAt={check.investigatedAt}
          updatedAt={check.updatedAt}
          sources={check.sources.length}
        />

        <section aria-labelledby="check-evidence" className="grid gap-3">
          <div>
            <p className={`${kicker} text-[#127a52]`}>Evidence</p>
            <h2
              id="check-evidence"
              className="text-[22px] font-bold tracking-tight"
            >
              What the sources say
            </h2>
            <p className="mt-1 text-[14px] text-[#5c6370]">
              Pages People&apos;s Pulse opened itself, quoted word for word,
              with the date each was read. Placed by the person who asked; not
              independently verified.
            </p>
          </div>
          <Sources sources={check.sources} />
        </section>

        <section
          aria-labelledby="check-open"
          className="grid gap-3 rounded-2xl border border-[#e7e3da] bg-white p-4"
        >
          <h2 id="check-open" className="text-[18px] font-bold">
            Still unanswered
          </h2>
          <ul
            className="grid list-disc gap-1.5 pl-5 text-[15px] leading-relaxed"
            data-testid="check-questions"
          >
            {check.questions.map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ul>
          {stated.length ? (
            <dl className="mt-1 grid gap-1 text-[13.5px]">
              <p className="font-semibold text-[#3f4550]">
                What the claim itself states
              </p>
              {stated.map(([label, values]) => (
                <div key={label} className="flex flex-wrap gap-x-2">
                  <dt className="text-[#5c6370]">{label}:</dt>
                  <dd>{values.join(" · ")}</dd>
                </div>
              ))}
            </dl>
          ) : null}
          <div className="mt-1 text-[13.5px]">
            <p className="font-semibold text-[#3f4550]">Limits of this check</p>
            <ul
              className="mt-1 grid list-disc gap-1 pl-5 text-[#5c6370]"
              data-testid="check-limits"
            >
              {limitations(check).map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          </div>
        </section>

        {fresh ? null : (
          <CheckShare path={path} claim={check.claim.text} fresh={false} />
        )}

        <section
          aria-labelledby="check-opinion"
          className="grid gap-3"
          data-testid="check-opinion"
        >
          <div>
            <p className={`${kicker} text-[#2a78d6]`}>
              Public opinion · {ASK_INFO[check.ask].name}
            </p>
            <h2
              id="check-opinion"
              className="text-[22px] font-bold tracking-tight"
            >
              {pulse.question}
            </h2>
            <p className="mt-1 text-[14px] text-[#5c6370]">
              {ASK_INFO[check.ask].line} Votes show what people think. They
              never decide whether the claim is true.
            </p>
          </div>
          <CheckPoll
            pulse={pulse}
            ballot={ballotToken(key, pulse.id, now)}
            via={c}
            path={path}
          />
        </section>

        <Discussion
          pulseId={pulse.id}
          token={postToken(key, pulse.id, now)}
          initial={posts}
        />

        <section
          aria-labelledby="check-history"
          className="grid gap-3"
          data-testid="check-history"
        >
          <h2 id="check-history" className="text-[18px] font-bold">
            Corrections · {check.corrections.length}
          </h2>
          {check.corrections.length ? (
            <ol className="grid gap-2">
              {[...check.corrections].reverse().map((x) => (
                <li
                  key={x.at}
                  className="rounded-xl border border-[#e7e3da] bg-white p-3 text-[14.5px]"
                >
                  <p className="text-[12.5px] text-[#5c6370]">
                    {fmtDay(x.at)} · by{" "}
                    {x.by === "asker"
                      ? "the person who asked"
                      : "a People's Pulse moderator"}
                    {x.from !== x.to
                      ? ` · ${ASSESSMENT_INFO[x.from].label} → ${ASSESSMENT_INFO[x.to].label}`
                      : ""}
                  </p>
                  <p className="mt-1">{x.note}</p>
                  {x.added.length ? (
                    <p className="mt-1 text-[13px] text-[#5c6370]">
                      Added: {x.added.join(" · ")}
                    </p>
                  ) : null}
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-[14px] text-[#5c6370]">
              No corrections. If new evidence appears, the person who asked can
              add it here, and every change stays visible.
            </p>
          )}
          {mine ? (
            <CorrectCheck
              pulseId={pulse.id}
              claim={check.claim.text}
              assessment={check.assessment}
              sources={check.sources}
              summary={check.summary}
            />
          ) : null}
          {mine && check.hasFile ? (
            <details className="rounded-2xl border border-[#e7e3da] bg-white p-4">
              <summary className="-my-3 cursor-pointer py-3 text-[14px] font-medium">
                Your screenshot — only you can see this
              </summary>
              {/* eslint-disable-next-line @next/next/no-img-element -- a private, per-browser file, never optimised or cached */}
              <img
                src={`/api/pulse/check/${pulse.id}/file`}
                alt="The screenshot you attached"
                className="mt-3 max-h-[70vh] w-auto rounded-xl border border-[#e7e3da]"
              />
            </details>
          ) : null}
        </section>

        <section aria-labelledby="check-look" className="grid gap-2">
          <h2 id="check-look" className="text-[18px] font-bold">
            Look for yourself
          </h2>
          <p className="text-[13.5px] text-[#5c6370]">
            Searches of places that publish this kind of information. Not
            evidence, and not checked for an answer.
          </p>
          <ul className="grid gap-2">
            {check.leads.map((l) => (
              <li key={l.name}>
                <a
                  href={l.url}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="block rounded-xl border border-[#e7e3da] bg-white px-3.5 py-3 hover:border-[#14161a]/40"
                >
                  <span className="text-[15px] font-semibold">{l.name}</span>
                  <span className="block text-[13px] text-[#5c6370]">
                    {l.why}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </section>

        <Report pulseId={pulse.id} label="Report this Pulse Check" />
      </article>
    </CircleProvider>
  );
}
