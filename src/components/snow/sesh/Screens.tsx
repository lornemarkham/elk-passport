"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { NO_FEATURES_BECAUSE } from "@/domain/snow/sesh/catalogue";
import { chairliftFeed, trendingRiders } from "@/domain/snow/sesh/feed";
import {
  CATEGORIES,
  CATEGORY_JUDGE,
  CATEGORY_LABEL,
  DIVISIONS,
  DIVISION_LABEL,
  FEATURE_KIND_LABEL,
  SESH_MOUNTAINS,
  SIZE_LABEL,
  SPORTS,
  SPORT_LABEL,
  type Category,
  type Clip,
  type Division,
  type Side,
  type Sport,
} from "@/domain/snow/sesh/model";
import { PATCHES, earnedPatches } from "@/domain/snow/sesh/patches";
import {
  canChallenge,
  canVote,
  challengeOf,
  challengeState,
  challengesOfClip,
  champion,
  clipOf,
  featureOf,
  featureOpen,
  history,
  leaderboard,
  myVote,
  riderOf,
  riderRecord,
} from "@/domain/snow/sesh/rules";
import {
  PERIODS,
  PERIOD_TITLE,
  periodWords,
  timeLeft,
  ago,
  type Period,
} from "@/domain/snow/sesh/time";
import { Insignia, Marmot, Patch } from "./art";
import {
  Card,
  Chip,
  FeatureChip,
  GoLink,
  Refusal,
  RiderLink,
  Section,
  ShareButton,
  SoftLink,
  cx,
  mountainName,
  styles,
  useAct,
  useSesh,
} from "./ctx";
import {
  ChallengeRow,
  ChirpRoom,
  ClipCard,
  ClipMeta,
  ClipPlayer,
  Reactions,
  ReportButton,
} from "./parts";

const KIND_ICON: Record<string, string> = {
  "park-lane": "🏁",
  jump: "🛫",
  rail: "🛤️",
  box: "📦",
  roller: "〰️",
  halfpipe: "🌀",
  "side-hit": "↗️",
  jib: "🪵",
};

export function NotHere({ what = "That" }: { what?: string }) {
  const { base } = useSesh();
  return (
    <Card className="mt-6">
      <h1 className={cx(styles.display, "text-3xl uppercase")}>Off the map</h1>
      <p className="mt-2">
        {what} isn&apos;t here — it may have been taken down, or it belongs to
        someone you can&apos;t see.
      </p>
      <div className="mt-3">
        <SoftLink href={base}>Back to Sesh Wars</SoftLink>
      </div>
    </Card>
  );
}

// ── Landing ──────────────────────────────────────────────────────────────

