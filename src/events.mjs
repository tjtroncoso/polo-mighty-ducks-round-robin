// Shared by the browser and API: never trust a submitted lineup or score.
export class InputError extends Error {}

function check(condition, message) {
  if (!condition) throw new InputError(message);
}

function text(value, label, max = 120, allowEmpty = false) {
  check(typeof value === "string", `${label} is required.`);
  const clean = value.trim();
  check((allowEmpty || clean.length > 0) && clean.length <= max, `${label} must be ${allowEmpty ? "at most " : "1–"}${max} characters.`);
  return clean;
}

function list(value, label, min, max) {
  check(Array.isArray(value) && value.length >= min && value.length <= max, `${label} must contain ${min}–${max} entries.`);
  return value;
}

function integer(value, label, min, max) {
  check(Number.isInteger(value) && value >= min && value <= max, `${label} must be a whole number from ${min} to ${max}.`);
  return value;
}

export function createSnapshot({ title, players, schedule, matchFormat, lockedPairs }) {
  const playerIds = (entries) => entries.map((player) => player.id);
  return validateSnapshot({
    schemaVersion: 1,
    title: title.trim() || "Tennis round robin",
    format: {
      type: matchFormat,
      gamesToWin: schedule[0]?.gamesToWin || 3,
      minutesPerRound: schedule[0]?.minutesPerRound || 30,
    },
    players: players.map(({ id, name, arrival }) => ({ id, name, arrival: arrival || "start" })),
    lockedPairs,
    rounds: schedule.map((round) => ({
      number: round.round,
      time: round.time,
      arrivalTimesEstimated: round.arrivalTimesEstimated,
      matches: round.matches.map((match, index) => ({
        id: `r${round.round}-m${index + 1}`,
        court: match.court,
        type: match.type,
        pairA: playerIds(match.pairA),
        pairB: playerIds(match.pairB),
      })),
      sitOuts: playerIds(round.sitOuts),
      notArrived: playerIds(round.notArrived),
      waitingForPartner: round.waitingForPartner.map((player) => ({ playerId: player.id, partnerName: player.partnerName })),
    })),
  });
}

export function validateSnapshot(input) {
  check(input && input.schemaVersion === 1, "This lineup version is not supported.");
  const title = text(input.title, "Event name");
  check(["timed", "games", "set", "match"].includes(input.format?.type), "Choose a match format.");
  const format = {
    type: input.format.type,
    gamesToWin: integer(input.format.gamesToWin, "Games to win", 1, 99),
    minutesPerRound: integer(input.format.minutesPerRound, "Minutes per round", 5, 180),
  };
  const players = list(input.players, "Players", 2, 200).map((player) => ({
    id: text(player?.id, "Player ID", 160),
    name: text(player?.name, "Player name"),
    arrival: text(player?.arrival, "Arrival", 40, true),
  }));
  const ids = new Set(players.map((player) => player.id));
  check(ids.size === players.length, "Each player needs a unique ID.");
  const pairIds = (value, label, min, max) => list(value, label, min, max).map((id) => {
    check(ids.has(id), `${label} contains an unknown player.`);
    return id;
  });
  const locked = new Set();
  const lockedPairs = list(input.lockedPairs, "Locked pairs", 0, 100).map((pair) => {
    const clean = pairIds(pair, "Locked pair", 2, 2);
    for (const id of clean) {
      check(!locked.has(id), "A player can only have one locked partner.");
      locked.add(id);
    }
    return clean;
  });
  const matchIds = new Set();
  const rounds = list(input.rounds, "Rounds", 1, 20).map((round, index) => {
    check(round?.number === index + 1, "Rounds must be in order.");
    const used = new Set();
    const assign = (entries) => entries.forEach((id) => {
      check(!used.has(id), "A player cannot appear twice in the same round.");
      used.add(id);
    });
    const matches = list(round.matches, "Courts per round", 0, 20).map((match, matchIndex) => {
      check(match?.id === `r${index + 1}-m${matchIndex + 1}`, "Invalid match ID.");
      matchIds.add(match.id);
      check(["Singles", "Doubles", "Mixed Doubles"].includes(match.type), "Invalid match type.");
      const size = match.type === "Singles" ? 1 : 2;
      const pairA = pairIds(match.pairA, "Side A", size, size);
      const pairB = pairIds(match.pairB, "Side B", size, size);
      assign([...pairA, ...pairB]);
      for (const side of [pairA, pairB]) {
        for (const pair of lockedPairs) {
          if (side.some((id) => pair.includes(id))) check(pair.every((id) => side.includes(id)), "A locked pair cannot be split.");
        }
      }
      return { id: match.id, court: text(match.court, "Court", 80), type: match.type, pairA, pairB };
    });
    const sitOuts = pairIds(round.sitOuts, "Sit outs", 0, 200);
    const notArrived = pairIds(round.notArrived, "Late players", 0, 200);
    const waitingForPartner = list(round.waitingForPartner, "Waiting players", 0, 200).map((entry) => {
      check(ids.has(entry?.playerId), "Unknown waiting player.");
      return { playerId: entry.playerId, partnerName: text(entry.partnerName, "Partner name") };
    });
    assign([...sitOuts, ...notArrived, ...waitingForPartner.map((entry) => entry.playerId)]);
    check(used.size === players.length, "Every player must be accounted for in each round.");
    return { number: round.number, time: text(round.time, "Round time", 50, true), arrivalTimesEstimated: Boolean(round.arrivalTimesEstimated), matches, sitOuts, notArrived, waitingForPartner };
  });
  check(matchIds.size > 0, "Generate at least one match before publishing.");
  return { schemaVersion: 1, title, format, players, lockedPairs, rounds };
}

