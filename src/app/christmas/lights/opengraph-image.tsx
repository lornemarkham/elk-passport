import { ImageResponse } from "next/og";

export const alt =
  "The Christmas Lights Map — Vernon, Coldstream and the Okanagan";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * The picture a link to the lights map unfolds into on Facebook, Messenger,
 * iMessage and the rest. Drawn, not photographed: it promises no particular
 * home, and so reveals none.
 */
export default function Image() {
  const bulbs = ["#b3242f", "#ffd98a", "#2f9e66", "#ffd98a", "#b3242f"];
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 64,
        background: "linear-gradient(160deg,#06170f 0%,#0f3b2b 100%)",
        color: "white",
      }}
    >
      <div style={{ display: "flex", gap: 28 }}>
        {Array.from({ length: 12 }, (_, i) => (
          <div
            key={i}
            style={{
              width: 34,
              height: 34,
              borderRadius: 34,
              background: bulbs[i % bulbs.length],
              marginTop: i % 2 ? 18 : 0,
            }}
          />
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ fontSize: 30, color: "#ffd98a", letterSpacing: 6 }}>
          GO HAVE A CHRISTMAS
        </div>
        <div style={{ fontSize: 104, fontWeight: 800, lineHeight: 1.0 }}>
          The Christmas Lights Map
        </div>
        <div style={{ fontSize: 38, marginTop: 24, color: "#e8f3ec" }}>
          Vernon · Coldstream · Armstrong · Lumby · Kelowna
        </div>
      </div>
      <div style={{ display: "flex", fontSize: 34, color: "#ffd98a" }}>
        📍 Know a magical display? Pin it · gohaveaday.com
      </div>
    </div>,
    size,
  );
}
