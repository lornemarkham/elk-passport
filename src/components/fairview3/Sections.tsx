"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";
import {
  ANTHEM_SUBTITLE,
  ANTHEM_TITLE,
  KNOW_LADDER,
  TEAMS,
  type Question,
  type Team,
} from "@/lib/fairview3/show";
import type { Snapshot, VoteStatus } from "@/lib/fairview3/store";
import { Qr } from "./Qr";

export type Mode = "phone" | "stage";

/* ----------------------------------------------------------- primitives */

const HUE: Record<
  Team["hue"],
  { text: string; bg: string; ring: string; bar: string }
> = {
  cyan: {
    text: "text-cyan-300",
    bg: "bg-cyan-400",
    ring: "ring-cyan-300",
    bar: "from-cyan-400 to-cyan-200",
  },
  fuchsia: {
    text: "text-fuchsia-300",
    bg: "bg-fuchsia-400",
    ring: "ring-fuchsia-300",
    bar: "from-fuchsia-500 to-pink-300",
  },
  amber: {
    text: "text-amber-300",
    bg: "bg-amber-400",
    ring: "ring-amber-300",
    bar: "from-amber-400 to-yellow-200",
  },
  emerald: {
    text: "text-emerald-300",
    bg: "bg-emerald-400",
    ring: "ring-emerald-300",
    bar: "from-emerald-400 to-lime-200",
  },
};

export const OPTION_HUES = [
  "cyan",
  "fuchsia",
  "amber",
  "emerald",
  "cyan",
] as const;

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
};
const rise = {
  hidden: { opacity: 0, y: 24 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.2, 0.8, 0.2, 1] as const },
  },
};

export function Frame({
  children,
  mode,
  className = "",
  serious = false,
}: {
  children: ReactNode;
  mode: Mode;
  className?: string;
  serious?: boolean;
}) {
  return (
    <motion.section
      variants={stagger}
      initial="hidden"
      animate="show"
      className={`relative flex w-full flex-col ${
        mode === "stage"
          ? "h-dvh overflow-hidden px-[5vw] py-[4vh]"
          : "min-h-dvh px-5 pt-[max(1.5rem,env(safe-area-inset-top))] pb-28"
      } ${serious ? "fv3-serious" : ""} ${className}`}
    >
      {children}
    </motion.section>
  );
}

