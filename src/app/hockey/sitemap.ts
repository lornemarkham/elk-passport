import type { MetadataRoute } from "next";
import { NHL_TEAMS } from "@/domain/hockey/fans";
import { teamSlug } from "@/domain/hockey/league";
import { hockeyUrl } from "@/domain/hockey/site";

/**
 * `/hockey/sitemap.xml`: the public hockey pages, and nothing behind them.
 * Nights, invitations and My Hockey Nights are private and never listed.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: hockeyUrl(), changeFrequency: "hourly", priority: 1 },
    { url: hockeyUrl("/games"), changeFrequency: "hourly", priority: 0.9 },
    { url: hockeyUrl("/standings"), changeFrequency: "daily", priority: 0.8 },
    { url: hockeyUrl("/teams"), changeFrequency: "weekly", priority: 0.7 },
    ...NHL_TEAMS.map((t) => ({
      url: hockeyUrl(`/teams/${teamSlug(t)}`),
      changeFrequency: "daily" as const,
      priority: 0.6,
    })),
  ];
}
