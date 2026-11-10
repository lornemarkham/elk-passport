/** Add to Home Screen: CourtQueue opens like an app, straight onto /badminton. */
export function GET() {
  return Response.json(
    {
      name: "CourtQueue — Everybody Plays",
      short_name: "CourtQueue",
      start_url: "/badminton",
      scope: "/badminton",
      display: "standalone",
      background_color: "#020617",
      theme_color: "#020617",
      icons: [
        { src: "/badminton/app-icon/192", sizes: "192x192", type: "image/png" },
        {
          src: "/badminton/app-icon/512",
          sizes: "512x512",
          type: "image/png",
          purpose: "any maskable",
        },
      ],
    },
    {
      headers: {
        "Content-Type": "application/manifest+json",
        "Cache-Control": "public, max-age=3600",
      },
    },
  );
}
