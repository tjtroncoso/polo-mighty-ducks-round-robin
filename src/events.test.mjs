import test from "node:test";
import assert from "node:assert/strict";
import { createSnapshot, validateSnapshot, validateResult, buildStandings, mergeResults, resultOutcome } from "./events.mjs";
import { generateSchedule, buildPlayersFromRows } from "./scheduler.mjs";

export function fixture(overrides = {}) {
  return {
    schemaVersion: 1,
    title: "Saturday tennis",
    format: { type: "timed", gamesToWin: 3, minutesPerRound: 20 },
    players: ["Alex", "Blair", "Casey", "Drew"].map((name, i) => ({ id: `p${i + 1}`, name, arrival: "start" })),
    lockedPairs: [],
    rounds: [
      { number: 1, time: "9:00 AM", matches: [{ id: "r1-m1", type: "Doubles", court: "Court 1", pairA: ["p1", "p2"], pairB: ["p3", "p4"] }], sitOuts: [], notArrived: [], waitingForPartner: [] },
      { number: 2, time: "9:20 AM", matches: [{ id: "r2-m1", type: "Doubles", court: "Court 1", pairA: ["p1", "p3"], pairB: ["p2", "p4"] }], sitOuts: [], notArrived: [], waitingForPartner: [] },
    ],
    ...overrides,
  };
}

const final = (a, b) => ({ status: "completed", scores: [{ a, b, kind: "games" }] });

test("published snapshots work with all generator modes, locks, late players, and formats", () => {
  for (const mode of ["doubles", "mixed", "singles"]) {
    for (const matchFormat of ["timed", "games", "set", "match"]) {
      const players = buildPlayersFromRows(Array.from({ length: 10 }, (_, i) => ({ id: `id-${i}`, name: `Player ${i}`, gender: i % 2 ? "female" : "male", isLate: i === 1, arrival: "9:30 AM" })), "9:00 AM");
      const lockedPairs = [["id-0", "id-1"]];
      const generated = generateSchedule({ playersData: players, startTime: "9:00 AM", courts: 3, rounds: 4, minutesPerRound: 20, matchFormat, mode, lockedPairs });
      assert.equal(generated.errors.length, 0);
      const snapshot = createSnapshot({ title: "", players, schedule: generated.schedule, matchFormat, lockedPairs });
      assert.equal(snapshot.title, "Tennis round robin");
      assert.equal(snapshot.rounds.length, 4);
      players[0].name = "Renamed later";
      lockedPairs[0][0] = "changed";
      generated.schedule[0].matches[0].court = "Changed later";
      assert.equal(snapshot.players[0].name, "Player 0");
      assert.equal(snapshot.lockedPairs[0][0], "id-0");
      assert.notEqual(snapshot.rounds[0].matches[0].court, "Changed later");
    }
  }
});

test("lineup validation rejects missing players, duplicate assignments, split locks, and excessive rounds", () => {
  const bad = fixture();
  bad.rounds[0].matches[0].pairB[0] = "p1";
  assert.throws(() => validateSnapshot(bad), /twice/);
  const missing = fixture();
  missing.rounds[0].matches[0].pairB[0] = "unknown";
  assert.throws(() => validateSnapshot(missing), /unknown/);
  assert.throws(() => validateSnapshot(fixture({ lockedPairs: [["p1", "p2"]] })), /split/);
  assert.throws(() => validateSnapshot(fixture({ rounds: Array(21).fill(fixture().rounds[0]) })), /1–20/);
});

test("timed results allow draws; first-to needs the chosen target and rejects invalid numbers", () => {
  const format = { type: "timed", gamesToWin: 4 };
  assert.equal(resultOutcome(validateResult(final(2, 2), format), format).winner, "draw");
  format.type = "games";
  assert.equal(validateResult(final(4, 3), format).status, "completed");
  for (const [a, b] of [[3, 1], [4, 4], [5, 3], [-1, 4], [4.5, 1], ["4", 1], [null, 1]]) assert.throws(() => validateResult(final(a, b), format));
  assert.equal(validateResult({ ...final(2, 1), status: "in_progress" }, format).status, "in_progress");
});

