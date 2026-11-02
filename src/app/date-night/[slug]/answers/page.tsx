import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { dateNight } from "@/domain/date-night/nights";
import { parseAnswer } from "@/domain/date-night/answer";
import { IDEA_PICKS, ADVENTUROUS_LEVELS } from "@/domain/date-night/types";
import { ownerView, NotReady, type OwnerView } from "@/lib/date-night/store";
import { invitationData } from "../_server/load";
import styles from "@/components/date-night/date-night.module.css";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const night = dateNight((await params).slug);
  return {
    title: night ? `${night.headline} — answers` : "Date Night",
    robots: { index: false, follow: false },
  };
}

const PICK_LABEL = Object.fromEntries(
  IDEA_PICKS.map((p) => [p.value, p.label]),
);

function when(at: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(at));
}

/**
 * **What came back — for the person who planned the night, and nobody else.**
 * Postgres decides who that is (RLS on the adventure's owner); this page only
 * renders what it was given.
 */
export default async function DateNightAnswersPage({ params }: Params) {
  const night = dateNight((await params).slug);
  if (!night) notFound();
  const home = night.vanityPath ?? `/date-night/${night.slug}`;

  let view: OwnerView | "not-ready";
  try {
    view = await ownerView(night.slug);
  } catch (error) {
    if (!(error instanceof NotReady)) throw error;
    view = "not-ready";
  }

  const shell = (children: React.ReactNode) => (
    <main className={styles.page}>
      <div className={styles.sky} aria-hidden />
      <div className={styles.answers}>
        <header>
          <p className={styles.kicker}>Private · only you can see this</p>
          <h1 className={styles.stepTitle} style={{ fontSize: "2.25rem" }}>
            {night.headline}
          </h1>
          <p className={styles.stepHint}>
            What {night.to} said. <a href={home}>Open the invitation</a>
          </p>
        </header>
        {children}
      </div>
    </main>
  );

  if (view === "not-ready")
    return shell(
      <p className={styles.notice} data-testid="not-ready">
        Date Night isn&apos;t switched on here yet — the database step in
        docs/product/date-night/RELEASE.md hasn&apos;t been run. Nothing can be
        saved or read until it has.
      </p>,
    );
  if (view.state === "signed-out")
    return shell(
      <p className={styles.notice} data-testid="signed-out">
        These answers are private.{" "}
        <a href={`/auth?next=${home}/answers`}>Sign in</a> with the account that
        planned this night to read them.
      </p>,
    );
  if (view.state === "not-yours")
    return shell(
      <p className={styles.notice} data-testid="not-yours">
        Only the person who planned this night can read its answers.
        {view.open ? "" : " (It isn't taking answers yet.)"}
      </p>,
    );

  const { places } = await invitationData(night);
  const ideaTitle = new Map(
    night.ideas.map((i) => [i.id, `${i.emoji} ${i.title}`]),
  );

  if (view.answers.length === 0)
    return shell(
      <p className={styles.notice} data-testid="no-answers">
        Nothing yet. Send {night.to} the link: <a href={home}>{home}</a>
      </p>,
    );

  return shell(
    <>
      {view.answers.map((stored, index) => {
        const parsed = parseAnswer(stored.answer, night);
        if (!parsed.ok)
          return (
            <article key={stored.id} className={styles.answerCard}>
              <p className={styles.small}>
                {when(stored.at, night.timeZone)} — an answer this version
                can&apos;t read ({parsed.reason}).
              </p>
            </article>
          );
        const a = parsed.answer;
        const byPick = (pick: string) =>
          Object.entries(a.picks)
            .filter(([, p]) => p === pick)
            .map(([id]) => ideaTitle.get(id) ?? id);
        const level = ADVENTUROUS_LEVELS.find((l) => l.value === a.adventurous);
        return (
          <article
            key={stored.id}
            className={styles.answerCard}
            data-testid="answer"
          >
            <p className={styles.small}>
              {index === 0 ? "Newest · " : ""}
              {when(stored.at, night.timeZone)}
            </p>
            {a.message && (
              <section>
                <h3>Message</h3>
                <blockquote>{a.message}</blockquote>
              </section>
            )}
            {(["yes", "maybe", "no"] as const).map((pick) => {
              const titles = byPick(pick);
              return titles.length ? (
                <section key={pick}>
                  <h3>{PICK_LABEL[pick]}</h3>
                  <ul className={styles.answerList}>
                    {titles.map((t) => (
                      <li key={t} data-pick={pick}>
                        {t}
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null;
            })}
            {a.ownIdeas.length > 0 && (
              <section>
                <h3>{night.to}&apos;s ideas</h3>
                <ul className={styles.answerList}>
                  {a.ownIdeas.map((t) => (
                    <li key={t}>✨ {t}</li>
                  ))}
                </ul>
              </section>
            )}
            {(a.placeIds.length > 0 || a.places.length > 0) && (
              <section>
                <h3>Places</h3>
                <ul className={styles.answerList}>
                  {a.placeIds.map((id) => (
                    <li key={id}>
                      📍{" "}
                      {places[id]?.experience.title ??
                        "A place Atlas no longer returns"}
                    </li>
                  ))}
                  {a.places.map((t) => (
                    <li key={t}>📍 {t}</li>
                  ))}
                </ul>
              </section>
            )}
            {level && (
              <section>
                <h3>How adventurous</h3>
                <p>
                  {level.emoji} {level.label} — {level.line}
                </p>
              </section>
            )}
            {(a.food.length > 0 || a.foodNote) && (
              <section>
                <h3>Food & drinks</h3>
                <ul className={styles.answerList}>
                  {a.food.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                  {a.foodNote && <li>“{a.foodNote}”</li>}
                </ul>
              </section>
            )}
          </article>
        );
      })}
    </>,
  );
}
