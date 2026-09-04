import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { createEventStore, getDatabaseUrl, getEventStore } from "./store.mjs";
import { createEventHandler } from "./handler.mjs";

function lineup() {
  return {
    schemaVersion: 1, title: "Club tennis", format: { type: "timed", gamesToWin: 4, minutesPerRound: 20 }, lockedPairs: [],
    players: Array.from({ length: 8 }, (_, i) => ({ id: `p${i}`, name: `Player ${i}`, arrival: "start" })),
    rounds: [{ number: 1, time: "9:00 AM", matches: [
      { id: "r1-m1", court: "Court 1", type: "Doubles", pairA: ["p0", "p1"], pairB: ["p2", "p3"] },
      { id: "r1-m2", court: "Court 2", type: "Doubles", pairA: ["p4", "p5"], pairB: ["p6", "p7"] },
    ], sitOuts: [], notArrived: [], waitingForPartner: [] }],
  };
}
const score = (a, b, status = "completed") => ({ status, scores: [{ a, b, kind: "games" }] });
let database, directory, store, handle;
function adapter(db) {
  return {
    query: async (query, values) => (await db.query(query, values)).rows,
    transaction: (statements) => db.transaction(async (tx) => {
      const results = [];
      for (const [query, values] of statements) results.push((await tx.query(query, values)).rows);
      return results;
    }),
  };
}
before(async () => {
  directory = await mkdtemp(join(tmpdir(), "tennis-results-"));
  database = new PGlite(directory);
  store = createEventStore(adapter(database));
  handle = createEventHandler(() => store, async (request) => request.headers.get("x-test-user"));
});
after(async () => { await database.close(); await rm(directory, { recursive: true, force: true }); });

async function call(method, query = "", body, headers = {}) {
  const response = await handle(new Request(`https://tennis.example/api/events${query}`, { method, headers: { "Content-Type": "application/json", "X-Test-User": "organizer-one", ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }));
  return { status: response.status, body: await response.json(), headers: response.headers };
}

test("publishing requires an organizer account and My Events is private to its owner", async () => {
  const anonymous = createEventHandler(() => store, async () => null);
  const id = randomUUID();
  const publishRequest = new Request("https://tennis.example/api/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, snapshot: lineup() }),
  });
  assert.equal((await anonymous(publishRequest)).status, 401);
  assert.equal((await anonymous(new Request("https://tennis.example/api/events?mine=1"))).status, 401);

  await publish();
  const mine = await call("GET", "?mine=1");
  assert.equal(mine.status, 200);
  assert.ok(mine.body.events.some((event) => event.title === "Club tennis" && event.players === 8 && event.matches === 2));

  const someoneElse = await call("GET", "?mine=1", undefined, { "X-Test-User": "organizer-two" });
  assert.equal(someoneElse.status, 200);
  assert.deepEqual(someoneElse.body.events, []);
});
async function publish(snapshot = lineup()) {
  const id = randomUUID();
  const response = await call("POST", "", { id, snapshot });
  assert.equal(response.status, 201, JSON.stringify(response.body));
  return id;
}

test("anyone with the link can load the immutable lineup and save a result without an account", async () => {
  const snapshot = lineup();
  snapshot.players[0].name = "O'Neil; DROP TABLE tennis_events; --";
  const id = await publish(snapshot);
  const saved = await call("PUT", `?id=${id}&match=r1-m1`, { version: 0, result: score(4, 2) });
  assert.equal(saved.status, 200);
  assert.equal(saved.body.result.version, 1);
  const otherPhone = await call("GET", `?id=${id}`);
  assert.equal(otherPhone.body.results["r1-m1"].scores[0].a, 4);
  assert.deepEqual(otherPhone.body.snapshot.players, snapshot.players);
  assert.equal(otherPhone.headers.get("cache-control"), "private, no-store");
  assert.equal(otherPhone.headers.get("x-robots-tag"), "noindex, nofollow");
  assert.equal((await call("POST", "", { id, snapshot })).status, 201, "a retried publication returns the same event");
  snapshot.title = "Changed lineup";
  assert.equal((await call("POST", "", { id, snapshot })).status, 409);
  assert.equal((await call("GET", `?id=${id}`)).body.snapshot.title, "Club tennis");
});

test("concurrent saves to one match preserve one winner and return a conflict for the other", async () => {
  const id = await publish();
  const responses = await Promise.all([
    call("PUT", `?id=${id}&match=r1-m1`, { version: 0, result: score(4, 2) }),
    call("PUT", `?id=${id}&match=r1-m1`, { version: 0, result: score(2, 4) }),
  ]);
  assert.deepEqual(responses.map((r) => r.status).sort(), [200, 409]);
  const conflict = responses.find((r) => r.status === 409);
  assert.equal(conflict.body.current.version, 1);
  const corrected = await call("PUT", `?id=${id}&match=r1-m1`, { version: 1, result: score(3, 3) });
  assert.equal(corrected.body.result.version, 2);
  assert.equal((await call("PUT", `?id=${id}&match=r1-m1`, { version: 1, result: score(9, 1) })).status, 409);
  assert.equal((await call("GET", `?id=${id}`)).body.results["r1-m1"].scores[0].a, 3);
});

