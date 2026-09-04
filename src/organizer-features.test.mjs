import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { buildEventCsv } from "./exports.mjs";
import { validateRoster } from "./rosters.mjs";

test("saved roster validation preserves names and mixed-doubles gender selections", () => {
  const roster = validateRoster({
    id: randomUUID(),
    name: "  Thursday regulars  ",
    players: [
      { id: "a", name: " Alex ", gender: "male" },
      { id: "b", name: "Bailey", gender: "female" },
    ],
  });
  assert.equal(roster.name, "Thursday regulars");
  assert.deepEqual(roster.players, [
    { id: "a", name: "Alex", gender: "male" },
    { id: "b", name: "Bailey", gender: "female" },
  ]);
  assert.throws(() => validateRoster({ ...roster, players: [roster.players[0]] }), /2–200 players/);
});

test("CSV export contains schedule, results, escaped names, and standings", () => {
  const event = {
    snapshot: {
      title: "Friday, Tennis",
      format: { type: "games", gamesToWin: 4, minutesPerRound: 30 },
      lockedPairs: [],
      players: [
        { id: "a", name: "Alex", arrival: "start" },
        { id: "b", name: "Bailey", arrival: "start" },
        { id: "c", name: "Casey", arrival: "start" },
        { id: "d", name: "Drew", arrival: "start" },
      ],
      rounds: [{ number: 1, time: "9:00 AM", matches: [{ id: "r1-m1", court: "Court 1", type: "Doubles", pairA: ["a", "b"], pairB: ["c", "d"] }] }],
    },
    results: { "r1-m1": { status: "completed", scores: [{ a: 4, b: 2, kind: "games" }] } },
  };
  const csv = buildEventCsv(event);
  assert.match(csv, /"Friday, Tennis",1,9:00 AM,Court 1,Alex \/ Bailey,Casey \/ Drew,Doubles,completed,4-2/);
  assert.match(csv, /Standings/);
  assert.match(csv, /Alex,1,1,0,0,4,2,2/);
});