export const Kicker = ({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) => (
  <motion.p
    variants={rise}
    className={`fv3-display-tight text-xs tracking-[0.3em] text-white/60 uppercase md:text-[1.1vw] ${className}`}
  >
    {children}
  </motion.p>
);

export const Headline = ({
  children,
  mode,
  className = "",
  size,
}: {
  children: ReactNode;
  mode: Mode;
  className?: string;
  /** Tailwind size classes, when the default is too big for the words. */
  size?: string;
}) => (
  <motion.h1
    variants={rise}
    className={`fv3-display ${
      size ?? (mode === "stage" ? "text-[6.5vw]" : "text-[15vw] leading-[0.9]")
    } ${className}`}
  >
    {children}
  </motion.h1>
);

export const Line = ({
  children,
  mode,
  className = "",
}: {
  children: ReactNode;
  mode: Mode;
  className?: string;
}) => (
  <motion.p
    variants={rise}
    className={`max-w-[30ch] text-balance ${mode === "stage" ? "text-[1.8vw]" : "text-lg"} leading-snug text-white/85 ${className}`}
  >
    {children}
  </motion.p>
);

/* ------------------------------------------------------------- curtain */

export function Curtain({
  mode,
  participants,
}: {
  mode: Mode;
  participants: number;
}) {
  return (
    <Frame
      mode={mode}
      className={
        mode === "stage"
          ? "justify-center"
          : "items-center justify-center text-center"
      }
    >
      <div
        className={
          mode === "stage"
            ? "grid grid-cols-[1.3fr_1fr] items-center gap-[4vw]"
            : "flex flex-col items-center"
        }
      >
        <div className={mode === "stage" ? "" : "flex flex-col items-center"}>
          <motion.div
            variants={rise}
            className="fv3-float text-[18vw] md:text-[7vw]"
            aria-hidden
          >
            🔮
          </motion.div>
          <Kicker>Sycle · Fairview 3</Kicker>
          <Headline
            mode={mode}
            className="fv3-glow-text mt-3"
            size={mode === "stage" ? "text-[7.5vw]" : undefined}
          >
            No more
            <br />
            <span className="fv3-electric">crystal balls</span>
          </Headline>
          <Line
            mode={mode}
            className={
              mode === "stage" ? "mt-5" : "mt-6 self-center text-center"
            }
          >
            Four teams. One mission. Zero imaginary baselines.
          </Line>
          {mode === "stage" && <WizardCount n={participants} mode={mode} />}
        </div>
        {mode === "stage" ? (
          <motion.div
            variants={rise}
            className="flex flex-col items-center gap-4"
          >
            <Qr size={300} />
            <p className="text-center text-[1.4vw] text-white/70">
              Open your camera. Point it here. Your phone is your wand.
            </p>
          </motion.div>
        ) : (
          <motion.div
            variants={rise}
            className="fv3-card mt-10 w-full max-w-sm px-6 py-5"
          >
            <p className="fv3-display-tight text-2xl">You&apos;re in. ✨</p>
            <p className="mt-1 text-white/70">
              Keep this open. The show will follow the big screen.
            </p>
          </motion.div>
        )}
        {mode === "phone" && <WizardCount n={participants} mode={mode} />}
      </div>
    </Frame>
  );
}

export function WizardCount({ n, mode }: { n: number; mode: Mode }) {
  return (
    <motion.p
      variants={rise}
      className={`mt-6 text-white/70 ${mode === "stage" ? "text-[1.6vw]" : "text-base"}`}
      data-testid="wizard-count"
    >
      <span className="fv3-display-tight text-white">{n}</span>{" "}
      {n === 1 ? "wizard has" : "wizards have"} joined the circle
    </motion.p>
  );
}

/* -------------------------------------------------------------- merlin */

const FORECASTS = [
  {
    q: "Merlin, what will Q4 revenue be?",
    a: "“Up. And to the right.” — source: a ball.",
  },
  {
    q: "Merlin, is the migration on track?",
    a: "“Reply hazy. Try again next quarter.”",
  },
  {
    q: "Merlin, how many referrals did we generate?",
    a: "“Many. Possibly. Some of them.”",
  },
  { q: "Merlin, what's our baseline?", a: "“Base… line? Is that a spell?”" },
];

export function Merlin({ mode }: { mode: Mode }) {
  return (
    <Frame mode={mode}>
      <div
        className={`flex ${mode === "stage" ? "flex-row items-center gap-[6vw]" : "flex-col"}`}
      >
        <div className="shrink-0 text-center">
          <motion.div
            variants={rise}
            className="fv3-float text-[34vw] md:text-[10vw]"
            aria-hidden
          >
            🧙‍♂️
          </motion.div>
          <Kicker className="mt-2">Act I · The old way</Kicker>
        </div>
        <div className="mt-6 md:mt-0">
          <Headline mode={mode}>
            Ask <span className="fv3-electric">Merlin</span>
          </Headline>
          <motion.ul variants={stagger} className="mt-5 flex flex-col gap-2">
            {FORECASTS.map((f) => (
              <motion.li
                key={f.q}
                variants={rise}
                className={`fv3-card px-5 ${mode === "stage" ? "py-3" : "py-4"}`}
              >
                <p
                  className={`${mode === "stage" ? "text-[1.3vw]" : "text-base"} text-white/60`}
                >
                  {f.q}
                </p>
                <p
                  className={`fv3-display-tight mt-0.5 ${mode === "stage" ? "text-[1.9vw]" : "text-xl"} text-amber-200`}
                >
                  {f.a}
                </p>
              </motion.li>
            ))}
          </motion.ul>
          <Line mode={mode} className="mt-5 text-white/60">
            Abracadashboard. Expelliarmus, legacy code. Wingardium Revenue-osa.
            Great spells. Terrible metrics.
          </Line>
        </div>
      </div>
    </Frame>
  );
}

/* ----------------------------------------------------------- spellbook */

const SWAPS = [
  ["Crystal ball", "Baseline"],
  ["Prophecy", "Measurement"],
  ["Potion", "Attribution"],
  ["Spell", "Real results"],
] as const;

export function Spellbook({ mode }: { mode: Mode }) {
  return (
    <Frame mode={mode} className="justify-center">
      <Kicker>Act II · The new way</Kicker>
      <Headline mode={mode} className="mt-3">
        We believe
        <br />
        in magic.
      </Headline>
      <Line mode={mode} className="mt-5 text-white">
        We just don&apos;t use it to measure results.
      </Line>
      <motion.ul variants={stagger} className="mt-10 grid gap-3 md:grid-cols-2">
        {SWAPS.map(([was, now]) => (
          <motion.li
            key={was}
            variants={rise}
            className="fv3-card flex items-center gap-4 px-5 py-4"
          >
            <span
              className={`${mode === "stage" ? "text-[1.6vw]" : "text-lg"} text-white/40 line-through decoration-fuchsia-400 decoration-4`}
            >
              {was}
            </span>
            <span className="text-fuchsia-300" aria-hidden>
              →
            </span>
            <span
              className={`fv3-display-tight ${mode === "stage" ? "text-[2.1vw]" : "text-2xl"} text-cyan-200`}
            >
              {now}
            </span>
          </motion.li>
        ))}
      </motion.ul>
    </Frame>
  );
}

/* ---------------------------------------------------------------- team */

export function TeamSection({ team, mode }: { team: Team; mode: Mode }) {
  const hue = HUE[team.hue];
  return (
    <Frame mode={mode} className="justify-center">
      <div className="flex items-end gap-4">
        <motion.span
          variants={rise}
          className={`fv3-display ${mode === "stage" ? "text-[7vw]" : "text-[22vw]"} ${hue.text} opacity-80`}
        >
          {team.number}
        </motion.span>
        <motion.span
          variants={rise}
          className="fv3-float mb-3 text-[16vw] md:text-[4.5vw]"
          aria-hidden
        >
          {team.sigil}
        </motion.span>
      </div>
      <Kicker className={hue.text}>{team.epithet}</Kicker>
      <Headline mode={mode} className="mt-2">
        {team.name}
      </Headline>
      <motion.p
        variants={rise}
        className={`fv3-display-tight mt-4 ${mode === "stage" ? "text-[2.4vw]" : "text-2xl"} ${hue.text}`}
      >
        {team.headline}
      </motion.p>
      <motion.ul
        variants={stagger}
        className="mt-4 flex max-w-[64ch] flex-col gap-2"
      >
        {team.lines.map((l) => (
          <motion.li
            key={l}
            variants={rise}
            className={`flex gap-3 ${mode === "stage" ? "text-[1.5vw]" : "text-lg"} leading-snug text-white/85`}
          >
            <span
              className={`mt-[0.55em] h-2 w-2 shrink-0 rounded-full ${hue.bg}`}
            />
            <span>{l}</span>
          </motion.li>
        ))}
      </motion.ul>
      <motion.blockquote
        variants={rise}
        className={`fv3-display mt-6 max-w-[26ch] ${mode === "stage" ? "text-[2.8vw]" : "text-3xl"} text-white`}
      >
        “{team.quote}”
      </motion.blockquote>
    </Frame>
  );
}

/* ------------------------------------------------------------ parallel */

function Box({
  label,
  sub,
  hue,
  live = false,
  stage,
}: {
  label: string;
  sub: string;
  hue: Team["hue"];
  live?: boolean;
  stage: boolean;
}) {
  return (
    <motion.div
      variants={rise}
      className={`fv3-card relative px-3 py-3 text-center ring-2 ${HUE[hue].ring} ${stage ? "px-6 py-4" : ""}`}
    >
      {live && (
        <span className="fv3-pulse absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-white px-3 py-0.5 text-[0.6rem] font-black tracking-widest whitespace-nowrap text-black uppercase md:text-xs">
          Running now
        </span>
      )}
      <p
        className={`fv3-display-tight uppercase ${stage ? "text-[1.9vw]" : "text-base"} ${HUE[hue].text}`}
      >
        {label}
      </p>
      <p className={`${stage ? "text-[1.1vw]" : "text-xs"} text-white/70`}>
        {sub}
      </p>
    </motion.div>
  );
}

function Down({ stage }: { stage: boolean }) {
  return (
    <svg
      viewBox="0 0 20 40"
      className={`${stage ? "h-[3.5vh]" : "h-8"} w-5 self-center`}
      aria-hidden
    >
      <line
        x1="10"
        y1="0"
        x2="10"
        y2="40"
        stroke="white"
        strokeOpacity="0.6"
        strokeWidth="3"
        className="fv3-dash"
      />
    </svg>
  );
}

export function Parallel({ mode }: { mode: Mode }) {
  const stage = mode === "stage";
  return (
    <Frame
      mode={mode}
      className={
        stage ? "justify-center" : "items-center justify-center text-center"
      }
    >
      <div
        className={
          stage
            ? "grid grid-cols-[1fr_1.1fr] items-center gap-[4vw]"
            : "flex flex-col items-center"
        }
      >
        <div className={stage ? "" : "flex flex-col items-center"}>
          <Kicker>The most important slide</Kicker>
          <Headline mode={mode} className="mt-2">
            Both. <span className="fv3-electric">At once.</span>
          </Headline>
          <Line
            mode={mode}
            className={stage ? "mt-4" : "mt-3 self-center text-center"}
          >
            Unification and Care Management are happening in parallel. Not one
            after the other.
          </Line>
          {stage && (
            <Line mode={mode} className="mt-4 text-white/60">
              Data and AI support both. We know the priorities, we understand
              the business, and we are not naive about the challenges.
            </Line>
          )}
        </div>
        <div
          className={`flex w-full flex-col items-stretch ${stage ? "" : "mt-8 max-w-md"}`}
        >
          <Box
            label="Data + AI"
            sub="Evidence and velocity, powering everything below"
            hue="fuchsia"
            stage={stage}
          />
          <Down stage={stage} />
          <div className="relative grid grid-cols-2 gap-4">
            <div className="absolute -top-2 right-[25%] left-[25%] h-0.5 bg-white/40" />
            <div className="flex flex-col">
              <Box
                label="Unification"
                sub="PP → Pro"
                hue="amber"
                live
                stage={stage}
              />
              <Down stage={stage} />
              <Box
                label="Modernization"
                sub="Foundation, data, speed"
                hue="amber"
                stage={stage}
              />
            </div>
            <div className="flex flex-col">
              <Box
                label="Care Management"
                sub="Inbound + outbound referrals"
                hue="emerald"
                live
                stage={stage}
              />
              <Down stage={stage} />
              <Box
                label="Business value"
                sub="Clinics, patients, Cochlear"
                hue="emerald"
                stage={stage}
              />
            </div>
            <div className="absolute right-[25%] -bottom-2 left-[25%] h-0.5 bg-white/40" />
          </div>
          <Down stage={stage} />
          <motion.div
            variants={rise}
            className="fv3-shimmer rounded-2xl p-[3px]"
          >
            <div
              className={`fv3-display rounded-[13px] bg-[#06041a] px-6 py-3 text-center ${stage ? "text-[3vw]" : "text-4xl"}`}
            >
              We win
            </div>
          </motion.div>
        </div>
      </div>
    </Frame>
  );
}

/* ---------------------------------------------------------------- know */

export function Know({ mode }: { mode: Mode }) {
  const stage = mode === "stage";
  return (
    <Frame mode={mode} serious className="justify-center">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.6 }}
      >
        <p
          className={`fv3-display-tight ${stage ? "text-[1.6vw]" : "text-sm"} tracking-[0.3em] text-white/40 uppercase`}
        >
          The serious part
        </p>
        <h1
          className={`fv3-display mt-4 ${stage ? "text-[6.5vw]" : "text-[14vw] leading-[0.92]"} text-white`}
        >
          We don&apos;t need magic.
          <br />
          <span className="text-cyan-300">We need to know.</span>
        </h1>
      </motion.div>
      <motion.ol
        variants={stagger}
        initial="hidden"
        animate="show"
        className={`mt-7 flex max-w-[60ch] flex-col gap-2 ${stage ? "text-[1.7vw]" : "text-lg"}`}
      >
        {KNOW_LADDER.map((r) => (
          <motion.li
            key={r.n}
            variants={rise}
            className="flex items-baseline gap-4 border-l-2 border-white/20 pl-4 text-white/85"
          >
            <span className="fv3-display-tight text-cyan-300">{r.n}</span>
            <span>{r.label}</span>
          </motion.li>
        ))}
      </motion.ol>
      <motion.p
        variants={rise}
        initial="hidden"
        animate="show"
        className={`mt-6 max-w-[52ch] ${stage ? "text-[1.3vw]" : "text-base"} text-white/60`}
      >
        A credible baseline. Honest attribution. Our contribution, measured. Not
        because anyone is wrong today, but because a number we can explain is
        worth more than a number we can&apos;t.
      </motion.p>
    </Frame>
  );
}

