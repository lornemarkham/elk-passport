import Link from "next/link";
import styles from "./hockey.module.css";

/**
 * **gohaveaday.com/hockey, signed out.** Hockey Night's front door: what it
 * is, in the register the night itself speaks, and one thing to do. Nothing
 * on it comes from a night — no names, no picks, no arena — so a stranger
 * learns only that the thing exists. Private nights stay private; every one
 * is still invitation-only once it exists.
 */
export function HockeyLanding({ next = "/hockey" }: { next?: string }) {
  const signIn = `/auth?next=${encodeURIComponent(next)}`;
  return (
    <main
      className={`${styles.page} min-h-dvh px-5 pt-14 pb-24 text-white`}
      style={
        { "--home": "#00205b", "--away": "#8a1538" } as React.CSSProperties
      }
    >
      <div className="mx-auto max-w-md">
        <p className="text-[13px] tracking-wide text-white/45 uppercase">
          Hockey Night · by Go Have a Day
        </p>
        <h1
          className={`${styles.wide} mt-3 text-[44px] leading-[0.92] text-balance text-white`}
        >
          Hockey is better with your crew.
        </h1>
        <ol
          aria-label="What a Hockey Night is"
          className={`${styles.display} mt-6 flex flex-col gap-1.5 text-[26px] leading-none text-white/90`}
        >
          <li>Plan the night.</li>
          <li>Pick your teams.</li>
          <li>Talk trash.</li>
          <li>Make predictions.</li>
          <li>Compete.</li>
          <li>Make memories.</li>
        </ol>
        <Link
          href={signIn}
          className="mt-8 flex min-h-14 w-full items-center justify-center rounded-full bg-[#ffd84d] text-[18px] font-extrabold tracking-wide text-[#0b1220] uppercase transition active:scale-[0.98]"
        >
          Start a Hockey Night
        </Link>
        <p className="mt-3 text-center text-[13.5px] text-white/55">
          Free. Any NHL game, any arena. Sign in, pick the game, send one link
          per friend.
        </p>

        <section aria-label="How it goes" className="mt-10 flex flex-col gap-3">
          {[
            [
              "Before",
              "Vote on where to eat. Declare who you bleed for. Seal your picks — the score, first goal, who complains about the refs first. Throw a bet at somebody.",
            ],
            [
              "During",
              "Phones away. The intermissions are for one stupid thing. The host calls it when the horn goes, from the league's own numbers.",
            ],
            [
              "After",
              "Awards. Receipts. The spectacularly wrong pick, framed. Photos. Then run it back — the Cup carries over, the points don't.",
            ],
          ].map(([title, body]) => (
            <div
              key={title}
              className="rounded-2xl bg-white/[0.06] px-4 py-3.5 ring-1 ring-white/10"
            >
              <p className="text-[12px] font-bold tracking-[0.16em] text-[#ffd84d] uppercase">
                {title}
              </p>
              <p className="mt-1 text-[15px] leading-snug text-white/85">
                {body}
              </p>
            </div>
          ))}
        </section>

        <p className="mt-10 text-[13.5px] leading-snug text-white/50">
          Got an invitation link? Open it — it brings you straight to your
          night. Every night is private to the people invited to it.
        </p>
      </div>
    </main>
  );
}