test("simultaneous saves on different courts both persist", async () => {
  const id = await publish();
  const responses = await Promise.all([1, 2].map((court) => call("PUT", `?id=${id}&match=r1-m${court}`, { version: 0, result: score(court, 0, "in_progress") })));
  assert.ok(responses.every((r) => r.status === 200));
  assert.equal(Object.keys((await call("GET", `?id=${id}`)).body.results).length, 2);
});

test("clearing preserves the revision so an old phone cannot resurrect a result", async () => {
  const id = await publish();
  await call("PUT", `?id=${id}&match=r1-m1`, { version: 0, result: score(4, 1) });
  const cleared = await call("PUT", `?id=${id}&match=r1-m1`, { version: 1, result: { status: "scheduled", scores: [] } });
  assert.equal(cleared.body.result.version, 2);
  assert.deepEqual(cleared.body.result.scores, []);
  assert.equal((await call("PUT", `?id=${id}&match=r1-m1`, { version: 0, result: score(4, 1) })).status, 409);
});

test("API rejects malformed lineups, invalid scores, missing versions, and unknown matches", async () => {
  const snapshot = lineup();
  snapshot.format.type = "games";
  const id = await publish(snapshot);
  for (const result of [score(3, 2), score(4, 4), score(5, 1), score(-1, 4), score(4.5, 2)]) assert.equal((await call("PUT", `?id=${id}&match=r1-m1`, { version: 0, result })).status, 400);
  assert.equal((await call("PUT", `?id=${id}&match=r1-m1`, { result: score(4, 2) })).status, 400);
  assert.equal((await call("PUT", `?id=${id}&match=unknown`, { version: 0, result: score(4, 2) })).status, 404);
  snapshot.rounds[0].matches[0].pairA[0] = "unknown";
  assert.equal((await call("POST", "", { id: randomUUID(), snapshot })).status, 400);
  assert.equal((await call("GET", `?id=${randomUUID()}`)).status, 404);
  assert.equal((await call("GET")).status, 404, "there is no endpoint for listing events");
  assert.equal((await call("POST", "", { id: randomUUID(), snapshot: lineup() }, { Origin: "https://another.example" })).status, 403);
  assert.equal((await call("POST", "", { oversized: "x".repeat(270000) })).status, 400);
  assert.equal((await call("POST", "", { id: randomUUID(), snapshot: lineup() }, { "Content-Type": "text/plain" })).status, 400);
});

test("events and scores survive closing and reopening the PostgreSQL database", async () => {
  const id = await publish();
  await call("PUT", `?id=${id}&match=r1-m1`, { version: 0, result: score(5, 4) });
  await database.close();
  database = new PGlite(directory);
  store = createEventStore(adapter(database));
  const loaded = await call("GET", `?id=${id}`);
  assert.equal(loaded.status, 200);
  assert.equal(loaded.body.results["r1-m1"].scores[0].a, 5);
});

test("missing database configuration returns a truthful unavailable response", async () => {
  const original = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  try {
    const unavailable = createEventHandler(getEventStore);
    const response = await unavailable(new Request(`https://tennis.example/api/events?id=${randomUUID()}`));
    assert.equal(response.status, 503);
    assert.match((await response.json()).error, /connect the event database/);
  } finally { if (original !== undefined) process.env.DATABASE_URL = original; }
});

test("preview deployments never fall back to the production database", () => {
  const production = "postgresql://production.example/tennis";
  const preview = "postgresql://preview.example/tennis";

  assert.equal(getDatabaseUrl({ DATABASE_URL: production }), production);
  assert.equal(getDatabaseUrl({
    VERCEL_ENV: "preview",
    VERCEL_GIT_COMMIT_REF: "another-branch",
    DATABASE_URL: production,
    PAID_BETA_DATABASE_URL: preview,
  }), preview);
  assert.equal(getDatabaseUrl({
    VERCEL_ENV: "preview",
    VERCEL_GIT_COMMIT_REF: "paid-beta",
    DATABASE_URL: production,
    PAID_BETA_DATABASE_URL: preview,
  }), preview);
  assert.equal(getDatabaseUrl({
    VERCEL_ENV: "preview",
    DATABASE_URL: production,
    PAID_BETA_DATABASE_URL_DATABASE_URL: preview,
  }), preview);
  assert.equal(getDatabaseUrl({
    VERCEL_ENV: "preview",
    VERCEL_GIT_COMMIT_REF: "paid-beta",
    DATABASE_URL: production,
  }), undefined);
});
