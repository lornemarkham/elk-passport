import type { NightDay } from "./types";

/**
 * **Monday 2 November 2026, out of Coldstream — the places a day may use.**
 *
 * Every `atlasRef` was checked on 2026-11-01 against production Atlas (the
 * corpus `gohaveaday.com/go` serves, 5,469 candidates). What the page says
 * about a place — its picture, hours, prices — comes from Atlas when the page
 * renders. The lines here are ours: what you'd do there and why it suits
 * this day.
 *
 * Hours, as found. Atlas states Monday hours for three of these places:
 * Planet Bee (store, Mon–Fri 8:30 am–5:30 pm), Lincoln Lanes (noon–10 pm
 * daily) and BNA Brewing (Sun–Thu 4–10 pm; BNA's own site said the same on
 * 2026-11-01). Everything else has no published hours in Atlas, so its card
 * says so and the plan never leans on it as the only way to finish the day.
 *
 * The weather, as Environment Canada had it on the evening of 1 November for
 * Vernon: valley fog in the morning, sunny above it, clearing near noon, a
 * high of 8, cloud building in the evening. The page reads the live forecast
 * itself; this is only why the outdoor part sits in the middle of the day.
 *
 * Known Atlas defect: The Edge Restaurant's coordinates sit in Coldstream,
 * but it is at The Rise above Okanagan Lake, about 20 minutes away. `reach`
 * uses the real drive; the map leg will be wrong until Atlas fixes it.
 */
