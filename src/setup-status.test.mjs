import test from "node:test";
import assert from "node:assert/strict";
import { getSetupIssues } from "./setup-status.mjs";

const player = (id, overrides = {}) => ({ id, name: `Player ${id}`, gender: "", isLate: false, arrival: "", ...overrides });
const complete = (overrides = {}) => ({
  playerRows: [player(1), player(2), player(3), player(4)],
  startTime: "7:00 PM", matchFormat: "timed", minutesPerRound: "30", gamesToWin: "3",
  courts: "2", rounds: "3", mode: "doubles", ...overrides,
});

test("identifies every incomplete core field with a direct target", () => {
  const issues = getSetupIssues(complete({ playerRows: [player(1, { name: "" })], startTime: "", minutesPerRound: "", courts: "", rounds: "" }));
  assert.deepEqual(issues.map(({ targetId }) => targetId), ["add-player", "start-time", "minutes-per-round", "courts", "rounds"]);
  assert.match(issues[0].label, /4 more named players/);
});

test("requires two players only when singles courts are allowed", () => {
  assert.deepEqual(getSetupIssues(complete({ playerRows: [player(1), player(2)], mode: "singles" })), []);
  assert.match(getSetupIssues(complete({ playerRows: [player(1)], mode: "singles" }))[0].label, /1 more named player/);
});

test("reports mixed gender selections and then an unbalanced mixed roster", () => {
  let issues = getSetupIssues(complete({ mode: "mixed" }));
  assert.deepEqual(issues.map(({ targetId }) => targetId), ["gender-1"]);
  assert.match(issues[0].label, /4 players/);
  issues = getSetupIssues(complete({ mode: "mixed", playerRows: [player(1, { gender: "male" }), player(2, { gender: "male" }), player(3, { gender: "male" }), player(4, { gender: "female" })] }));
  assert.equal(issues[0].label, "Choose at least 2 female players for mixed doubles");
});

test("points to the first late player missing an arrival time", () => {
  const issues = getSetupIssues(complete({ playerRows: [player(1, { isLate: true }), player(2), player(3), player(4)] }));
  assert.deepEqual(issues, [{ targetId: "arrival-1", label: "Enter an arrival time for Player 1" }]);
});

test("checks ranges and format-specific settings without flagging defaults that are present", () => {
  assert.deepEqual(getSetupIssues(complete()), []);
  assert.deepEqual(getSetupIssues(complete({ matchFormat: "set", minutesPerRound: "" })), []);
  assert.deepEqual(getSetupIssues(complete({ matchFormat: "games", gamesToWin: "0", courts: "21", rounds: "2.5" })).map(({ targetId }) => targetId), ["games-to-win", "courts", "rounds"]);
});
