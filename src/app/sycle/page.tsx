import type { Metadata } from "next";
import { cookies } from "next/headers";
import { COOKIE, verify } from "@/lib/sycle/access";
import { sycleSetup } from "@/lib/sycle/config";
import { readBoard } from "@/lib/sycle/service";
import { DOORS, vancouverAdventures } from "@/lib/sycle/adventures";
import { ownRecord } from "@/domain/sycle/board";
import { SycleBoard } from "@/components/sycle/SycleBoard";
import { Gate } from "@/components/sycle/Gate";

export const metadata: Metadata = {
  title: "Sycle · Everyone's coming to Vancouver",
  // Private by intent: not indexed, not linked from Passport's navigation.
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * **`/sycle` — the Sycle conference arrival board.**
 *
 * A private, opt-in pilot of what a conference could be inside Passport: who
 * is on the way, when you land, and what you are all going to do once you
 * have. It is deliberately standalone — not in `PassportNav`, not an
 * experience domain, not a tab — because whether Experiences are themes or
 * compositions (doctrine §10, §15.1) and how group experiences work (§15.12)
 * are open questions this pilot should inform, not answer by accident.
 *
 * Its one dependency on the rest of Passport is the right one: "what do you
 * want to do in Vancouver?" is answered by GO HAVE A DAY (`/go`), linked into
 * with its own query parameters and never modified from here.
 */
export default async function SyclePage() {
  const setup = sycleSetup();
  const shell = (children: React.ReactNode) => (
    <main className="min-h-screen bg-[#071526] text-white">{children}</main>
  );

  if (!setup.open)
    return shell(
      <div className="mx-auto max-w-[720px] px-6 py-24">
        <p className="text-[12px] font-bold tracking-[0.18em] text-[#ffd27a] uppercase">
          Sycle · Vancouver
        </p>
        <h1 className="mt-2 text-[44px] leading-none font-black tracking-tight">
          The board isn&apos;t open yet.
        </h1>
        <p className="mt-4 text-white/60">
          Check back closer to the conference.
        </p>
        {process.env.NODE_ENV !== "production" ? (
          <p className="mt-6 font-mono text-[12px] text-white/40">
            missing: {setup.missing.join(", ")}
          </p>
        ) : null}
      </div>,
    );

  const viewerId = verify(
    setup.config.secret,
    (await cookies()).get(COOKIE)?.value,
  );
  if (!viewerId)
    return shell(
      <div className="mx-auto max-w-[720px] px-6 py-24">
        <p className="text-[12px] font-bold tracking-[0.18em] text-[#ffd27a] uppercase">
          Sycle · Vancouver
        </p>
        <h1 className="mt-2 text-[44px] leading-[0.95] font-black tracking-[-0.04em] sm:text-[64px]">
          Everyone&apos;s coming to Vancouver.
        </h1>
        <p className="mt-4 max-w-[52ch] text-[17px] text-white/65">
          Watch colleagues converge from all over the world, count down to your
          own landing, and find someone to go do something great with once
          you&apos;re here.
        </p>
        <Gate />
        <p className="mt-10 max-w-[52ch] text-[12px] text-white/40">
          Only Sycle conference participants have the code. Nobody appears on
          the board unless they choose to.
        </p>
      </div>,
    );

  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Vancouver",
  }).format(new Date());
  const [view, adventures] = await Promise.all([
    readBoard(setup.config, viewerId),
    vancouverAdventures(today),
  ]);

  const doors = DOORS.map((d) => ({
    label: d.label,
    href: `/go?${new URLSearchParams({ say: d.say, at: "vancouver" })}`,
  }));

  return shell(
    <SycleBoard
      initial={{
        board: view.board,
        me: ownRecord(view.me),
        interest: Object.fromEntries(view.interest),
        expiresAt: view.expiresAt,
      }}
      adventures={adventures.ok ? adventures.adventures : null}
      doors={doors}
      lookupConnected={setup.config.provider !== null}
      today={today}
      renderedAt={new Date().toISOString()}
    />,
  );
}
