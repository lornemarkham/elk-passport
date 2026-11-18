import { ImageResponse } from "next/og";
import {
  BRAND,
  isCircleCode,
  isProvince,
  isPulseId,
  kindOf,
  provinceName,
} from "@/lib/pulse/model";
import type { Ranked } from "@/lib/pulse/modes";
import { experience } from "@/lib/pulse/templates";
import { guardRequest } from "@/lib/pulse/http";
import { computeResults, type Share } from "@/lib/pulse/results";
import { NotReady, pulseStore } from "@/lib/pulse/store";
import { ANSWER_COLORS, PULSE_RED } from "../../_ui/brand";

export const dynamic = "force-dynamic";

const W = 1080;
const H = 1350;

/** Answer bars: label and percentage in ink, the bar in its colour. */
function Bars({
  shares,
  big: wanted,
}: {
  shares: readonly Share[];
  big: boolean;
}) {
  // Five or six ranges (Is This Normal?) fit at the smaller size.
  const big = wanted && shares.length <= 4;
  return (
    <div
      style={{ display: "flex", flexDirection: "column", gap: big ? 26 : 18 }}
    >
      {shares.slice(0, 6).map((s, i) => (
        <div
          key={s.optionId}
          style={{ display: "flex", flexDirection: "column", gap: 8 }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              fontSize: big ? 40 : 32,
              fontWeight: 700,
            }}
          >
            <span>
              {s.label.length > 26 ? `${s.label.slice(0, 24)}…` : s.label}
            </span>
            <span style={{ fontSize: big ? 56 : 40, fontWeight: 800 }}>
              {s.pct}%
            </span>
          </div>
          <div
            style={{
              display: "flex",
              height: big ? 26 : 20,
              background: "#efece5",
              borderRadius: 20,
            }}
          >
            <div
              style={{
                width: `${s.pct}%`,
                height: "100%",
                borderRadius: 20,
                background: ANSWER_COLORS[i],
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Rank These: the group's order, numbered, with how often each came first. */
function RankRows({ items, big }: { items: readonly Ranked[]; big: boolean }) {
  return (
    <div
      style={{ display: "flex", flexDirection: "column", gap: big ? 20 : 14 }}
    >
      {items.slice(0, 6).map((r, i) => (
        <div
          key={r.optionId}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 24,
            fontSize: big ? 44 : 34,
            fontWeight: 700,
          }}
        >
          <div
            style={{
              width: big ? 72 : 56,
              height: big ? 72 : 56,
              borderRadius: 72,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: i === 0 ? PULSE_RED : "#efece5",
              color: i === 0 ? "white" : "#14161a",
              fontWeight: 800,
            }}
          >
            {String(i + 1)}
          </div>
          <div style={{ display: "flex", flex: 1 }}>
            {r.label.length > 24 ? `${r.label.slice(0, 22)}…` : r.label}
          </div>
          <div
            style={{
              display: "flex",
              fontSize: big ? 28 : 24,
              color: "#5c6370",
            }}
          >
            {`${r.firstPct}% first`}
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * **The results card**: a portrait picture of where a Pulse stands, made to
 * be shared from a phone. `?c=<circle code>` adds "My circle vs Everyone",
 * `?p=<province>` adds one province. A comparison appears only when its group
 * has enough votes to show (the same rule as the page), and the card says
 * these are voluntary responses, not a scientific poll.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const refused = guardRequest(request, "read");
  if (refused) return refused;
  const { id } = await params;
  if (!isPulseId(id)) return new Response("Not found", { status: 404 });
  const q = new URL(request.url).searchParams;
  const c = q.get("c");
  const p = q.get("p");
  let pulse;
  let votes;
  try {
    const store = pulseStore();
    pulse = await store.get(id);
    votes = pulse ? await store.votes(id) : [];
  } catch (e) {
    if (e instanceof NotReady)
      return new Response("Not ready", { status: 503 });
    throw e;
  }
  if (!pulse || pulse.status !== "live")
    return new Response("Not found", { status: 404 });

  const now = new Date();
  const kind = kindOf(pulse);
  const r = computeResults(pulse, votes, isCircleCode(c) ? c : null, now);
  const circle = r.circle?.shares ? r.circle : null;
  // Places stay off rankings and ranges, as on the page.
  const place =
    isProvince(p) && kind !== "rank" && kind !== "normal"
      ? r.provinces.find((x) => x.key === p && x.shares)
      : undefined;
  const ranking = r.modes.ranking;
  const normal = r.modes.normal;
  const v = r.modes.verdict;
  const headline =
    v && v.status !== "early"
      ? v.status === "tie"
        ? "Dead even, so far"
        : v.status === "close"
          ? `Too close to call — ${v.winner} leads`
          : `${v.winner} wins, ${v.pct}%`
      : normal?.everyone.median
        ? `The middle answer: ${normal.everyone.median}`
        : null;
  const compare = circle
    ? { name: "My circle", total: circle.counted, shares: circle.shares! }
    : place
      ? {
          name: `${provinceName(place.key)} (self-reported)`,
          total: place.counted,
          shares: place.shares!,
        }
      : null;
  const long = pulse.question.length > 90;
  const early = r.total < 30;

  const image = new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 72,
        background: "#fbfaf7",
        color: "#14161a",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: 64,
            background: PULSE_RED,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg width="46" height="46" viewBox="0 0 32 32">
            <path
              d="M3 17h6l2.5-6 4 11 3-8 1.5 3H29"
              fill="none"
              stroke="white"
              strokeWidth="2.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 38, fontWeight: 800 }}>
            {kind === "pulse" ? BRAND.name : experience(kind).name}
          </div>
          {kind === "pulse" ? null : (
            <div style={{ fontSize: 24, color: "#5c6370" }}>{BRAND.name}</div>
          )}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          fontSize: long ? 56 : 68,
          fontWeight: 800,
          lineHeight: 1.1,
        }}
      >
        {pulse.question.length > 150
          ? `${pulse.question.slice(0, 147)}…`
          : pulse.question}
      </div>

      {ranking ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 30 }}>
          {ranking.circle && isCircleCode(c) ? (
            <div
              style={{
                display: "flex",
                fontSize: 28,
                fontWeight: 700,
                color: "#5c6370",
              }}
            >
              {"My circle's ranking"}
            </div>
          ) : null}
          <RankRows
            items={
              ranking.circle && isCircleCode(c) ? ranking.circle : ranking.items
            }
            big={pulse.options.length <= 4}
          />
        </div>
      ) : normal && !normal.everyone.shares ? (
        <div
          style={{
            display: "flex",
            fontSize: 40,
            fontWeight: 700,
            color: "#5c6370",
          }}
        >
          {"Results appear once 5 people have answered."}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 36 }}>
          {headline ? (
            <div
              style={{
                display: "flex",
                fontSize: 46,
                fontWeight: 800,
                color: PULSE_RED,
              }}
            >
              {headline}
            </div>
          ) : null}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {compare ? (
              <div
                style={{
                  display: "flex",
                  fontSize: 28,
                  fontWeight: 700,
                  color: "#5c6370",
                }}
              >
                {`Everyone · ${r.total.toLocaleString("en-CA")} people`}
              </div>
            ) : null}
            <Bars shares={r.everyone} big={!compare} />
          </div>
          {compare ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div
                style={{
                  display: "flex",
                  fontSize: 28,
                  fontWeight: 700,
                  color: "#5c6370",
                }}
              >
                {`${compare.name} · ${compare.total.toLocaleString("en-CA")} people`}
              </div>
              <Bars shares={compare.shares} big={false} />
            </div>
          ) : null}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", fontSize: 40, fontWeight: 800 }}>
          {`${r.total.toLocaleString("en-CA")} ${r.total === 1 ? "person has" : "people have"} answered${early ? " — early results" : ""}`}
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 24,
            color: "#5c6370",
            lineHeight: 1.3,
          }}
        >
          {kind === "normal"
            ? "Ranges from whoever chose to answer, shown in steps of 5. Not population statistics, and not representative of Canada."
            : "Voluntary responses from whoever chose to answer. Not a scientific poll, and not representative of Canada."}
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 26,
            fontWeight: 700,
            borderTop: "3px solid #e7e3da",
            paddingTop: 20,
          }}
        >
          <span>{BRAND.hub}</span>
          <span style={{ color: "#5c6370" }}>{BRAND.footer}</span>
        </div>
      </div>
    </div>,
    { width: W, height: H },
  );
  image.headers.set("Cache-Control", "public, max-age=30, s-maxage=30");
  return image;
}
