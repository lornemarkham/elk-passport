"use client";

import type { LivePrompt } from "@/experience-lab/core/engine";
import type { LedgerRow } from "@/domain/hockey/challenges";
import { FanAvatar } from "../FanTag";
import type { SharedNight } from "../useSharedNight";
import styles from "../hockey.module.css";

/**
 * **Secret missions, out of the toy box and onto the page.** A mission is
 * still the lab's: one person sees it, it binds nobody who didn't opt in,
 * and passing is never announced. What changed is how it scores: its
 * target says "done", its mastermind — the only other person who knows what
 * it was — confirms, and the database's ledger (`mission ledger`) counts it
 * for everybody alike. Nobody verifies their own.
 */
export function Missions({
  night,
  ledger,
  onSlip,
}: {
  night: SharedNight;
  ledger: readonly LedgerRow[];
  onSlip?: () => void;
}) {
  const { live, state } = night;
  const me = live.me?.id;
  if (!me) return null;
  const secret = (p: LivePrompt) =>
    (p.prompt.family === "mission" || p.prompt.family === "dare") &&
    p.prompt.audience?.only;
  const forMe = live.prompts.filter(
    (p) => secret(p) && p.prompt.audience?.only === me,
  );
  // The engine shows a mission only to its target — not even to whoever
  // wrote it — so the mastermind's side reads what they asked directly.
  const fromMe = state.addedPrompts
    .filter(
      (p) =>
        (p.family === "mission" || p.family === "dare") &&
        p.askedBy === me &&
        p.audience?.only &&
        p.audience.only !== me,
    )
    .map((prompt) => ({ prompt }));
  const name = (id?: string) =>
    live.participants.find((p) => p.id === id)?.name ?? "somebody";
  const person = (id?: string) => live.participants.find((p) => p.id === id);
  const done = new Set(ledger.map((l) => l.prompt_id));
  const others = ledger.filter((l) => l.earner !== me);

  if (
    forMe.length === 0 &&
    fromMe.length === 0 &&
    others.length === 0 &&
    !onSlip
  )
    return null;

  return (
    <section aria-labelledby="missions-title">
      <h2
        id="missions-title"
        className={`${styles.display} text-[34px] leading-[0.9] text-white`}
      >
        Secret missions
      </h2>
      <p className="mt-1.5 text-[14.5px] text-white/70">
        One person gets it. Nobody else knows. It counts once the mastermind
        confirms.
      </p>

      <div className="mt-3 flex flex-col gap-2.5">
        {forMe.map((p) => {
          const from = person(p.prompt.askedBy);
          const passed = state.declined.includes(p.prompt.id);
          const claimed = p.myResponse?.value === true;
          const confirmed = done.has(p.prompt.id);
          return (
            <article
              key={p.prompt.id}
              aria-label="Your secret mission"
              className={`${styles.gamecard} ${styles.rise} ${!p.consented && !passed ? styles.callout : ""} rounded-[24px] p-4 ring-1 ring-white/12`}
              style={{ ["--tone" as string]: "#1f2937" }}
            >
              <p className="flex items-center gap-2 text-[11.5px] font-extrabold tracking-[0.18em] text-[#ffd84d] uppercase">
                🕵️ Top secret{" "}
                {from && (
                  <>
                    · from <FanAvatar person={from} size={20} /> {from.name}
                  </>
                )}
              </p>
              <p
                className={`${styles.wide} mt-2 text-[19px] leading-snug text-white`}
              >
                {p.consented
                  ? p.prompt.brief
                  : "A mission is waiting for you. Opt in to read it — or pass, and nobody is told."}
              </p>
              {!p.consented && !passed && (
                <div className="mt-3 grid grid-cols-[1.4fr_1fr] gap-2">
                  <button
                    type="button"
                    onClick={() => night.consent(p.prompt.id, true)}
                    className={`${styles.display} min-h-12 rounded-2xl bg-[#ffd84d] text-[19px] text-[#0b1220]`}
                  >
                    Show me
                  </button>
                  <button
                    type="button"
                    onClick={() => night.consent(p.prompt.id, false)}
                    className="min-h-12 rounded-2xl text-[14.5px] font-bold text-white/80 ring-1 ring-white/20"
                  >
                    Not for me
                  </button>
                </div>
              )}
              {passed && (
                <p className="mt-2 text-[13.5px] text-white/60">
                  You passed. Nobody was told.
                </p>
              )}
              {p.consented && !claimed && p.open && (
                <button
                  type="button"
                  onClick={() => night.respond(p.prompt.id, true)}
                  className={`${styles.display} mt-3 min-h-12 w-full rounded-2xl bg-[#ffd84d] text-[19px] text-[#0b1220]`}
                >
                  I pulled it off
                </button>
              )}
              {claimed && (
                <p className="mt-2 text-[14px] font-semibold text-white/80">
                  {confirmed
                    ? `Confirmed by ${from?.name ?? "the mastermind"}. It's in the Cup.`
                    : `Claimed. Waiting on ${from?.name ?? "the mastermind"} to confirm.`}
                </p>
              )}
            </article>
          );
        })}

        {fromMe.map((p) => {
          const to = person(p.prompt.audience?.only);
          const called = p.prompt.resolution;
          const confirmed = done.has(p.prompt.id);
          return (
            <article
              key={p.prompt.id}
              aria-label={`Your mission for ${to?.name ?? "them"}`}
              className="rounded-[24px] bg-white/[0.05] p-4 ring-1 ring-white/10"
            >
              <p className="flex items-center gap-2 text-[11.5px] font-extrabold tracking-[0.18em] text-white/60 uppercase">
                Your mission for {to && <FanAvatar person={to} size={20} />}{" "}
                {to?.name}
              </p>
              <p className="mt-1.5 text-[15px] text-white/85">
                {p.prompt.brief}
              </p>
              {confirmed ? (
                <p className="mt-2 text-[14px] font-bold text-[#46d37f]">
                  They did it, you confirmed it. It&apos;s in the Cup.
                </p>
              ) : (
                <>
                  <p className="mt-2 text-[13.5px] text-white/60">
                    {called === true
                      ? `You've confirmed it. It counts once ${to?.name ?? "they"} say${to ? "s" : ""} they did it too.`
                      : `Did ${to?.name ?? "they"} pull it off? Only you can say — they can't confirm their own.`}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      aria-pressed={called === true}
                      onClick={() =>
                        night.send({
                          type: "callIt",
                          promptId: p.prompt.id,
                          value: called === true ? null : true,
                        })
                      }
                      className={`min-h-11 rounded-full px-4 text-[14px] font-bold ${called === true ? "bg-[#0f7a3d] text-white" : "bg-white/[0.08] text-white ring-1 ring-white/15"}`}
                    >
                      {called === true ? "Confirmed ✓" : "Yes, they did it"}
                    </button>
                  </div>
                </>
              )}
            </article>
          );
        })}

        {others.length > 0 && (
          <p className="rounded-2xl bg-white/[0.05] px-4 py-3 text-[14.5px] text-white/80">
            🕵️ Missions pulled off tonight:{" "}
            {[...new Set(others.map((l) => l.earner))]
              .map((id) => name(id))
              .join(", ")}
            . What they were stays secret.
          </p>
        )}

        {onSlip && (
          <button
            type="button"
            onClick={onSlip}
            className="min-h-12 rounded-2xl border-2 border-dashed border-white/25 px-4 text-left text-[15px] font-bold text-white transition hover:border-white/50"
          >
            🕵️ Slip somebody a secret mission
          </button>
        )}
      </div>
    </section>
  );
}
