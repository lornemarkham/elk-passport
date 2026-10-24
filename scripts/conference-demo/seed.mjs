#!/usr/bin/env node
/**
 * **A realistic conference, entered the way people would enter it.**
 *
 * Every row goes through the public API as the person it belongs to: the
 * organiser creates the conference and publishes the agenda, colleagues join
 * by link, choose their names, type their flights from their bookings, make
 * a dinner plan, suggest real Atlas restaurants, vote, and talk. Nothing is
 * written to a store directly, so nothing here can be something the product
 * wouldn't let a person do.
 *
 * Needs a server with conferences open on the memory store and guests
 * allowed to organise (see scripts/conference-demo/README.md):
 *
 *   node scripts/conference-demo/seed.mjs http://localhost:3170 [full|solo]
 *
 * Prints the conference id and a cookie per person (JSON) for screenshots.
 * `solo` makes the empty state: one organiser, nothing else.
 */

const [base = "http://localhost:3170", mode = "full"] = process.argv.slice(2);

class Person {
  constructor(label) {
    this.label = label;
    this.cookie = "";
  }
  async call(method, path, body) {
    const r = await fetch(base + path, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(this.cookie ? { Cookie: this.cookie } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: "manual",
    });
    const set = r.headers.getSetCookie?.() ?? [];
    for (const c of set)
      if (c.startsWith("passport_guest=")) this.cookie = c.split(";")[0];
    const json = await r.json().catch(() => ({}));
    if (!r.ok || json.ok === false)
      throw new Error(
        `${this.label} ${method} ${path} → ${r.status} ${JSON.stringify(json)}`,
      );
    return json;
  }
}

// Day one is tomorrow in Vancouver, unless SEED_DAY1 says otherwise (the
// screenshots use 2026-10-24 against a server told CONFERENCE_NOW).
const shift = (ymd, days) =>
  new Date(Date.parse(`${ymd}T12:00:00Z`) + days * 86_400_000)
    .toISOString()
    .slice(0, 10);
const todayInVancouver = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Vancouver",
}).format(new Date());
const DAY1 = process.env.SEED_DAY1 ?? shift(todayInVancouver, 1);
const DAY0 = shift(DAY1, -1);
const DAY2 = shift(DAY1, 1);
const DAY3 = shift(DAY1, 2);

const details = {
  name: "Sycle Vancouver 2026",
  kind: "conference",
  tagline: "Three days downtown: strategy, customers, and the team.",
  welcome:
    "Welcome to Vancouver. Everything you need for the next three days is here — the agenda, who's arriving when, and the best of the city a short walk from the venue.",
  place: { label: "Vancouver", townId: "vancouver" },
  venue: {
    name: "JW Marriott Parq Vancouver",
    address: "39 Smithe Street, Vancouver",
  },
  timeZone: "America/Vancouver",
  startsOn: DAY1,
  endsOn: DAY3,
  branding: { accent: "#2f5d50" },
  modules: [
    "discover",
    "arrivals",
    "schedule",
    "community",
    "plans",
    "people",
    "memories",
  ],
};

const agenda = [
  [
    DAY1,
    "08:00",
    "09:00",
    "Registration & breakfast",
    "Level 1 foyer",
    "Badges at the east doors.",
  ],
  [DAY1, "09:00", "10:15", "Opening keynote", "Ballroom A, Level 2", null],
  [DAY1, "10:15", "10:45", "Coffee break", "Level 2 terrace", null],
  [
    DAY1,
    "10:45",
    "12:00",
    "Product strategy 2027",
    "Ballroom A, Level 2",
    null,
  ],
  [DAY1, "12:00", "13:15", "Lunch", "Level 1 foyer", null],
  [
    DAY1,
    "13:15",
    "15:00",
    "Breakout sessions",
    "Rooms 109–118",
    "Pick your track on the day.",
  ],
  [DAY1, "15:30", "16:45", "Customer panel", "Ballroom A, Level 2", null],
  [DAY1, "18:00", "20:00", "Welcome reception", "Waterfront terrace", null],
  [DAY2, "08:30", "09:00", "Coffee", "Level 2 terrace", null],
  [DAY2, "09:00", "10:30", "Engineering leadership forum", "Room 211", null],
  [DAY2, "10:45", "12:00", "Roadmap working sessions", "Rooms 109–118", null],
  [DAY2, "12:00", "13:00", "Lunch", "Level 1 foyer", null],
  [
    DAY2,
    "13:00",
    "16:00",
    "Customer visits",
    "Meet at the east doors",
    "Groups leave at 13:10.",
  ],
  [
    DAY2,
    "19:30",
    "22:00",
    "Staff hockey game",
    "Rogers Arena",
    "Jerseys handed out at the door.",
    true,
  ],
  [
    DAY3,
    "09:00",
    "10:30",
    "Year ahead: all hands",
    "Ballroom A, Level 2",
    null,
  ],
  [
    DAY3,
    "10:30",
    "11:30",
    "Closing remarks & farewell coffee",
    "Level 2 terrace",
    null,
  ],
].map(([day, start, end, title, where, note, featured]) => ({
  day,
  start,
  end,
  title,
  where,
  ...(note ? { note } : {}),
  ...(featured ? { featured: true } : {}),
}));

const org = new Person("Maya");