export function Home() {
  const { world, base, now, mode } = useSesh();
  const stats = SESH_MOUNTAINS.map((m) => {
    const features = world.features.filter((f) => f.mountainId === m);
    const ids = new Set(features.map((f) => f.id));
    const open = world.challenges.filter(
      (c) => ids.has(c.featureId) && Date.parse(c.closesAt) > now,
    ).length;
    const clips = world.clips.filter((c) => ids.has(c.featureId)).length;
    const top = leaderboard(world, now, { mountainId: m }, "week")[0];
    return { m, features: features.length, open, clips, top };
  });
  return (
    <>
      <section
        className={cx(
          styles.poster,
          styles.stitched,
          "relative mt-4 overflow-hidden p-6 sm:p-10",
        )}
      >
        <div className="grid items-center gap-6 sm:grid-cols-[1fr_auto]">
          <div>
            <p className={cx(styles.stencil, "text-sm uppercase opacity-90")}>
              Go Have A Day · Snow · Sesh Wars
            </p>
            <h1
              className={cx(
                styles.display,
                "mt-2 text-5xl uppercase sm:text-7xl",
              )}
            >
              Every feature
              <br />
              has a champion.
            </h1>
            <p
              className={cx(
                styles.display,
                "mt-2 text-2xl text-[#f3c969] uppercase",
              )}
            >
              Every rider has a shot.
            </p>
            <p className="mt-4 max-w-xl text-lg opacity-95">
              Film a lap on a park feature. Post it. Someone on the chairlift
              thinks “sick — but watch this” and answers with their own. The
              mountain votes. Champions get crowned. Patches get earned.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <GoLink href={`${base}/m/silverstar`}>
                Choose your mountain
              </GoLink>
              <GoLink href={`${base}/feed`} war>
                ⚔️ Chairlift feed
              </GoLink>
              {mode === "real" && (
                <SoftLink href="/snow/sesh-wars/demo">
                  Try the demo mountain
                </SoftLink>
              )}
            </div>
          </div>
          <div className="mx-auto">
            <Insignia size={240} />
          </div>
        </div>
      </section>

      <Section title="Pick a mountain" id="mountains">
        <div className="grid gap-4 sm:grid-cols-3">
          {stats.map((s) => (
            <Link
              key={s.m}
              href={`${base}/m/${s.m}`}
              className={cx(
                styles.card,
                "block p-4 hover:-translate-y-0.5 hover:bg-[#f6efdc]",
              )}
            >
              <p className={cx(styles.stencil, "text-xs uppercase opacity-70")}>
                Theatre of operations
              </p>
              <h3 className={cx(styles.display, "mt-1 text-3xl uppercase")}>
                {mountainName(s.m)}
              </h3>
              <p className="mt-2 text-sm">
                {s.features} feature{s.features === 1 ? "" : "s"} · {s.clips}{" "}
                clips · {s.open} open challenge{s.open === 1 ? "" : "s"}
              </p>
              <p className="mt-1 text-sm font-semibold">
                {s.top ? (
                  <>
                    👑 Week&apos;s top rider:{" "}
                    {riderOf(world, s.top.riderId)?.name}
                  </>
                ) : mode === "real" && s.features === 0 ? (
                  "No resort-listed features yet"
                ) : (
                  "No champion yet — be first"
                )}
              </p>
            </Link>
          ))}
        </div>
      </Section>

      <Section title="How a sesh war works">
        <ol className="grid gap-3 sm:grid-cols-4">
          {[
            ["1 · Film it", "A friend films your lap on an open park feature."],
            [
              "2 · Post it",
              "Pick the feature, your division and what you're going for.",
            ],
            [
              "3 · Get answered",
              "Someone hits the same feature and throws down: ⚔️ challenge.",
            ],
            [
              "4 · The mountain votes",
              "24 hours. One vote each. Winner takes the feature.",
            ],
          ].map(([t, d]) => (
            <li key={t} className={cx(styles.card, "p-3")}>
              <p className={cx(styles.display, "text-lg uppercase")}>{t}</p>
              <p className="text-sm">{d}</p>
            </li>
          ))}
        </ol>
      </Section>

      <Section title="Rules of the squadron">
        <Card>
          <ul className="grid gap-2 text-sm sm:grid-cols-2">
            <li>
              🪖 Open, resort-built features only. If it&apos;s roped off,
              it&apos;s not a feature.
            </li>
            <li>
              🎯 Style, control and creativity win. Size and speed never score.
            </li>
            <li>
              🩹 Injuries are never content. A bail only counts if everybody
              laughs, including the rider.
            </li>
            <li>
              🧒 Riders 13–17 compete with riders their age, and aren&apos;t
              shown to strangers. Under 13? A parent posts.
            </li>
            <li>
              🤝 Chirp the riding, not the rider. Report, block and moderators
              keep it fun.
            </li>
            <li>
              📍 No live locations. A clip says which feature, never where you
              are now.
            </li>
          </ul>
        </Card>
      </Section>
    </>
  );
}

// ── Mountain ─────────────────────────────────────────────────────────────

