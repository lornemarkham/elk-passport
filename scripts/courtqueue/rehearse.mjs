#!/usr/bin/env node
/**
 * CourtQueue rehearsal: a compressed badminton night against a running server.
 *
 *   node scripts/courtqueue/rehearse.mjs http://localhost:3188 [games]
 *
 * 25 players register (one won't come), 24 check in and tap PLAY at the same
 * moment, and 24 phones poll every two seconds while games are started,
 * finished (seconds, not minutes), scored and confirmed. Pairs of players tap
 * START and FINISH at the same instant on purpose. After every round the
 * script checks what the server says: never two games on a court, never a
 * player in two places, every duration exactly finish − start.
 *
 * Needs a server whose organizer code you know (COURTQUEUE_ORGANIZER_CODE,
 * or "organizer" on the memory store). Writes nothing but CourtQueue data.
 */

const BASE = process.argv[2] ?? "http://localhost:3188";
const GAMES = Number(process.argv[3] ?? 18);
const CODE = process.env.COURTQUEUE_ORGANIZER_CODE ?? "organizer";
const RUN = Math.random().toString(36).slice(2, 6);
const SKILLS = [
  5, 5, 5, 5, 1, 2, 1, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 2, 3, 4, 3, 5, 3,
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const stats = { requests: 0, errors: 0, conflicts: 0, latencies: [] };

function client(name) {
  let cookie = "";
  const call = async (method, path, body) => {
    const t = Date.now();
    const res = await fetch(BASE + path, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(cookie ? { cookie } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    stats.requests++;
    stats.latencies.push(Date.now() - t);
    const set = res.headers.get("set-cookie");
    if (set) cookie = set.split(";")[0];
    const json = await res.json().catch(() => ({}));
    if (res.status >= 500) stats.errors++;
    if (res.status === 409) stats.conflicts++;
    return { status: res.status, json };
  };
  return { name, call, id: null };
}

async function main() {
  const org = client(`Organizer ${RUN}`);
  await org.call("POST", "/api/badminton/me", {
    action: "register",
    name: org.name,
    pin: "9999",
    skill: 3,
  });
  const claim = await org.call("POST", "/api/badminton/me", {
    action: "organizer",
    code: CODE,
  });
  if (claim.status !== 200)
    throw new Error(`organizer code refused: ${JSON.stringify(claim.json)}`);
  const players = SKILLS.map((_, i) =>
    client(`P${String(i + 1).padStart(2, "0")} ${RUN}`),
  );
  // Everybody registers at the same moment, too.
  const signups = await Promise.all(
    players.map((p, i) =>
      p.call("POST", "/api/badminton/me", {
        action: "register",
        name: p.name,
        pin: "1234",
        skill: SKILLS[i],
      }),
    ),
  );
  const failed = signups.filter((r) => r.status !== 200);
  if (failed.length)
    throw new Error(
      `${failed.length} sign-ups failed: ${JSON.stringify(failed[0].json)}`,
    );
  // Today's session on the server's clock (a club night: sign-up is only
  // possible on the day, from 8:00 am), opened for check-in.
  const serverNow = (await org.call("GET", "/api/badminton/live")).json.now;
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Etc/GMT+7",
  }).format(new Date(serverNow));
  await org.call("POST", "/api/badminton/act", {
    scope: "sessions",
    dates: [date],
  });
  await org.call("POST", "/api/badminton/act", {
    scope: "session",
    sessionId: date,
    cmd: { type: "go-live" },
  });
  const act = (p, cmd) =>
    p.call("POST", "/api/badminton/act", {
      scope: "session",
      sessionId: date,
      cmd,
    });
  await Promise.all(players.map((p) => act(p, { type: "register" })));
  for (const p of players)
    p.id = (await p.call("GET", "/api/badminton/live")).json.me.id;

  const here = players.slice(0, 24);
  await Promise.all(here.map((p) => act(p, { type: "check-in" })));
  // Everybody taps PLAY at the same moment.
  await Promise.all(here.map((p) => act(p, { type: "play" })));

  const problems = [];
  const check = async (label) => {
    const v = (await org.call("GET", "/api/badminton/live")).json;
    const o = v.organizer;
    const courts = new Map();
    const seen = new Map();
    for (const g of o.games) {
      if (g.status === "called" || g.status === "playing") {
        if (courts.has(g.court))
          problems.push(`${label}: two games on court ${g.court}`);
        courts.set(g.court, g.id);
        for (const s of g.slots)
          if (s) {
            if (seen.has(s.id))
              problems.push(`${label}: ${s.name} in two games`);
            seen.set(s.id, g.id);
          }
        if (g.court === 3 && g.slots.some((s) => s && s.skill <= 2))
          problems.push(`${label}: beginner on the expert court`);
      }
      if (
        g.status === "finished" &&
        g.minutes !==
          Math.max(0, Math.round((g.finishedAt - g.startedAt) / 60000))
      )
        problems.push(`${label}: duration mismatch on ${g.id}`);
    }
    for (const q of v.night.queue)
      if (seen.has(q.person.id))
        problems.push(`${label}: ${q.person.name} queued while in a game`);
    return v;
  };

  let v = await check("after PLAY");
  const first = {
    called: v.night.courts.filter((c) => c.game).length,
    queued: v.night.queue.length,
  };

  // 24 phones polling every two seconds for the rest of the night.
  let polling = true;
  const pollers = here.map(async (p, i) => {
    await sleep(i * 80);
    let version = null;
    while (polling) {
      const r = await p.call(
        "GET",
        `/api/badminton/live${version ? `?v=${version}` : ""}`,
      );
      if (r.json.version) version = r.json.version;
      await sleep(2000);
    }
  });

  let finished = 0;
  let unassignedRefused = 0;
  let consistentRounds = 0;
  let doubleTaps = 0;
  const byId = new Map(players.map((p) => [p.id, p]));
  while (finished < GAMES) {
    v = await check(`round ${finished}`);
    const called = v.organizer.games.filter(
      (g) => g.status === "called" && g.slots.every(Boolean),
    );
    const playing = v.organizer.games.filter((g) => g.status === "playing");
    // Two players of the same game tap START at the same instant.
    await Promise.all(
      called.map((g) => {
        const [a, b] = [byId.get(g.slots[0].id), byId.get(g.slots[2].id)];
        doubleTaps++;
        return Promise.all([
          act(a, { type: "start", gameId: g.id }),
          act(b, { type: "start", gameId: g.id }),
        ]);
      }),
    );
    await sleep(1500);
    // Finish one playing game per round, again with two simultaneous taps.
    const g = playing.at(-1); // the longest-running game finishes first
    if (g) {
      const [a, b] = [byId.get(g.slots[1].id), byId.get(g.slots[3].id)];
      await Promise.all([
        act(a, {
          type: "finish",
          gameId: g.id,
          score: [21, 10 + (finished % 10)],
        }),
        act(b, { type: "finish", gameId: g.id }),
      ]);
      await act(byId.get(g.slots[2].id), { type: "confirm", gameId: g.id });
      finished++;
      // Nobody is put back in line for them: all four tap BACK IN THE QUEUE.
      const after = (await org.call("GET", "/api/badminton/live")).json;
      const requeued = after.night.queue.filter((q) =>
        g.slots.some((s) => s && s.id === q.person.id),
      );
      if (requeued.length)
        problems.push(`game ${g.id}: requeued without tapping`);
      await Promise.all(
        g.slots.map((s) => act(byId.get(s.id), { type: "play" })),
      );
    }
    // Someone not in a called game tries to start it: always refused.
    const open = v.organizer.games.find((x) => x.status === "called");
    if (open) {
      const outsider = here.find(
        (p) => !open.slots.some((s) => s && s.id === p.id),
      );
      const r = await act(outsider, { type: "start", gameId: open.id });
      if (r.status === 200) problems.push(`outsider started ${open.id}`);
      else unassignedRefused++;
    }
    // Every phone agrees on the courts and the line.
    const views = await Promise.all(
      here.slice(0, 8).map((p) => p.call("GET", "/api/badminton/live")),
    );
    const shape = (x) =>
      JSON.stringify({
        courts: x.json.night.courts.map((c) => [
          c.id,
          c.game?.id ?? null,
          c.game?.status ?? null,
          c.game?.slots.map((s) => s?.id ?? null) ?? null,
        ]),
        queue: x.json.night.queue.map((q) => q.person.id),
      });
    const shapes = new Set(views.map(shape));
    if (shapes.size > 1) {
      // A write may land between two reads; ask again once, together.
      const again = await Promise.all(
        here.slice(0, 8).map((p) => p.call("GET", "/api/badminton/live")),
      );
      if (new Set(again.map(shape)).size > 1)
        problems.push(`round ${finished}: phones disagree`);
      else consistentRounds++;
    } else consistentRounds++;
  }
  polling = false;
  await Promise.all(pollers);
  v = await check("end");

  // A beginner may never be assigned the expert court.
  const beginner = players.find((_, i) => SKILLS[i] === 1);
  const free3 = v.night.courts.find((c) => c.id === 3 && !c.game);
  let expertRefusal = "court busy, not tried";
  if (free3) {
    const r = await act(org, {
      type: "assign",
      court: 3,
      slots: [beginner.id, players[0].id, players[1].id, players[2].id],
    });
    expertRefusal = r.json.error ?? "NOT REFUSED";
  }

  const balance = v.organizer.roster.filter((r) => r.here).map((r) => r.games);
  const lat = [...stats.latencies].sort((a, b) => a - b);
  const report = {
    run: RUN,
    afterEveryoneTappedPlay: first,
    gamesFinished: v.organizer.games.filter((g) => g.status === "finished")
      .length,
    simultaneousStartPairs: doubleTaps,
    gamesPerPlayer: {
      fewest: Math.min(...balance),
      most: Math.max(...balance),
    },
    requests: stats.requests,
    serverErrors: stats.errors,
    refusals409: stats.conflicts,
    latencyMs: {
      p50: lat[Math.floor(lat.length / 2)],
      p95: lat[Math.floor(lat.length * 0.95)],
      max: lat.at(-1),
    },
    expertCourtBeginner: expertRefusal,
    unassignedStartsRefused: unassignedRefused,
    roundsAllPhonesAgreed: consistentRounds,
    problems,
  };
  console.log(JSON.stringify(report, null, 2));
  process.exit(problems.length || stats.errors ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