if (mode === "solo") {
  // The bare minimum the create form accepts: a name (literally "test"), a
  // town and a day. No venue, no tagline, no agenda, nobody else, no name
  // chosen. The overview must still look finished and say what to do next.
  const { conference } = await org.call("POST", "/api/conferences", {
    name: "test",
    place: { label: "Vancouver", townId: "vancouver" },
    timeZone: "America/Vancouver",
    startsOn: DAY1,
    modules: [
      "discover",
      "arrivals",
      "schedule",
      "plans",
      "people",
      "memories",
    ],
  });
  console.log(
    JSON.stringify({ id: conference.id, people: { organiser: org.cookie } }),
  );
  process.exit(0);
}

const { conference } = await org.call("POST", "/api/conferences", details);
const id = conference.id;
await org.call("PATCH", `/api/conferences/${id}/me`, {
  displayName: "Maya Chen",
  visibility: "members",
});

await org.call("PATCH", `/api/conferences/${id}`, { ...details, agenda });
const { token } = await org.call("POST", `/api/conferences/${id}/invites`, {});

const join = async (label, name) => {
  const p = new Person(label);
  await p.call("POST", "/api/conferences/join", { token });
  if (name)
    await p.call("PATCH", `/api/conferences/${id}/me`, {
      displayName: name,
      visibility: "members",
    });
  return p;
};
const daniel = await join("Daniel", "Daniel Okafor");
const priya = await join("Priya", "Priya Raman");
const tom = await join("Tom", "Tom Becker");
const quiet = await join("Quiet", null); // in the conference, not listed

// Flights, typed from their bookings. Times are scheduled, never claimed as landed.
const fly = (p, flight, date, from, lands) =>
  p.call("PUT", `/api/conferences/${id}/arrivals/me`, {
    flight,
    date,
    from,
    lands,
    shared: true,
  });
await fly(priya, "WS3311", DAY0, "YYC", `${DAY0}T13:20`);
await fly(daniel, "AC116", DAY0, "YYZ", `${DAY0}T16:05`);
await fly(tom, "UA1580", DAY0, "SFO", `${DAY0}T21:10`);
await fly(org, "AC123", DAY0, "YUL", `${DAY0}T11:45`);

// Real places near the venue, from Atlas via the conference's own Explore.
const { explore } = await org.call("GET", `/api/conferences/${id}/explore`);
// Photographed first; any restaurant Explore offers if Atlas has few photos.
const restaurants = [
  ...explore.shelves.restaurants.filter((p) => p.photo),
  ...explore.shelves.restaurants.filter((p) => !p.photo),
];
const pick = restaurants.slice(0, 3);

// The team dinner: suggested by the organiser, places suggested by others,
// voted, chosen — and the chosen place becomes where the group meets.
const plan = (p, body) => p.call("POST", `/api/conferences/${id}/plans`, body);
await plan(org, {
  action: "create",
  plan: {
    kind: "dinner",
    title: "Team dinner after the customer panel",
    description: "Walk over together from the venue. Table for whoever's in.",
    days: [DAY1],
    time: "20:15",
    audience: "everyone",
  },
});
let { board } = await org.call("GET", `/api/conferences/${id}/plans`);
const dinner = board.plans.find((x) => x.kind === "dinner");
if (pick.length >= 2) {
  await plan(daniel, {
    action: "suggest",
    planId: dinner.id,
    placeId: pick[0].id,
  });
  await plan(priya, {
    action: "suggest",
    planId: dinner.id,
    placeId: pick[1].id,
  });
  ({ board } = await org.call("GET", `/api/conferences/${id}/plans`));
  const opts = board.plans.find((x) => x.id === dinner.id).options;
  const first = opts.find((o) => o.place.id === pick[0].id);
  const second = opts.find((o) => o.place.id === pick[1].id);
  await plan(daniel, { action: "vote", planId: dinner.id, optionId: first.id });
  await plan(tom, { action: "vote", planId: dinner.id, optionId: first.id });
  await plan(priya, { action: "vote", planId: dinner.id, optionId: second.id });
  await plan(org, { action: "choose", planId: dinner.id, optionId: first.id });
}
const occ = board.plans.find((x) => x.id === dinner.id).occurrences[0].id;
for (const [p, a] of [
  [org, "in"],
  [daniel, "in"],
  [tom, "in"],
  [priya, "maybe"],
])
  await plan(p, {
    action: "answer",
    planId: dinner.id,
    occurrenceId: occ,
    answer: a,
  });

// A morning walk on the second and third days, met in the hotel lobby.
await plan(priya, {
  action: "create",
  plan: {
    kind: "morning-walk",
    title: "Seawall walk before the sessions",
    description: "Thirty-five minutes along Coal Harbour and back.",
    days: [DAY2, DAY3],
    time: "07:15",
    meeting: "Pan Pacific hotel lobby",
    audience: "everyone",
  },
});

// A few words in the group's room.
const say = (p, body) =>
  p.call("POST", `/api/conferences/${id}/chat`, { action: "say", body });
await say(org, "Welcome, everyone — badges are at the east doors from 8.");
await say(
  daniel,
  "On AC116, landing 4:05. Anyone around then want to share a cab in?",
);
await say(
  priya,
  "Seawall walk on day two, 7:15 from the Pan Pacific lobby, if you're up early.",
);

console.log(
  JSON.stringify({
    id,
    dinner: dinner.id,
    places: pick.slice(0, 2).map((p) => p.name),
    people: {
      organiser: org.cookie,
      daniel: daniel.cookie,
      priya: priya.cookie,
      tom: tom.cookie,
      quiet: quiet.cookie,
    },
  }),
);