export function MountainScreen({ id }: { id: string }) {
  const { world, base, now, viewer, mode } = useSesh();
  const features = world.features.filter((f) => f.mountainId === id);
  const feed = useMemo(
    () => chairliftFeed(world, viewer, id, now),
    [world, viewer, id, now],
  );
  const riders = trendingRiders(world, id, now);
  if (!SESH_MOUNTAINS.includes(id as (typeof SESH_MOUNTAINS)[number]))
    return <NotHere what="That mountain" />;
  const featured = [...feed.newChallenges].sort((a, b) => {
    const sa = challengeState(world, a, now).tally;
    const sb = challengeState(world, b, now).tally;
    return sb.defender + sb.challenger - (sa.defender + sa.challenger);
  });
  return (
    <>
      <header className={cx(styles.poster, "mt-4 p-5 sm:p-8")}>
        <div className="flex flex-wrap items-center gap-2">
          {SESH_MOUNTAINS.map((m) => (
            <Link
              key={m}
              href={`${base}/m/${m}`}
              aria-current={m === id ? "page" : undefined}
              className={styles.tab}
            >
              {mountainName(m)}
            </Link>
          ))}
        </div>
        <h1
          className={cx(styles.display, "mt-4 text-5xl uppercase sm:text-6xl")}
        >
          {mountainName(id)}
        </h1>
        <p className="mt-1 opacity-90">
          {features.length} feature{features.length === 1 ? "" : "s"} ·{" "}
          {feed.newChallenges.length} open challenge
          {feed.newChallenges.length === 1 ? "" : "s"} · watching from home
          works too
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <GoLink href={`${base}/post`}>🎥 Post a clip</GoLink>
          <GoLink href={`${base}/feed/${id}`} war>
            Chairlift feed
          </GoLink>
        </div>
      </header>

      <Section title="Features" id="features">
        {features.length === 0 ? (
          <Card>
            <p className="text-sm">
              {NO_FEATURES_BECAUSE[id] ?? "No resort-listed features here yet."}
            </p>
            {mode === "real" && (
              <div className="mt-3">
                <SoftLink href="/snow/sesh-wars/demo/m/silverstar">
                  See SilverStar in the demo
                </SoftLink>
              </div>
            )}
          </Card>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {features.map((f) => {
              const today = champion(world, now, f.id, "day");
              const clips = world.clips.filter(
                (c) => c.featureId === f.id,
              ).length;
              const open = featureOpen(f, now);
              return (
                <li key={f.id}>
                  <Link
                    href={`${base}/f/${f.id}`}
                    className={cx(
                      styles.card,
                      "flex gap-3 p-3 hover:bg-[#f6efdc]",
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-2 border-[var(--sw-char)] bg-[var(--sw-olive)] text-2xl"
                    >
                      {KIND_ICON[f.kind]}
                    </span>
                    <span className="min-w-0">
                      <span
                        className={cx(
                          styles.display,
                          "block text-xl uppercase",
                        )}
                      >
                        {f.name}
                      </span>
                      <span className="block text-xs">
                        {FEATURE_KIND_LABEL[f.kind]}
                        {f.sizes.length
                          ? ` · ${f.sizes.map((s) => SIZE_LABEL[s]).join(" / ")}`
                          : ""}{" "}
                        · {clips} clip{clips === 1 ? "" : "s"}
                      </span>
                      <span className="mt-1 flex flex-wrap gap-1">
                        <FeatureChip f={f} />
                        {!open.ok && (
                          <Chip>
                            {f.status === "closed"
                              ? "Closed"
                              : `Opens ${f.opens}`}
                          </Chip>
                        )}
                      </span>
                      <span className="mt-1 block text-sm font-semibold">
                        {today ? (
                          <>👑 Today: {riderOf(world, today.riderId)?.name}</>
                        ) : (
                          "No champion today — yet"
                        )}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      {featured.length > 0 && (
        <Section title="Featured challenges">
          <div className="grid gap-2 sm:grid-cols-2">
            {featured.slice(0, 4).map((ch) => (
              <ChallengeRow key={ch.id} ch={ch} />
            ))}
          </div>
        </Section>
      )}

      <Section title="Mountain champions">
        <div className="grid gap-3 sm:grid-cols-2">
          {(["day", "week"] as const).map((p) => {
            const top = leaderboard(world, now, { mountainId: id }, p).slice(
              0,
              3,
            );
            return (
              <Card key={p}>
                <p className={cx(styles.stencil, "text-xs uppercase")}>
                  {PERIOD_TITLE[p].replace("Champion", "top riders")}
                </p>
                {top.length === 0 ? (
                  <p className="mt-2 text-sm">
                    Nobody yet. A challenge decided{" "}
                    {p === "day" ? "today" : "this week"} puts a name here.
                  </p>
                ) : (
                  <ol className="mt-2 space-y-1">
                    {top.map((s, i) => (
                      <li
                        key={s.riderId}
                        className="flex justify-between text-sm"
                      >
                        <span>
                          {["👑", "🥈", "🥉"][i]}{" "}
                          <RiderLink rider={riderOf(world, s.riderId)} />
                        </span>
                        <span className="font-bold">
                          {s.wins} win{s.wins === 1 ? "" : "s"}
                        </span>
                      </li>
                    ))}
                  </ol>
                )}
              </Card>
            );
          })}
        </div>
      </Section>

      {riders.length > 0 && (
        <Section title="Trending riders">
          <ul className="flex flex-wrap gap-2">
            {riders.map((r) => (
              <li key={r}>
                <SoftLink href={`${base}/r/${r}`}>
                  {riderOf(world, r)?.name ?? "Rider"}
                </SoftLink>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {feed.trending.length > 0 && (
        <Section
          title="Popular clips"
          aside={<SoftLink href={`${base}/feed/${id}`}>All</SoftLink>}
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {feed.trending.slice(0, 6).map((c) => (
              <ClipCard key={c.id} clip={c} />
            ))}
          </div>
        </Section>
      )}

      {feed.rivals.length > 0 && (
        <Section title="Your rivals are riding">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {feed.rivals.slice(0, 3).map((c) => (
              <ClipCard key={c.id} clip={c} />
            ))}
          </div>
        </Section>
      )}
    </>
  );
}

// ── Feature ──────────────────────────────────────────────────────────────

export function FeatureScreen({ id }: { id: string }) {
  const { world, base, now, viewer } = useSesh();
  const f = featureOf(world, id);
  const [period, setPeriod] = useState<Period>("week");
  const [category, setCategory] = useState<Category | "">("");
  const [sport, setSport] = useState<Sport | "">("");
  const [division, setDivision] = useState<Division | "">("");
  if (!f) return <NotHere what="That feature" />;
  const clips = world.clips
    .filter((c) => c.featureId === f.id)
    .sort((a, b) => b.at.localeCompare(a.at));
  const open = world.challenges.filter(
    (c) => c.featureId === f.id && Date.parse(c.closesAt) > now,
  );
  const board = leaderboard(world, now, { featureId: f.id }, period, {
    category: category || undefined,
    sport: sport || undefined,
    division: division || undefined,
  });
  const past = history(world, now, f.id);
  const openNow = featureOpen(f, now);
  return (
    <>
      <header className={cx(styles.poster, "mt-4 p-5 sm:p-8")}>
        <p className={cx(styles.stencil, "text-sm uppercase")}>
          <Link href={`${base}/m/${f.mountainId}`} className="underline">
            {mountainName(f.mountainId)}
          </Link>{" "}
          · {f.where}
        </p>
        <h1
          className={cx(styles.display, "mt-2 text-4xl uppercase sm:text-6xl")}
        >
          {f.name}
        </h1>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <FeatureChip f={f} />
          <Chip>{FEATURE_KIND_LABEL[f.kind]}</Chip>
          {f.sizes.map((s) => (
            <Chip key={s}>{SIZE_LABEL[s]}</Chip>
          ))}
          {!openNow.ok && <Chip>{openNow.reason}</Chip>}
        </div>
        <p className="mt-3 max-w-2xl">{f.description}</p>
        {f.note && <p className="mt-2 text-sm opacity-90">⚠︎ {f.note}</p>}
        {f.source && (
          <p className="mt-2 text-xs opacity-90">
            The resort lists it:{" "}
            <a
              href={f.source.url}
              className="underline"
              rel="noreferrer"
              target="_blank"
            >
              “{f.source.quote}”
            </a>{" "}
            (read {f.source.checked}). Parks rebuild features through the season
            — say what you hit in your caption.
          </p>
        )}
        <div className="mt-4 flex flex-wrap gap-3">
          {openNow.ok ? (
            <GoLink href={`${base}/post/${f.id}`}>🎥 Post a clip here</GoLink>
          ) : (
            <span className="text-sm font-semibold">
              Clips open when the park does.
            </span>
          )}
          {viewer.signedIn && <ReportButton kind="feature" id={f.id} />}
        </div>
      </header>

      <Section title="Champions">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {PERIODS.map((p) => {
            const c = champion(world, now, f.id, p);
            const legend =
              p === "season" && !c
                ? (world.legends ?? []).find((l) => l.featureId === f.id)
                : undefined;
            return (
              <div key={p} className={cx(styles.card, "p-3 text-center")}>
                <p className={cx(styles.stencil, "text-[11px] uppercase")}>
                  {PERIOD_TITLE[p]}
                </p>
                <div
                  className={cx(
                    styles.medal,
                    "mx-auto mt-2 flex h-12 w-12 items-center justify-center rounded-full text-xl",
                  )}
                >
                  👑
                </div>
                <p className="mt-1 font-extrabold">
                  {c ? <RiderLink rider={riderOf(world, c.riderId)} /> : "Open"}
                </p>
                <p className="text-xs">
                  {c
                    ? `${c.wins} win${c.wins === 1 ? "" : "s"} · ${c.votes} votes`
                    : legend
                      ? `Last season: ${riderOf(world, legend.riderId)?.name}`
                      : "Win a challenge to take it"}
                </p>
              </div>
            );
          })}
        </div>
      </Section>

      {open.length > 0 && (
        <Section title="Live challenges">
          <div className="grid gap-2 sm:grid-cols-2">
            {open.map((ch) => (
              <ChallengeRow key={ch.id} ch={ch} />
            ))}
          </div>
        </Section>
      )}

      <Section title="Leaderboard">
        <div
          className="mb-3 flex flex-wrap gap-2"
          role="tablist"
          aria-label="Period"
        >
          {PERIODS.map((p) => (
            <button
              key={p}
              type="button"
              role="tab"
              aria-selected={period === p}
              onClick={() => setPeriod(p)}
              className={styles.tab}
            >
              {p === "day"
                ? "Today"
                : p === "week"
                  ? "Week"
                  : p === "season"
                    ? "Season"
                    : "All-time"}
            </button>
          ))}
        </div>
        <div className="mb-3 grid gap-2 sm:grid-cols-3">
          <select
            aria-label="Category"
            value={category}
            onChange={(e) => setCategory(e.target.value as Category | "")}
            className={styles.input}
          >
            <option value="">Every category</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABEL[c]}
              </option>
            ))}
          </select>
          <select
            aria-label="Ski or snowboard"
            value={sport}
            onChange={(e) => setSport(e.target.value as Sport | "")}
            className={styles.input}
          >
            <option value="">Ski and snowboard</option>
            {SPORTS.map((s) => (
              <option key={s} value={s}>
                {SPORT_LABEL[s]}
              </option>
            ))}
          </select>
          <select
            aria-label="Division"
            value={division}
            onChange={(e) => setDivision(e.target.value as Division | "")}
            className={styles.input}
          >
            <option value="">Every division</option>
            {DIVISIONS.map((d) => (
              <option key={d} value={d}>
                {DIVISION_LABEL[d]}
              </option>
            ))}
          </select>
        </div>
        <Card>
          {board.length === 0 ? (
            <p className="text-sm">
              Nobody on the board for this yet. Decided challenges put riders
              here.
            </p>
          ) : (
            <ol className="divide-y divide-[var(--sw-line)]">
              {board.slice(0, 10).map((s, i) => (
                <li
                  key={s.riderId}
                  className="flex items-center justify-between py-2 text-sm"
                >
                  <span>
                    <b className="mr-2 inline-block w-6">{i + 1}.</b>
                    <RiderLink rider={riderOf(world, s.riderId)} />
                  </span>
                  <span className="font-bold">
                    {s.wins} W · {s.votes} votes
                  </span>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </Section>

      <Section title="Clips">
        {clips.length === 0 ? (
          <Card>
            <p>
              No clips here yet. First one up owns the feature until someone
              answers.
            </p>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {clips.slice(0, 12).map((c) => (
              <ClipCard key={c.id} clip={c} />
            ))}
          </div>
        )}
      </Section>

      {past.length > 0 && (
        <Section title="Hall of champions">
          <Card>
            <ul className="grid gap-1 text-sm sm:grid-cols-2">
              {past.slice(0, 14).map((p) => (
                <li key={`${p.period}-${p.key}`}>
                  <span className={cx(styles.stencil, "text-xs uppercase")}>
                    {periodWords(p.key)}
                  </span>{" "}
                  — 👑 <RiderLink rider={riderOf(world, p.riderId)} />
                  {p.wins ? ` (${p.wins} win${p.wins === 1 ? "" : "s"})` : ""}
                </li>
              ))}
            </ul>
          </Card>
        </Section>
      )}

      <ChirpRoom kind="feature" id={f.id} title={`${f.name} Chirp Room`} />
    </>
  );
}

// ── Clip ─────────────────────────────────────────────────────────────────

export function ClipScreen({ id }: { id: string }) {
  const { world, base, now, viewer, signIn } = useSesh();
  const { run, busy, reason } = useAct();
  const clip = clipOf(world, id);
  if (!clip) return <NotHere what="That clip" />;
  const f = featureOf(world, clip.featureId);
  const rider = riderOf(world, clip.riderId);
  const can = canChallenge(world, viewer, clip, now);
  const fights = challengesOfClip(world, clip.id);
  return (
    <>
      <div className="mt-4 grid gap-6 lg:grid-cols-[3fr_2fr]">
        <div>
          <ClipPlayer clip={clip} />
          <div className="mt-3">
            <Reactions clip={clip} />
          </div>
        </div>
        <div>
          <p className={cx(styles.stencil, "text-sm uppercase")}>
            {f ? (
              <Link href={`${base}/f/${f.id}`} className="underline">
                {f.name}
              </Link>
            ) : null}{" "}
            · {f ? mountainName(f.mountainId) : ""}
          </p>
          <h1 className={cx(styles.display, "mt-1 text-4xl uppercase")}>
            <RiderLink rider={rider} />
          </h1>
          <p className="text-sm opacity-80">{ago(clip.at, now)}</p>
          {clip.caption && <p className="mt-2 text-lg">“{clip.caption}”</p>}
          <div className="mt-3">
            <ClipMeta clip={clip} />
          </div>
          <p className="mt-2 text-xs">{CATEGORY_JUDGE[clip.category]}</p>
          <div className="mt-5">
            {can.ok ? (
              <GoLink
                href={`${base}/answer/${clip.id}`}
                war
                className="w-full text-lg sm:w-auto"
              >
                ⚔️ Challenge this rider
              </GoLink>
            ) : (
              <div>
                <button
                  type="button"
                  disabled
                  className={cx(
                    styles.war,
                    "min-h-12 w-full rounded-full px-6 opacity-50 sm:w-auto",
                  )}
                >
                  ⚔️ Challenge this rider
                </button>
                <p className="mt-2 text-sm font-semibold">
                  {can.reason}{" "}
                  {!viewer.signedIn && (
                    <a className="underline" href={signIn}>
                      Sign in
                    </a>
                  )}
                  {viewer.signedIn && !viewer.riderId && (
                    <Link className="underline" href={`${base}/me`}>
                      Make it now
                    </Link>
                  )}
                </p>
              </div>
            )}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <ShareButton
              path={`${base}/c/${clip.id}`}
              title={`${rider?.name ?? "A rider"} on ${f?.name ?? "Sesh Wars"}`}
              text="Sesh Wars — think you can beat it?"
            />
            {viewer.signedIn && clip.riderId !== viewer.riderId && (
              <ReportButton kind="clip" id={clip.id} />
            )}
            {viewer.riderId && rider && rider.id !== viewer.riderId && (
              <button
                type="button"
                disabled={busy}
                className={cx(styles.btn, "min-h-11 px-4 text-sm")}
                onClick={() => run({ type: "block", riderId: rider.id })}
              >
                🚫 Block {rider.name}
              </button>
            )}
          </div>
          <Refusal reason={reason} />
          {fights.length > 0 && (
            <div className="mt-5 space-y-2">
              <p className={cx(styles.stencil, "text-xs uppercase")}>
                Challenges on this clip
              </p>
              {fights.map((ch) => (
                <ChallengeRow key={ch.id} ch={ch} />
              ))}
            </div>
          )}
        </div>
      </div>
      <ChirpRoom kind="clip" id={clip.id} />
    </>
  );
}

// ── Challenge ────────────────────────────────────────────────────────────

export function ChallengeScreen({ id }: { id: string }) {
  const { world, base, now, viewer, signIn, demo } = useSesh();
  const { run, busy, reason } = useAct();
  const ch = challengeOf(world, id);
  if (!ch) return <NotHere what="That challenge" />;
  const s = challengeState(world, ch, now);
  const f = featureOf(world, ch.featureId);
  const can = canVote(world, viewer, ch, now);
  const mine = myVote(world, viewer, ch);
  const total = s.tally.defender + s.tally.challenger;
  const share = total ? Math.round((s.tally.defender / total) * 100) : 50;
  const side = (k: Side, c: Clip | undefined) => {
    const r = riderOf(world, c?.riderId);
    const won = s.winner === k;
    return (
      <div
        className={cx(
          styles.card,
          "relative p-3",
          won && "ring-4 ring-[#e2b33d]",
        )}
      >
        {won && (
          <span
            className={cx(
              styles.pop,
              "absolute -top-5 left-1/2 z-10 -translate-x-1/2 text-4xl",
            )}
            aria-hidden="true"
          >
            👑
          </span>
        )}
        <p className={cx(styles.stencil, "text-xs uppercase")}>
          {k === "defender" ? "Defending" : "Challenger"}
        </p>
        <p className={cx(styles.display, "text-2xl uppercase")}>
          <RiderLink rider={r} />
        </p>
        {c && <ClipPlayer clip={c} />}
        {c?.caption && <p className="mt-1 text-sm">“{c.caption}”</p>}
        <p className="mt-1 text-center text-3xl font-black">{s.tally[k]}</p>
        {s.open && (
          <button
            type="button"
            disabled={busy || !can.ok}
            onClick={() => run({ type: "vote", challengeId: ch.id, side: k })}
            aria-pressed={mine === k}
            className={cx(styles.go, "mt-1 min-h-12 w-full rounded-full px-4")}
          >
            {mine === k ? "✓ Your vote" : `Vote ${r?.name ?? ""}`}
          </button>
        )}
        {won && <p className="mt-2 text-center font-extrabold">WINNER</p>}
      </div>
    );
  };
  return (
    <>
      <header className="mt-4 text-center">
        <p className={cx(styles.stencil, "text-sm uppercase")}>
          {f && (
            <Link className="underline" href={`${base}/f/${f.id}`}>
              {f.name}
            </Link>
          )}{" "}
          · {CATEGORY_LABEL[ch.category]} · {DIVISION_LABEL[ch.division]}{" "}
          division
        </p>
        <h1 className={cx(styles.display, "mt-1 text-5xl uppercase")}>
          Head to head
        </h1>
        <p className="mt-1 text-sm">{CATEGORY_JUDGE[ch.category]}</p>
        <p
          className={cx(
            styles.display,
            "mt-2 text-2xl text-[var(--sw-red)] uppercase",
          )}
        >
          {s.open
            ? `⏱ ${timeLeft(s.msLeft)}`
            : s.noContest
              ? "No votes — no contest, no crown"
              : `👑 ${riderOf(world, s.winnerRiderId)?.name} takes it`}
        </p>
      </header>
      <div
        className="mx-auto mt-4 h-4 max-w-xl overflow-hidden rounded-full border-2 border-[var(--sw-char)] bg-[var(--sw-red)]"
        aria-label={`Votes ${s.tally.defender} to ${s.tally.challenger}`}
      >
        <div
          className="h-full bg-[var(--sw-olive)]"
          style={{ width: `${share}%` }}
        />
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-[1fr_auto_1fr] sm:items-start">
        {side("defender", s.defender)}
        <div
          className={cx(
            styles.display,
            "self-center text-center text-5xl text-[var(--sw-red)]",
          )}
        >
          VS
        </div>
        {side("challenger", s.challenger)}
      </div>
      {s.open && !can.ok && (
        <p className="mt-3 text-center text-sm font-semibold">
          {can.reason}{" "}
          {!viewer.signedIn && (
            <a className="underline" href={signIn}>
              Sign in
            </a>
          )}
        </p>
      )}
      <Refusal reason={reason} />
      {s.open && demo && (
        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={demo.skip}
            className={cx(styles.btn, "min-h-11 px-5 text-sm")}
          >
            ⏩ Demo: skip to the buzzer
          </button>
          <p className="mt-1 text-xs">
            The demo&apos;s fictional riders cast their votes while you skip
            ahead 24 hours.
          </p>
        </div>
      )}
      <div className="mt-4 flex justify-center">
        <ShareButton
          path={`${base}/x/${ch.id}`}
          title="Sesh Wars head to head"
          text={`Who took it? Vote: ${riderOf(world, s.defender?.riderId)?.name} vs ${riderOf(world, s.challenger?.riderId)?.name}`}
        />
      </div>
      <ChirpRoom kind="challenge" id={ch.id} />
    </>
  );
}

// ── Rider ────────────────────────────────────────────────────────────────

export function RiderScreen({ id }: { id: string }) {
  const { world, base, now, viewer } = useSesh();
  const r = riderOf(world, id);
  if (!r) return <NotHere what="That rider" />;
  const rec = riderRecord(world, now, r.id);
  const earned = earnedPatches(world, now, r.id);
  const clips = world.clips
    .filter((c) => c.riderId === r.id)
    .sort((a, b) => b.at.localeCompare(a.at));
  const fights = world.challenges
    .filter((ch) =>
      [
        clipOf(world, ch.defenderClipId)?.riderId,
        clipOf(world, ch.challengerClipId)?.riderId,
      ].includes(r.id),
    )
    .sort((a, b) => b.at.localeCompare(a.at));
  const favourite = Object.entries(
    clips.reduce<Record<string, number>>(
      (m, c) => ({ ...m, [c.featureId]: (m[c.featureId] ?? 0) + 1 }),
      {},
    ),
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
  return (
    <>
      <header
        className={cx(
          styles.poster,
          "mt-4 flex flex-wrap items-center gap-5 p-5 sm:p-8",
        )}
      >
        <span className="rounded-full border-4 border-[var(--sw-cream)] bg-[var(--sw-cream)]">
          <Marmot size={96} />
        </span>
        <div>
          <p className={cx(styles.stencil, "text-sm uppercase")}>
            Rider dossier{r.demo ? " · demo rider (fictional)" : ""}
          </p>
          <h1 className={cx(styles.display, "text-5xl uppercase")}>{r.name}</h1>
          <p className="mt-1">
            {SPORT_LABEL[r.sport]} · home: {mountainName(r.homeMountain)}
            {r.division ? ` · ${DIVISION_LABEL[r.division]} division` : ""}
            {r.crew ? ` · ${r.crew}` : ""}
          </p>
          {viewer.riderId === r.id && (
            <div className="mt-3">
              <SoftLink href={`${base}/me`}>Edit my profile</SoftLink>
            </div>
          )}
        </div>
      </header>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          ["Clips", rec.clips],
          ["Wins", rec.wins],
          ["Challenges", rec.wins + rec.losses],
          ["Votes cast", rec.votesCast],
          ["Patches", earned.length],
        ].map(([k, v]) => (
          <div key={k} className={cx(styles.card, "p-3 text-center")}>
            <p className="text-3xl font-black">{v}</p>
            <p className={cx(styles.stencil, "text-xs uppercase")}>{k}</p>
          </div>
        ))}
      </div>
      <Section title="Patches">
        {earned.length === 0 ? (
          <Card>
            <p className="text-sm">
              No patches yet. First Flight is one clip away.
            </p>
          </Card>
        ) : (
          <ul className="flex flex-wrap gap-3">
            {earned.map((e) => (
              <li key={e.patch.id}>
                <Patch patch={e.patch} size={96} />
              </li>
            ))}
          </ul>
        )}
      </Section>
      {favourite.length > 0 && (
        <Section title="Favourite features">
          <ul className="flex flex-wrap gap-2">
            {favourite.map(([fid, n]) => (
              <li key={fid}>
                <SoftLink href={`${base}/f/${fid}`}>
                  {featureOf(world, fid)?.name} · {n}
                </SoftLink>
              </li>
            ))}
          </ul>
        </Section>
      )}
      {fights.length > 0 && (
        <Section title="Challenges">
          <div className="grid gap-2 sm:grid-cols-2">
            {fights.slice(0, 8).map((ch) => (
              <ChallengeRow key={ch.id} ch={ch} />
            ))}
          </div>
        </Section>
      )}
      <Section title="Clips">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {clips.slice(0, 9).map((c) => (
            <ClipCard key={c.id} clip={c} />
          ))}
        </div>
      </Section>
    </>
  );
}

// ── Chairlift Feed ───────────────────────────────────────────────────────

export function FeedScreen({ mountain }: { mountain?: string }) {
  const { world, base, now, viewer } = useSesh();
  const here =
    mountain &&
    SESH_MOUNTAINS.includes(mountain as (typeof SESH_MOUNTAINS)[number])
      ? mountain
      : "silverstar";
  const feed = useMemo(
    () => chairliftFeed(world, viewer, here, now),
    [world, viewer, here, now],
  );
  const strip = (title: string, clips: Clip[]) =>
    clips.length > 0 && (
      <Section title={title}>
        <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2">
          {clips.map((c) => (
            <div key={c.id} className="w-[82vw] max-w-sm shrink-0 snap-start">
              <ClipCard clip={c} />
            </div>
          ))}
        </div>
      </Section>
    );
  return (
    <>
      <header className="mt-4">
        <h1 className={cx(styles.display, "text-5xl uppercase")}>
          🚡 Chairlift feed
        </h1>
        <p className="text-sm">
          Nothing plays until you tap it — easy on your data up there.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {SESH_MOUNTAINS.map((m) => (
            <Link
              key={m}
              href={`${base}/feed/${m}`}
              aria-current={m === here ? "page" : undefined}
              className={styles.tab}
            >
              {mountainName(m)}
            </Link>
          ))}
        </div>
      </header>
      {strip(`Trending at ${mountainName(here)}`, feed.trending)}
      {strip("Today's best tricks", feed.bestTricks)}
      {feed.newChallenges.length > 0 && (
        <Section title="New challenges">
          <div className="grid gap-2 sm:grid-cols-2">
            {feed.newChallenges.map((ch) => (
              <ChallengeRow key={ch.id} ch={ch} />
            ))}
          </div>
        </Section>
      )}
      {strip("Your rivals' clips", feed.rivals)}
      {feed.dethroned.length > 0 && (
        <Section title="Champions dethroned">
          <ul className="grid gap-2 sm:grid-cols-2">
            {feed.dethroned.map((d) => (
              <li key={d.result.challenge.id}>
                <Link
                  href={`${base}/x/${d.result.challenge.id}`}
                  className={cx(styles.card, "block p-3")}
                >
                  💥 <b>{riderOf(world, d.result.winnerRiderId)?.name}</b>{" "}
                  knocked <b>{riderOf(world, d.result.loserRiderId)?.name}</b>{" "}
                  off {featureOf(world, d.featureId)?.name}
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      )}
      {strip("Popular at other mountains", feed.elsewhere)}
      {feed.trending.length === 0 && feed.elsewhere.length === 0 && (
        <Card className="mt-6">
          <p>No clips yet. Somebody has to go first.</p>
          <div className="mt-3">
            <GoLink href={`${base}/post`}>🎥 Post the first one</GoLink>
          </div>
        </Card>
      )}
    </>
  );
}

// ── Patches ──────────────────────────────────────────────────────────────

export function PatchesScreen() {
  const { world, viewer, now, base } = useSesh();
  const mine = viewer.riderId ? earnedPatches(world, now, viewer.riderId) : [];
  const got = new Set(mine.map((e) => e.patch.id));
  return (
    <>
      <header className="mt-4">
        <h1 className={cx(styles.display, "text-5xl uppercase")}>
          The patch locker
        </h1>
        <p className="max-w-2xl">
          Embroidered insignia, earned on the mountain. Half are for taking part
          — voting, answering, showing up. Each carries a code so a real
          stitched patch could follow one day.
        </p>
        {!viewer.riderId && (
          <p className="mt-2 text-sm font-semibold">
            <Link className="underline" href={`${base}/me`}>
              Make your rider profile
            </Link>{" "}
            to start a collection.
          </p>
        )}
      </header>
      <ul className="mt-6 grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-5">
        {PATCHES.map((p) => (
          <li
            key={p.id}
            className={cx(
              styles.card,
              "flex flex-col items-center p-3 text-center",
            )}
          >
            <Patch patch={p} locked={!got.has(p.id)} size={104} />
            <p className="mt-1 text-sm font-bold">
              {got.has(p.id)
                ? "Earned ✓"
                : p.comingWith
                  ? "Coming soon"
                  : "Locked"}
            </p>
            <p className="text-xs">{p.comingWith ?? p.how}</p>
          </li>
        ))}
      </ul>
    </>
  );
}
