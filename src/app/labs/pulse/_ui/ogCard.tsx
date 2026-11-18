import { ImageResponse } from "next/og";
import { BRAND } from "@/lib/pulse/model";
import { ANSWER_COLORS, PULSE_RED } from "./brand";

export const OG_SIZE = { width: 1200, height: 630 };

/**
 * The card a shared link unfolds into. It shows the question and answers,
 * never the results, so a preview can't nudge a vote or go stale.
 */
export function ogCard(question: string, answers: readonly string[]) {
  const long = question.length > 90;
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 64,
        background: "#fbfaf7",
        color: "#14161a",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 56,
            background: PULSE_RED,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg width="40" height="40" viewBox="0 0 32 32">
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
        <div style={{ fontSize: 34, fontWeight: 800 }}>{BRAND.name}</div>
        <div style={{ fontSize: 28, color: "#5c6370", marginLeft: 8 }}>
          {BRAND.tagline}
        </div>
      </div>
      <div
        style={{
          display: "flex",
          fontSize: long ? 56 : 72,
          fontWeight: 800,
          lineHeight: 1.1,
        }}
      >
        {question.length > 160 ? `${question.slice(0, 157)}…` : question}
      </div>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        {answers.slice(0, 4).map((a, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              border: "3px solid #e7e3da",
              borderRadius: 999,
              padding: "14px 28px",
              fontSize: 32,
              fontWeight: 700,
              background: "white",
            }}
          >
            <div
              style={{
                width: 20,
                height: 20,
                borderRadius: 20,
                background: ANSWER_COLORS[i],
              }}
            />
            {a.length > 28 ? `${a.slice(0, 26)}…` : a}
          </div>
        ))}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            fontSize: 30,
            color: "#5c6370",
            marginLeft: 12,
          }}
        >
          Tap to vote · no sign-up
        </div>
      </div>
    </div>,
    OG_SIZE,
  );
}