test("full sets reject unfinished scores and accept tiebreak or advantage finishes", () => {
  for (const [a, b] of [[6, 0], [4, 6], [7, 5], [6, 7], [10, 8]]) assert.equal(validateResult(final(a, b), { type: "set" }).status, "completed");
  for (const [a, b] of [[0, 0], [6, 5], [7, 7], [8, 5]]) assert.throws(() => validateResult(final(a, b), { type: "set" }));
});

test("full match winners use sets, and a deciding tiebreak does not inflate games", () => {
  const result = { status: "completed", scores: [{ a: 6, b: 4, kind: "games" }, { a: 4, b: 6, kind: "games" }, { a: 10, b: 8, kind: "tiebreak" }] };
  assert.deepEqual(resultOutcome(validateResult(result, { type: "match" }), { type: "match" }), { gamesA: 10, gamesB: 10, winner: "a" });
  assert.throws(() => validateResult({ ...result, scores: result.scores.slice(0, 2) }, { type: "match" }), /winner on sets/);
  const unnecessary = structuredClone(result);
  unnecessary.scores[1] = { a: 6, b: 4, kind: "games" };
  unnecessary.scores[2] = { a: 8, b: 10, kind: "tiebreak" };
  assert.throws(() => validateResult(unnecessary, { type: "match" }), /tied on sets/);
  for (const [a, b] of [[9, 7], [10, 9], [12, 8]]) {
    const invalid = structuredClone(result);
    invalid.scores[2] = { a, b, kind: "tiebreak" };
    assert.throws(() => validateResult(invalid, { type: "match" }));
  }
});

test("rotating doubles standings credit both partners and recalculate after corrections or clearing", () => {
  const snapshot = validateSnapshot(fixture());
  const scores = { "r1-m1": final(4, 2), "r2-m1": final(3, 3) };
  let rows = buildStandings(snapshot, scores);
  assert.equal(rows.find((row) => row.id === "p1").points, 3);
  assert.equal(rows.find((row) => row.id === "p2").points, 3);
  assert.equal(rows.find((row) => row.id === "p3").losses, 1);
  assert.equal(rows.find((row) => row.id === "p1").gamesFor, 7);
  scores["r1-m1"] = final(1, 4);
  assert.equal(buildStandings(snapshot, scores)[0].points, 3);
  scores["r1-m1"] = { status: "scheduled", scores: [] };
  rows = buildStandings(snapshot, scores);
  assert.ok(rows.every((row) => row.played === 1 && row.draws === 1 && row.gamesFor === 3));
  scores["r2-m1"].status = "in_progress";
  assert.ok(buildStandings(snapshot, scores).every((row) => row.played === 0));
});

test("locked teams have a separate table, and equal names stay distinct by player ID", () => {
  const input = fixture();
  input.rounds = input.rounds.slice(0, 1);
  input.lockedPairs = [["p1", "p2"], ["p3", "p4"]];
  input.players[1].name = "Alex";
  const snapshot = validateSnapshot(input);
  const result = { "r1-m1": final(4, 2) };
  assert.equal(buildStandings(snapshot, result).length, 4);
  const teams = buildStandings(snapshot, result, true);
  assert.equal(teams.length, 2);
  assert.equal(teams[0].name, "Alex / Alex");
  assert.equal(teams[0].wins, 1);
  assert.equal(teams[0].gamesFor, 4);
});

test("out-of-order refreshes cannot undo newer saves or cleared scores", () => {
  const saved = { ...final(4, 2), version: 2 };
  assert.deepEqual(mergeResults({ m: saved }, { m: { ...final(1, 1), version: 1 } }).m, saved);
  const cleared = { status: "scheduled", scores: [], version: 3 };
  assert.deepEqual(mergeResults({ m: cleared }, { m: saved }).m, cleared);
});
