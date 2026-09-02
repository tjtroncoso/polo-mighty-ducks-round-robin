import test from "node:test";
import assert from "node:assert/strict";
import { buildPlayersFromRows, generateSchedule, buildCopyText, MATCH_FORMATS } from "./scheduler.mjs";

function makePlayers(count) {
  return Array.from({ length: count }, (_, index) => ({
    id: `p${index}`, name: `Player ${index + 1}`, gender: index % 2 ? "female" : "male",
    arrival: "7:00 PM", arrivalMinutes: 19 * 60,
  }));
}

function schedule(overrides = {}) {
  return generateSchedule({ playersData: makePlayers(8), startTime: "7:00 PM", courts: 2,
    rounds: 6, minutesPerRound: 30, courtNumbers: ["5", "8"], mode: "doubles", ...overrides });
}

function verifyRounds(result, players, locks, mixed = false) {
  assert.deepEqual(result.errors, []);
  for (const round of result.schedule) {
    const playing = round.matches.flatMap((match) => [...match.pairA, ...match.pairB]);
    const all = [...playing, ...round.sitOuts, ...round.notArrived, ...round.waitingForPartner];
    assert.equal(new Set(all.map((player) => player.id)).size, players.length);
    assert.equal(all.length, players.length, "every player has exactly one assignment per round");
    for (const [first, second] of locks) {
      const team = round.matches.flatMap((match) => [match.pairA, match.pairB])
        .find((pair) => pair.some((player) => player.id === first || player.id === second));
      if (team) assert.deepEqual(team.map((player) => player.id).sort(), [first, second].sort());
    }
    if (mixed) for (const match of round.matches) {
      assert.equal(match.type, "Mixed Doubles");
      for (const pair of [match.pairA, match.pairB]) assert.deepEqual(pair.map((player) => player.gender).sort(), ["female", "male"]);
    }
  }
}

test("unlocked doubles still fill the available courts and vary partnerships", () => {
  const result = schedule();
  verifyRounds(result, makePlayers(8), []);
  assert.ok(result.schedule.every((round) => round.matches.length === 2));
  assert.ok(result.standings.every((player) => player.matches === 6));
  assert.deepEqual(result.schedule[0].matches.map((match) => match.court), ["Court 5", "Court 8"]);
  const partners = new Set();
  for (const round of result.schedule) for (const match of round.matches) {
    for (const pair of [match.pairA, match.pairB]) if (pair.some((player) => player.id === "p0")) {
      partners.add(pair.find((player) => player.id !== "p0").id);
    }
  }
  assert.ok(partners.size > 1);
});

for (const mode of ["doubles", "mixed"]) {
  test(`${mode}: one, several, or all pairs stay together across shuffles and sit-outs`, () => {
    const players = makePlayers(8);
    const allLocks = [["p0", "p1"], ["p2", "p3"], ["p4", "p5"], ["p6", "p7"]];
    for (const count of [1, 2, 4]) for (const courts of [1, 2]) for (const shuffleSeed of [1, 2, 7, 31]) {
      const locks = allLocks.slice(0, count);
      const result = schedule({ playersData: players, mode, lockedPairs: locks, courts, rounds: 8, shuffleSeed });
      verifyRounds(result, players, locks, mode === "mixed");
      assert.ok(result.schedule.every((round) => round.matches.length === courts));
      const counts = result.standings.map((player) => player.matches);
      assert.ok(Math.max(...counts) - Math.min(...counts) <= 1, "locked pairs get fair court time");
    }
  });
}

test("a locked partner waits for a late arrival and then plays with them", () => {
  const players = makePlayers(8);
  players[1] = { ...players[1], arrival: "7:30 PM", arrivalMinutes: 19 * 60 + 30 };
  const locks = [["p0", "p1"]];
  const result = schedule({ playersData: players, lockedPairs: locks, mode: "mixed" });
  verifyRounds(result, players, locks, true);
  assert.deepEqual(result.schedule[0].waitingForPartner.map((player) => player.id), ["p0"]);
  assert.deepEqual(result.schedule[0].notArrived.map((player) => player.id), ["p1"]);
  assert.equal(result.schedule[1].waitingForPartner.length, 0);
  assert.equal(result.schedule[1].matches.length, 2);
  assert.match(buildCopyText(result.schedule), /Waiting for partner: Player 1 \(waiting for Player 2\)/);
});

