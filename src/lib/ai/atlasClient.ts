import "server-only";
import { ATLAS_BASE_URL, atlasAuthHeaders } from "@/lib/data/atlasAuth";
import {
  type PlanInput,
  type Recommendation,
  recommendationSchema,
} from "@/lib/schemas";

// Only this file knows Atlas exists — the API route and every page still
// just deal in Recommendation, exactly as before.
//
// The base URL and the service identity come from `atlasAuth` like every other
// Atlas caller's. The default port here was 4200 while everything else used
// 3000, which meant this fallback recommender had quietly been pointing at
// nothing for as long as the two disagreed; `atlasAuth` ends that too.

interface AtlasEntity {
  kind: string;
  id: string;
  name: string;
  description: string;
}

function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

async function fetchAtlasEntities(path: string): Promise<AtlasEntity[]> {
  const res = await fetch(`${ATLAS_BASE_URL}${path}`, {
    headers: atlasAuthHeaders(),
  });
  if (!res.ok) {
    throw new Error(
      `Atlas API request to ${path} failed with status ${res.status}`,
    );
  }
  return res.json();
}

async function pickPlace(location: string): Promise<AtlasEntity> {
  if (location) {
    const results = await fetchAtlasEntities(
      `/search?q=${encodeURIComponent(location)}`,
    );
    const match = results.find((e) => e.kind === "Place");
    if (match) return match;
  }
  const places = await fetchAtlasEntities("/places");
  if (places.length === 0) {
    throw new Error("Atlas has no Place entities to recommend from.");
  }
  return places[Math.floor(Math.random() * places.length)];
}

async function pickActivity(): Promise<AtlasEntity | undefined> {
  const activities = await fetchAtlasEntities("/activities");
  return activities.length > 0
    ? activities[Math.floor(Math.random() * activities.length)]
    : undefined;
}

/**
 * Fallback recommender used when no OPENAI_API_KEY is configured. This is a
 * deliberately temporary adapter, not a real recommendation engine: it asks
 * the real Atlas API for one Place (preferring a /search match against the
 * stated location, falling back to /places) and one Activity if any exist,
 * then packages them into the same Recommendation shape this function has
 * always returned. See /docs/architecture.md, "Recommendation flow", and
 * elk-atlas's own docs for what the API actually exposes.
 */
export async function getLocalRecommendation(
  input: PlanInput,
): Promise<Recommendation> {
  const location = input.constraints.location.trim();
  const place = await pickPlace(location);
  const activity = await pickActivity();

  const blocks = [
    {
      time: "Today",
      title: truncate(place.name, 80),
      description: truncate(place.description || `Visit ${place.name}.`, 280),
    },
    activity
      ? {
          time: "While you're there",
          title: truncate(activity.name, 80),
          description: truncate(
            activity.description || `Try ${activity.name}.`,
            280,
          ),
        }
      : {
          time: "Wrap up",
          title: "Take it all in",
          description: truncate(
            `Enjoy the rest of your time at ${place.name}.`,
            280,
          ),
        },
  ];

  return recommendationSchema.parse({
    title: truncate(place.name, 80),
    tagline: truncate(
      `A real Atlas pick${location ? ` near ${location}` : ""}.`,
      140,
    ),
    blocks,
  });
}