function fullSet(a, b) {
  const high = Math.max(a, b);
  const low = Math.min(a, b);
  return (high === 6 && low <= 4) || (high === 7 && low === 6) || (high >= 7 && high - low === 2);
}

export function validateResult(input, format) {
  check(input && ["scheduled", "in_progress", "completed"].includes(input.status), "Choose a match status.");
  if (input.status === "scheduled") return { status: "scheduled", scores: [] };
  const scores = list(input.scores, "Scores", 1, format.type === "match" ? 5 : 1).map((score, index, rows) => {
    const a = integer(score?.a, "Side A score", 0, 99);
    const b = integer(score?.b, "Side B score", 0, 99);
    check(["games", "tiebreak"].includes(score.kind), "Choose games or a match tiebreak.");
    if (score.kind === "tiebreak") {
      check(format.type === "match" && index === rows.length - 1 && index > 0, "A match tiebreak can only be the final set after regular sets.");
    }
    if (format.type === "games") check(a <= format.gamesToWin && b <= format.gamesToWin, "The score cannot exceed the selected games to win.");
    if (input.status === "completed") {
      if (format.type === "games") check(Math.max(a, b) === format.gamesToWin && a !== b, `The winner must reach ${format.gamesToWin} games.`);
      if (format.type === "set" || (format.type === "match" && score.kind === "games")) check(fullSet(a, b), "Enter a completed set, such as 6–4, 7–5, or 7–6. Use Save progress for an unfinished set.");
      if (score.kind === "tiebreak") check((Math.max(a, b) >= 10 && Math.abs(a - b) === 2) || (Math.max(a, b) === 10 && Math.min(a, b) <= 8), "A match tiebreak is first to 10 points, winning by two.");
    }
    return { a, b, kind: score.kind };
  });
  if (input.status === "completed" && format.type === "match") {
    const setsA = scores.filter((score) => score.a > score.b).length;
    const setsB = scores.filter((score) => score.b > score.a).length;
    check(setsA !== setsB, "A completed match needs a winner on sets. Add the deciding set or save progress.");
    if (scores.at(-1).kind === "tiebreak") {
      const regular = scores.slice(0, -1);
      check(regular.filter((score) => score.a > score.b).length === regular.filter((score) => score.b > score.a).length, "Use a match tiebreak only to decide a match tied on sets.");
    }
  }
  return { status: input.status, scores };
}

export function resultOutcome(result, format) {
  const scores = result.scores || [];
  const gamesA = scores.filter((score) => score.kind === "games").reduce((total, score) => total + score.a, 0);
  const gamesB = scores.filter((score) => score.kind === "games").reduce((total, score) => total + score.b, 0);
  const a = format.type === "match" ? scores.filter((score) => score.a > score.b).length : gamesA;
  const b = format.type === "match" ? scores.filter((score) => score.b > score.a).length : gamesB;
  return { gamesA, gamesB, winner: a === b ? "draw" : a > b ? "a" : "b" };
}

export function buildStandings(snapshot, results, teams = false) {
  const names = new Map(snapshot.players.map((player) => [player.id, player.name]));
  const entries = teams
    ? snapshot.lockedPairs.map((ids) => ({ id: JSON.stringify([...ids].sort()), ids, name: ids.map((id) => names.get(id)).join(" / ") }))
    : snapshot.players.map((player) => ({ ...player, ids: [player.id] }));
  const rows = entries.map((entry) => ({ ...entry, played: 0, wins: 0, losses: 0, draws: 0, gamesFor: 0, gamesAgainst: 0, points: 0 }));
  for (const match of snapshot.rounds.flatMap((round) => round.matches)) {
    const result = results[match.id];
    if (result?.status !== "completed") continue;
    const { winner, gamesA, gamesB } = resultOutcome(result, snapshot.format);
    for (const row of rows) {
      const side = row.ids.every((id) => match.pairA.includes(id)) ? "a" : row.ids.every((id) => match.pairB.includes(id)) ? "b" : null;
      if (!side) continue;
      row.played++;
      row.gamesFor += side === "a" ? gamesA : gamesB;
      row.gamesAgainst += side === "a" ? gamesB : gamesA;
      if (winner === "draw") { row.draws++; row.points++; }
      else if (winner === side) { row.wins++; row.points += 2; }
      else row.losses++;
    }
  }
  return rows.sort((a, b) => b.points - a.points || (b.gamesFor - b.gamesAgainst) - (a.gamesFor - a.gamesAgainst) || b.gamesFor - a.gamesFor || a.name.localeCompare(b.name));
}

export function mergeResults(current, incoming) {
  const next = { ...current };
  for (const [id, result] of Object.entries(incoming)) {
    if (!next[id] || result.version > next[id].version) next[id] = result;
  }
  return next;
}