test("a late partner beyond the last round is never replaced", () => {
  const players = makePlayers(4);
  players[1] = { ...players[1], arrival: "11:00 PM", arrivalMinutes: 23 * 60 };
  const locks = [["p0", "p1"]];
  const result = schedule({ playersData: players, lockedPairs: locks });
  verifyRounds(result, players, locks);
  assert.ok(result.schedule.every((round) => round.matches.length === 0 && round.waitingForPartner.length === 1));
});

test("extra singles courts never split locked partners", () => {
  const players = makePlayers(6);
  const locks = [["p0", "p1"], ["p2", "p3"], ["p4", "p5"]];
  const result = schedule({ playersData: players, lockedPairs: locks, mode: "singles" });
  verifyRounds(result, players, locks);
  assert.ok(result.schedule.every((round) => round.matches.length === 1 && round.matches[0].type === "Doubles"));
  assert.ok(schedule({ playersData: players, mode: "singles" }).schedule.every((round) => round.matches.length === 2));
});

test("mixed mode reports incompatible locks instead of silently breaking them", () => {
  const result = schedule({ mode: "mixed", lockedPairs: [["p0", "p2"]] });
  assert.equal(result.schedule.length, 0);
  assert.match(result.errors[0], /one male and one female/);
  assert.equal(schedule({ mode: "doubles", lockedPairs: [["p0", "p2"]] }).errors.length, 0);
  assert.equal(schedule({ mode: "mixed", lockedPairs: [] }).schedule.length, 6);
});

test("self, missing, and overlapping pairings are rejected", () => {
  for (const lockedPairs of [[["p0", "p0"]], [["p0", "missing"]], [["p0", "p1"], ["p1", "p2"]]]) {
    const result = schedule({ lockedPairs });
    assert.ok(result.errors.length > 0);
    assert.equal(result.schedule.length, 0);
  }
});

test("row IDs preserve pairings when duplicate names are renamed or another row is removed", () => {
  const rows = makePlayers(6).map((player) => ({ ...player, name: "Alex", isLate: false }));
  rows[0].name = "Renamed";
  rows.splice(2, 1);
  const players = buildPlayersFromRows(rows, "7:00 PM");
  assert.equal(players[0].id, "p0");
  assert.equal(players[1].id, "p1");
  assert.equal(new Set(players.map((player) => player.name)).size, players.length);
  const locks = [["p0", "p1"]];
  verifyRounds(schedule({ playersData: players, lockedPairs: locks }), players, locks);
});

test("unlocking a pairing permits partner rotation again", () => {
  const result = schedule({ playersData: makePlayers(4), lockedPairs: [], courts: 1 });
  const teams = result.schedule.flatMap((round) => round.matches.flatMap((match) => [match.pairA, match.pairB]));
  assert.ok(teams.some((pair) => pair.some((player) => player.id === "p0") && !pair.some((player) => player.id === "p1")));
});

for (const format of MATCH_FORMATS) {
  test(`${format.label}: copied rounds use the chosen format and correct arrival planning`, () => {
    const players = makePlayers(4);
    players[1] = { ...players[1], arrival: "7:30 PM", arrivalMinutes: 19 * 60 + 30 };
    const result = schedule({ playersData: players, matchFormat: format.value, minutesPerRound: 60, estimatedMinutesPerRound: 15 });
    const text = buildCopyText(result.schedule, format.value);
    if (format.value === "timed") {
      assert.match(text, /Round 1 - 7:00 PM \(Timed: 60 min\)/);
      assert.equal(result.schedule[1].notArrived.length, 0);
      assert.doesNotMatch(text, /estimated/);
    } else {
      assert.ok(text.includes(`Round 1 - ${format.label}`));
      assert.doesNotMatch(text, /Round \d+ - \d/);
      assert.match(text, /estimated 15 minutes per round/);
      assert.equal(result.schedule[1].notArrived.length, 1);
      assert.equal(result.schedule[2].notArrived.length, 0);
    }
  });
}

test("non-timed formats omit arrival estimates when everybody starts together", () => {
  const result = schedule({ matchFormat: "match" });
  assert.doesNotMatch(buildCopyText(result.schedule, "match"), /estimated|7:00 PM/);
  assert.equal(buildCopyText([], "match"), "");
});
