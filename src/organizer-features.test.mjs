import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { buildEventCsv } from "./exports.mjs";
import { validateFrequentPlayers } from "./frequent-players.mjs";
import { validateBetaFeedback } from "./beta-feedback.mjs";

test("frequent-player validation preserves names and mixed-doubles gender selections", () => {
  const players = validateFrequentPlayers({
    players: [
      { id: randomUUID(), name: " Alex ", gender: "male" },
      { id: randomUUID(), name: "Bailey", gender: "female" },
    ],
  });
  assert.equal(players[0].name, "Alex");
  assert.equal(players[0].normalizedName, "alex");
  assert.equal(players[0].gender, "male");
  assert.equal(players[1].name, "Bailey");
  assert.throws(() => validateFrequentPlayers({ players: [{ ...players[0], name: "Alex" }, { ...players[1], name: " alex " }] }), /only once/);
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

test("beta feedback accepts the three pricing choices and limits optional comments", () => {
  assert.deepEqual(validateBetaFeedback({ willingness: "yes", comment: "  Useful for my club.  " }), { willingness: "yes", comment: "Useful for my club." });
  assert.deepEqual(validateBetaFeedback({ willingness: "maybe", comment: "" }), { willingness: "maybe", comment: "" });
  assert.deepEqual(validateBetaFeedback({ willingness: "not_yet", comment: "Needs RSVPs" }), { willingness: "not_yet", comment: "Needs RSVPs" });
  assert.throws(() => validateBetaFeedback({ willingness: "unsure", comment: "" }), /Yes, Maybe, or Not yet/);
  assert.throws(() => validateBetaFeedback({ willingness: "yes", comment: "x".repeat(1001) }), /1,000 characters/);
});
