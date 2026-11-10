import { ImageResponse } from "next/og";

const SIZES = new Set([180, 192, 512]);

/** The Home Screen icon: a shuttlecock on court green. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ size: string }> },
) {
  const n = Number((await params).size);
  const size = SIZES.has(n) ? n : 192;
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#020617",
        color: "#a3e635",
        fontSize: size * 0.62,
      }}
    >
      🏸
    </div>,
    {
      width: size,
      height: size,
      headers: { "Cache-Control": "public, max-age=86400" },
    },
  );
}
