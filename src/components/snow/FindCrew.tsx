"use client";

import {
  SHARE_MINUTES,
  describeFrom,
  isStale,
  labelFor,
  remainingWords,
  type Fix,
} from "@/domain/snow/location";
import { personName } from "@/domain/snow/day";
import type { TabProps } from "./tabs";
import { Card, styles } from "./kit";

const big = `${styles.btn} min-h-16 px-2 text-base font-bold`;

/**
 * **Find your crew, if everyone wants to be found.**
 *
 * Off until someone taps a length of time. Shows only people who chose the
 * same, and only while you do. Words first (how far, which way), a map link
 * second. It never says where anyone *should* be.
 */
export function FindCrew({ day, now, crew }: TabProps) {
  if (!crew) return null;
  if (crew.off)
    return (
      <Card className="space-y-2" data-testid="find-crew">
        <h2 className="text-xl font-extrabold">Find your crew</h2>
        <p className="text-sm text-[var(--sn-frost)]" data-testid="find-off">
          Location sharing isn&apos;t switched on yet. Say where you are in
          words above, or in the chat.
        </p>
      </Card>
    );

  const me: Fix | null = crew.mine;
  return (
    <Card className="space-y-3" data-testid="find-crew">
      <h2 className="text-xl font-extrabold">Find your crew</h2>

      {!crew.sharing ? (
        <>
          <p className="text-sm text-[var(--sn-frost)]">
            Optional. Share where you are with the people in this day who do the
            same, for as long as you choose. It stops by itself.
          </p>
          <div className="grid grid-cols-2 gap-3">
            {SHARE_MINUTES.map((m) => (
              <button
                key={m}
                className={big}
                disabled={crew.busy}
                onClick={() => crew.start(m)}
                data-testid={`share-${m}`}
              >
                {crew.busy ? "…" : `Share for ${labelFor(m)}`}
              </button>
            ))}
          </div>
          <ul className="space-y-1 text-xs text-[var(--sn-frost)]">
            <li>• Your phone asks first. Say no and nothing is shared.</li>
            <li>
              • Only crew members sharing right now can see you, and you see
              only them.
            </li>
            <li>
              • Rounded to about 11 m. Updates only while this page is open.
            </li>
            <li>• Stop any time; it&apos;s erased, not hidden.</li>
          </ul>
        </>
      ) : (
        <>
          <p className="text-lg font-bold" data-testid="sharing-on">
            You&apos;re sharing · {remainingWords(crew.sharing.expiresAt, now)}
          </p>
          <button
            className={`${styles.go} min-h-16 w-full rounded-full text-lg uppercase`}
            onClick={crew.stop}
            data-testid="stop-sharing"
          >
            Stop sharing
          </button>
          {crew.others.length === 0 ? (
            <p className="text-sm text-[var(--sn-frost)]" data-testid="nobody">
              Nobody else is sharing right now. Ask them to tap Share on their
              phone.
            </p>
          ) : (
            <ul className="space-y-2" data-testid="crew-positions">
              {crew.others.map((o) => (
                <li
                  key={o.memberId}
                  className={`rounded-xl border border-[var(--sn-line)] p-3 ${isStale(o, now) ? "opacity-70" : ""}`}
                >
                  <p className="font-bold">{personName(day, o.memberId)}</p>
                  <p className="text-sm">
                    {me
                      ? describeFrom(me, o, now)
                      : "Waiting for your own position…"}
                  </p>
                  <a
                    className="text-sm underline"
                    href={`https://www.openstreetmap.org/?mlat=${o.lat}&mlon=${o.lng}#map=18/${o.lat}/${o.lng}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open map ↗
                  </a>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      {crew.problem && (
        <p
          role="status"
          className="text-sm font-semibold text-[var(--sn-glow)]"
        >
          {crew.problem}
        </p>
      )}
    </Card>
  );
}