/* ---------------------------------------------------------------- vote */

export function Results({
  question,
  tally,
  status,
  mode,
  mine,
}: {
  question: Question;
  tally: readonly number[];
  status: VoteStatus;
  mode: Mode;
  mine?: number;
}) {
  const total = tally.reduce((a, b) => a + b, 0);
  const top = Math.max(...tally);
  const stage = mode === "stage";
  return (
    <div className="flex flex-col gap-3" data-testid="results">
      {question.options.map((label, i) => {
        const n = tally[i] ?? 0;
        const pct = total ? Math.round((n / total) * 100) : 0;
        const hue = HUE[OPTION_HUES[i % OPTION_HUES.length]!];
        const winner = status === "revealed" && total > 0 && n === top;
        return (
          <div
            key={label}
            className={`relative overflow-hidden rounded-2xl bg-white/8 ${winner ? "ring-2 ring-white" : ""}`}
          >
            <motion.div
              className={`absolute inset-y-0 left-0 bg-gradient-to-r ${hue.bar} opacity-80`}
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ type: "spring", stiffness: 60, damping: 18 }}
            />
            <div
              className={`relative flex items-center justify-between gap-3 ${stage ? "px-6 py-3 text-[1.9vw]" : "px-4 py-3 text-base"}`}
            >
              <span className="fv3-display-tight text-white drop-shadow">
                {label}
                {mine === i && (
                  <span className="ml-2 text-white/80">· you</span>
                )}
              </span>
              <span
                className="fv3-display-tight shrink-0 text-white tabular-nums"
                data-testid={`tally-${i}`}
              >
                {pct}%
                <span className="ml-2 text-[0.6em] text-white/60">{n}</span>
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function VoteStage({
  question,
  snapshot,
}: {
  question: Question;
  snapshot: Snapshot;
}) {
  const status = snapshot.state.questions[question.id];
  const tally = snapshot.tallies[question.id];
  const total = tally.reduce((a, b) => a + b, 0);
  return (
    <Frame mode="stage" className="justify-center">
      <Kicker>
        Live vote ·{" "}
        {status === "open"
          ? "voting is open"
          : status === "revealed"
            ? "the results"
            : "voting closed"}
      </Kicker>
      <motion.h1
        variants={rise}
        className="fv3-display mt-3 max-w-[22ch] text-[4.2vw]"
      >
        {question.prompt}
      </motion.h1>
      <div className="mt-6 grid grid-cols-[1fr_auto] items-start gap-[4vw]">
        <div>
          {status === "revealed" ? (
            <Results
              question={question}
              tally={tally}
              status={status}
              mode="stage"
            />
          ) : (
            <motion.ol variants={stagger} className="flex flex-col gap-3">
              {question.options.map((o, i) => (
                <motion.li
                  key={o}
                  variants={rise}
                  className="fv3-card flex items-center gap-4 px-6 py-3 text-[1.9vw]"
                >
                  <span
                    className={`h-4 w-4 rounded-full ${HUE[OPTION_HUES[i % OPTION_HUES.length]!].bg}`}
                  />
                  <span className="fv3-display-tight">{o}</span>
                </motion.li>
              ))}
            </motion.ol>
          )}
          {question.note && status === "revealed" && (
            <p className="mt-5 text-[1.6vw] text-white/70">{question.note}</p>
          )}
        </div>
        <motion.div
          variants={rise}
          className="fv3-card flex flex-col items-center px-8 py-6 text-center"
        >
          <span
            className={`fv3-display text-[5.5vw] ${status === "open" ? "fv3-pulse" : ""}`}
            data-testid="stage-total"
          >
            {total}
          </span>
          <span className="text-[1.4vw] text-white/70">votes in</span>
          <div className="mt-4">
            <Qr size={140} />
          </div>
        </motion.div>
      </div>
    </Frame>
  );
}

/* ----------------------------------------------------------- challenge */

export function ChallengeStage({ snapshot }: { snapshot: Snapshot }) {
  const cards = snapshot.feedback;
  return (
    <Frame mode="stage">
      <div className="flex items-end justify-between">
        <div>
          <Kicker>Challenge us</Kicker>
          <motion.h1 variants={rise} className="fv3-display mt-2 text-[5.5vw]">
            What did <span className="fv3-electric">we miss?</span>
          </motion.h1>
          <Line mode="stage" className="mt-3">
            Anonymous. On your phone. A person reads it before it lands here.
          </Line>
        </div>
        <Qr size={150} />
      </div>
      <motion.ul
        variants={stagger}
        className="mt-6 max-h-[60vh] columns-2 gap-4 overflow-hidden xl:columns-3 [&>li]:mb-4 [&>li]:break-inside-avoid"
      >
        {cards.length === 0 && (
          <motion.li
            variants={rise}
            className="fv3-card px-6 py-5 text-[1.5vw] text-white/60"
          >
            The cauldron is empty. Fill it.
          </motion.li>
        )}
        {cards.map((c, i) => (
          <motion.li
            key={c.id}
            variants={rise}
            className={`fv3-card px-6 py-5 ring-1 ${HUE[OPTION_HUES[i % 4]!].ring}`}
            data-testid="stage-feedback"
          >
            <p className="text-[1.1vw] tracking-widest text-white/50 uppercase">
              {c.prompt === "missed"
                ? "What we missed"
                : c.prompt === "better"
                  ? "Do better"
                  : "Help us deliver"}
            </p>
            <p className="fv3-display-tight mt-1 text-[1.5vw] leading-tight text-white">
              {c.body}
            </p>
          </motion.li>
        ))}
      </motion.ul>
    </Frame>
  );
}

/* -------------------------------------------------------------- finale */

export function FinaleHeader({ mode }: { mode: Mode }) {
  return (
    <>
      <Kicker className="text-fuchsia-300">The Fairview 3 anthem</Kicker>
      <motion.h1
        variants={rise}
        className={`fv3-display fv3-glow-text mt-2 ${mode === "stage" ? "text-[5.5vw]" : "text-[15vw] leading-[0.9]"}`}
      >
        {ANTHEM_TITLE}
      </motion.h1>
      <motion.p
        variants={rise}
        className={`fv3-display-tight mt-2 ${mode === "stage" ? "text-[1.8vw]" : "text-xl"} text-white/70`}
      >
        {ANTHEM_SUBTITLE} 🤘
      </motion.p>
    </>
  );
}

export const teamFor = (id: Team["id"]) => TEAMS.find((t) => t.id === id)!;