export const TOMORROW: NightDay = {
  on: "2026-11-02",
  townId: "coldstream",
  area: "Vernon, North Okanagan",
  latitude: 50.2245,
  longitude: -119.2505,
  timeZone: "America/Vancouver",
  options: [
    // ------------------------------------------------------------- START
    {
      atlasRef: "6bcd8187-521f-4d33-a6e8-c882a20801b6",
      title: "Planet Bee Honey Farm",
      phase: "start",
      moods: ["playful", "romantic", "cozy"],
      line: "Find the queen in the glass hive, then taste honey and mead at the Honeymoon Meadery.",
      why: "A sweet, slightly ridiculous start, ten minutes from home. And yes, the meadery really is called Honeymoon.",
      minutes: 45,
      cost: 0,
      reach: 12,
      opens: 8 * 60 + 30,
      closes: 17 * 60 + 30,
      hoursSource:
        "Atlas: Planet Bee's published store hours, Mon–Fri 8:30 am–5:30 pm",
    },
    {
      atlasRef: "35d1b3b5-2d12-44bd-b91c-e114ff9fe7ac",
      title: "Allan Brooks Nature Centre",
      phase: "start",
      moods: ["adventurous", "romantic"],
      line: "Walk the grassland trail up top for a 360° view of the valley.",
      why: "If the valley is still foggy, this ridge is the quickest way to see whether you're above it.",
      minutes: 45,
      cost: 0,
      reach: 10,
      daylight: true,
      caution:
        "Atlas has no hours for the indoor centre and it may be closed for the season. The trail is outdoors.",
    },
    // ----------------------------------------------------------- EXPLORE
    {
      atlasRef: "d3c70f99-3412-46d2-87f8-45e4854b7d48",
      title: "Kalamalka Lake Park",
      phase: "explore",
      moods: ["adventurous", "romantic"],
      line: "Hike in to Cosens Bay and up to Rattlesnake Point. Then, if you dare, a very cold dip in Kal Lake.",
      why: "The colour of that water in November light is the photo of the day. The plunge is the story you'll tell.",
      minutes: 120,
      cost: 0,
      reach: 12,
      daylight: true,
      coldWater: true,
      caution:
        "Cold water: go in together, never alone, out in a minute or two, warm clothes waiting. Skip it if either of you has a heart condition.",
    },
    {
      atlasRef: "9340aa8a-cdfa-41e3-874a-9f0da31b5d35",
      title: "Ellison Park",
      phase: "explore",
      moods: ["romantic", "cozy"],
      line: "A slow walk along the Okanagan Lake shore and the bluffs, with nobody else around.",
      why: "Gentler than the Kal Lake hike and quieter in November. Good for walking and talking.",
      minutes: 90,
      cost: 0,
      reach: 25,
      daylight: true,
    },
    {
      atlasRef: "6931f16a-d8d9-4707-8780-86ba87ed5941",
      title: "Kal Beach",
      phase: "explore",
      moods: ["playful", "adventurous"],
      line: "The quick version: run into Kalamalka Lake, scream, run out.",
      why: "All of the cold plunge in half the time, two minutes from Coldstream.",
      minutes: 45,
      cost: 0,
      reach: 5,
      daylight: true,
      coldWater: true,
      caution:
        "Cold water: go in together, never alone, out in a minute or two, warm clothes waiting.",
    },
    // -------------------------------------------------------- EXPERIENCE
    {
      atlasRef: "ca78af3f-d181-4fd0-9c38-f5c5253ce44a",
      title: "Okanagan Spirits Craft Distillery",
      phase: "experience",
      moods: ["playful", "romantic"],
      line: "Three craft spirits each at the tasting bar. Argue about which is best.",
      why: "Atlas lists the tasting at $5. A warm, unexpected stop after cold water.",
      minutes: 45,
      cost: 1,
      reach: 12,
      drinks: true,
      caution: "Atlas has no hours for the tasting bar. Check before you go.",
    },
    {
      atlasRef: "c47bbed8-6f58-42e9-80b5-71d813023138",
      title: "Cotton's Chocolates",
      phase: "experience",
      moods: ["cozy", "romantic"],
      line: "Something chocolate to warm up with, and a box for later.",
      why: "The hot-chocolate stop you put on your list, downtown, five minutes from everything.",
      minutes: 30,
      cost: 1,
      reach: 10,
      caution: "Atlas has no hours for Cotton's. Check before you go.",
    },
    {
      atlasRef: "c34a9f17-56a0-45f0-afe7-2705465c7318",
      title: "Lincoln Lanes Bowling",
      phase: "experience",
      moods: ["playful"],
      line: "One game. Loser picks dinner. Winner is insufferable.",
      why: "Open all afternoon and evening, rain or shine. Silly in the best way.",
      minutes: 60,
      cost: 1,
      reach: 10,
      opens: 12 * 60,
      closes: 22 * 60,
      hoursSource: "Atlas: Lincoln Lanes' published hours, noon–10 pm daily",
    },
    // ------------------------------------------------------------ UNWIND
    {
      atlasRef: "77938aa1-3580-40f9-9072-f67295c8d052",
      title: "The Edge Restaurant",
      phase: "unwind",
      moods: ["romantic", "cozy"],
      line: "Dinner 1,000 feet above Okanagan Lake while the light goes.",
      why: "Atlas lists the view, a seasonal menu built producer by producer, and a zero-proof menu. It's the dressed-up finish.",
      minutes: 105,
      cost: 3,
      reach: 20,
      caution:
        "Atlas has no hours for The Edge, and a resort restaurant may keep shorter hours in November. Book or call first. If it's closed, swap in BNA.",
    },
    {
      atlasRef: "0ff70057-6723-47bb-8f05-2c6dec38dead",
      title: "BNA Brewing",
      phase: "unwind",
      moods: ["playful", "cozy"],
      line: "Pints, food, and the arcade machines at the back. Bocce if you're feeling competitive.",
      why: "Open Monday from 4 pm, so it's the finish that's sure to be open.",
      minutes: 90,
      cost: 2,
      reach: 10,
      opens: 16 * 60,
      closes: 22 * 60,
      hoursSource:
        "Atlas: BNA's published hours, Sun–Thu 4–10 pm (BNA's own site said the same on 1 Nov)",
      drinks: true,
    },
    {
      atlasRef: "58941d4a-a802-45f7-9cd1-5d4076637b03",
      title: "Eatology",
      phase: "unwind",
      moods: ["cozy", "romantic"],
      line: "A cozy dinner downtown, no dressing up required.",
      why: "Close to home, so the evening can stay slow.",
      minutes: 90,
      cost: 2,
      reach: 10,
      caution: "Atlas has no hours for Eatology. Check before you go.",
    },
  ],
  finale: {
    title: "Fire, marshmallows & whatever's left of the stars",
    line: "Home, a fire, two chairs, a blanket. Toast something. Name the best moment of the day.",
    caution:
      "Check the current fire restrictions before you light anything. Cloud is forecast to build in the evening, so the stars aren't promised.",
  },
};
