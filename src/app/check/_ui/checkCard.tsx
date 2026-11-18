import { ImageResponse } from "next/og";
import { ASSESSMENT_INFO, type Assessment } from "@/lib/pulse/check";
import { BRAND } from "@/lib/pulse/model";
import { PULSE_RED } from "@/app/labs/pulse/_ui/brand";

export const CHECK_OG_SIZE = { width: 1200, height: 630 };

/**
 * The preview a Pulse Check link unfolds into on Facebook and in messages:
 * the claim, People's Pulse, and the evidence status so far. **Never** the
 * screenshot someone attached, never a vote count.
 */
export function checkCard(claim: string | null, assessment: Assessment | null) {
  const text = claim
    ? `“${claim.length > 150 ? `${claim.slice(0, 147)}…` : claim}”`
    : "Seen a claim? Check what the evidence says.";
  const info = assessment ? ASSESSMENT_INFO[assessment] : null;
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 60,
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
        <div style={{ fontSize: 30, fontWeight: 700, color: PULSE_RED }}>
          · Pulse Check
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div
          style={{
            fontSize: 30,
            fontWeight: 800,
            color: "#5c6370",
            letterSpacing: 2,
          }}
        >
          IS THIS TRUE?
        </div>
        <div
          style={{
            display: "flex",
            fontSize: text.length > 100 ? 46 : 58,
            fontWeight: 800,
            lineHeight: 1.12,
          }}
        >
          {text}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
        {info ? (
          <div
            style={{
              display: "flex",
              border: `4px solid ${info.color}`,
              color: info.color,
              borderRadius: 16,
              padding: "12px 24px",
              fontSize: 34,
              fontWeight: 800,
              background: "white",
            }}
          >
            {info.label.toUpperCase()}
          </div>
        ) : null}
        <div style={{ display: "flex", fontSize: 28, color: "#5c6370" }}>
          {info
            ? "so far · check the sources and have your say"
            : "Check the sources · have your say"}
        </div>
      </div>
    </div>,
    CHECK_OG_SIZE,
  );
}
