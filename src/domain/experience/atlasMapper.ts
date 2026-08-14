import type { Place } from "@/lib/data/types";
import type { Experience } from "./types";

export function placeToExperience(place: Place): Experience {
  return {
    id: place.id,
    slug: place.name.toLowerCase().replaceAll(" ", "-"),
    title: place.name,
    shortDescription: place.description,
    description: place.description,
    tier: 3,
    heroMedia: place.imageUrl
      ? { type: "image", src: place.imageUrl }
      : undefined,
    moods: [],
    activities: [],
    seasons: ["summer"],
    timeOfDay: ["day"],
    weather: ["clear"],
    companions: ["solo", "friends"],
    energyLevel: 2,
    priceLevel: 0,
    duration: {
      minMinutes: 60,
      maxMinutes: 90,
    },
    familyFriendly: true,
    petFriendly: false,
    requiresReservation: false,
    location: {
      name: place.address ?? place.name,
      latitude: place.geometry?.coordinates?.[1],
      longitude: place.geometry?.coordinates?.[0],
    },
    isActive: true,
  };
}
