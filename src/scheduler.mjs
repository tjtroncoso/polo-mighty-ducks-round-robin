export const MATCH_FORMATS = [
  { value: "timed", label: "Timed", description: "Play until the round timer ends." },
  { value: "games", label: "First to", description: "Play until one side wins your selected number of games." },
  { value: "set", label: "Full Set", description: "Play one full set per round." },
  { value: "match", label: "Full Match", description: "Play a full match per round using your group's agreed scoring." },
];

export function getMatchFormatLabel(value, gamesToWin = 3) {
  if (value === "games") {
    const games = parsePositiveInteger(gamesToWin, 3, 1, 99);
    return `First to ${games} ${games === 1 ? "game" : "games"}`;
  }
  return (MATCH_FORMATS.find((format) => format.value === value) || MATCH_FORMATS[0]).label;
}

function seededRandom(seed) {
  let value = seed % 2147483647;
  if (value <= 0) value += 2147483646;

  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

function shuffleArray(items, random) {
  const shuffled = [...items];

  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled;
}

export function buildPlayersTextFromRows(playerRows) {
  return playerRows
    .map((row) => {
      const name = String(row.name || "").trim();
      const arrival = String(row.arrival || "").trim();

      if (!name) return "";
      if (row.isLate && arrival) return `${name}, ${arrival}`;
      return name;
    })
    .filter(Boolean)
    .join("\n");
}

export function buildPlayersFromRows(playerRows, defaultStartTime) {
  const text = buildPlayersTextFromRows(playerRows);
  const parsedPlayers = parsePlayers(text, defaultStartTime);
  const namedRows = playerRows.filter((row) => String(row.name || "").trim());

  return parsedPlayers.map((player, index) => ({
    ...player,
    id: namedRows[index]?.id || player.id,
    gender: namedRows[index]?.gender || "",
  }));
}

function parseTimeToMinutes(value, fallbackMinutes = 0) {
  if (!value || typeof value !== "string") return fallbackMinutes;

  const cleaned = value.trim().toLowerCase().replace(/\s/g, "");
  const match = cleaned.match(/^(\d{1,2})(?::(\d{2}))?(am|pm)?$/);

  if (!match) return fallbackMinutes;

  let hours = Number(match[1]);
  const minutes = Number(match[2] || 0);
  const meridiem = match[3];

  if (Number.isNaN(hours) || Number.isNaN(minutes) || minutes > 59) {
    return fallbackMinutes;
  }

  if (meridiem === "pm" && hours !== 12) hours += 12;
  if (meridiem === "am" && hours === 12) hours = 0;

  return hours * 60 + minutes;
}

function formatRoundTime(startMinutes, roundIndex, minutesPerRound) {
  const safeStart = Number.isFinite(startMinutes) ? startMinutes : 0;
  const safeRound = Number.isFinite(roundIndex) ? roundIndex : 0;
  const safeMinutes = Number.isFinite(minutesPerRound) && minutesPerRound > 0 ? minutesPerRound : 30;
  const total = safeStart + safeRound * safeMinutes;
  const normalized = ((total % 1440) + 1440) % 1440;
  let hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  const suffix = hours >= 12 ? "PM" : "AM";
  let displayHour = hours % 12;

  if (displayHour === 0) displayHour = 12;

  return `${displayHour}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

function formatTimeLabel(value) {
  const match = String(value || "").trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return value;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return value;

  const suffix = hours >= 12 ? "PM" : "AM";
  const displayHour = hours % 12 || 12;
  return `${displayHour}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

function parsePositiveInteger(value, fallback, min = 1, max = 99) {
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}

export function parseOptionalPositiveInteger(value, fallback = 0, min = 0, max = 99) {
  if (String(value || "").trim() === "") return fallback;
  return parsePositiveInteger(value, fallback, min, max);
}

export function parsePlayers(text, defaultStartTime) {
  const defaultArrivalMinutes = parseTimeToMinutes(defaultStartTime, 0);
  const seenNames = new Map();

  return String(text || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const [rawName, rawArrival] = line.split(",").map((part) => part.trim());
      const baseName = rawName || `Player ${index + 1}`;
      const duplicateCount = seenNames.get(baseName) || 0;
      seenNames.set(baseName, duplicateCount + 1);

      const name = duplicateCount === 0 ? baseName : `${baseName} ${duplicateCount + 1}`;
      const arrivalValue = rawArrival || defaultStartTime;

      return {
        id: `${name}-${index}`,
        name,
        gender: "",
        arrival: formatTimeLabel(arrivalValue),
        arrivalMinutes: parseTimeToMinutes(arrivalValue, defaultArrivalMinutes),
        matches: 0,
      };
    });
}

function getSet(map, key) {
  if (!map.has(key)) map.set(key, new Set());
  return map.get(key);
}

function isMixedPair(playerA, playerB) {
  return (playerA.gender === "male" && playerB.gender === "female") || (playerA.gender === "female" && playerB.gender === "male");
}

function isAllowedPair(playerA, playerB, lockedPartnerMap, requireMixed) {
  if (requireMixed && !isMixedPair(playerA, playerB)) return false;
  return (!lockedPartnerMap.has(playerA.id) || lockedPartnerMap.get(playerA.id) === playerB.id) &&
    (!lockedPartnerMap.has(playerB.id) || lockedPartnerMap.get(playerB.id) === playerA.id);
}

function scorePair(playerA, playerB, partnerMap, lockedPartnerMap) {
  let score = 0;
  score += playerA.matches + playerB.matches;

  if (!lockedPartnerMap.has(playerA.id) && getSet(partnerMap, playerA.name).has(playerB.name)) {
    score += 10;
  }

  return score;
}

function chooseBestPair(players, partnerMap, lockedPartnerMap, random = Math.random, requireMixed = false) {
  if (players.length < 2) return null;

  let bestPair = null;
  let bestScore = Infinity;
  let bestTieBreaker = Infinity;
  let bestMatchCount = Infinity;

  for (let i = 0; i < players.length; i += 1) {
    for (let j = i + 1; j < players.length; j += 1) {
      if (!isAllowedPair(players[i], players[j], lockedPartnerMap, requireMixed)) continue;

      const currentScore = scorePair(players[i], players[j], partnerMap, lockedPartnerMap);
      const matchCount = players[i].matches + players[j].matches;
      const tieBreaker = random();

      if (matchCount < bestMatchCount || (matchCount === bestMatchCount &&
        (currentScore < bestScore || (currentScore === bestScore && tieBreaker < bestTieBreaker)))) {
        bestPair = [players[i], players[j]];
        bestScore = currentScore;
        bestTieBreaker = tieBreaker;
        bestMatchCount = matchCount;
      }
    }
  }

  return bestPair;
}

function scoreDoublesMatch(pairA, pairB, opponentMap) {
  let score = 0;

  [...pairA, ...pairB].forEach((player) => {
    score += player.matches;
  });

  pairA.forEach((left) => {
    pairB.forEach((right) => {
      if (getSet(opponentMap, left.name).has(right.name)) {
        score += 3;
      }
    });
  });

  return score;
}

function chooseBestDoublesMatch(pool, partnerMap, opponentMap, lockedPartnerMap, random = Math.random, requireMixed = false) {
  if (pool.length < 4) return null;

  const pairA = chooseBestPair(pool, partnerMap, lockedPartnerMap, random, requireMixed);
  if (!pairA) return null;

  const pairAIds = new Set(pairA.map((player) => player.id));
  const remaining = pool.filter((player) => !pairAIds.has(player.id));
  let pairB = null;
  let bestScore = Infinity;
  let bestTieBreaker = Infinity;
  let bestMatchCount = Infinity;

  for (let firstIndex = 0; firstIndex < remaining.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < remaining.length; secondIndex += 1) {
      const candidate = [remaining[firstIndex], remaining[secondIndex]];
      if (!isAllowedPair(candidate[0], candidate[1], lockedPartnerMap, requireMixed)) continue;

      const currentScore = scorePair(candidate[0], candidate[1], partnerMap, lockedPartnerMap) +
        scoreDoublesMatch(pairA, candidate, opponentMap);
      const matchCount = candidate[0].matches + candidate[1].matches;
      const tieBreaker = random();

      if (matchCount < bestMatchCount || (matchCount === bestMatchCount &&
        (currentScore < bestScore || (currentScore === bestScore && tieBreaker < bestTieBreaker)))) {
        pairB = candidate;
        bestScore = currentScore;
        bestTieBreaker = tieBreaker;
        bestMatchCount = matchCount;
      }
    }
  }

  return pairB ? { pairA, pairB } : null;
}

function recordDoublesHistory(match, partnerMap, opponentMap) {
  const { pairA, pairB } = match;

  getSet(partnerMap, pairA[0].name).add(pairA[1].name);
  getSet(partnerMap, pairA[1].name).add(pairA[0].name);
  getSet(partnerMap, pairB[0].name).add(pairB[1].name);
  getSet(partnerMap, pairB[1].name).add(pairB[0].name);

  pairA.forEach((left) => {
    pairB.forEach((right) => {
      getSet(opponentMap, left.name).add(right.name);
      getSet(opponentMap, right.name).add(left.name);
    });
  });
}

function chooseBestSinglesMatch(pool, opponentMap, random = Math.random) {
  let bestMatch = null;
  let bestScore = Infinity;
  let bestTieBreaker = Infinity;

  for (let firstIndex = 0; firstIndex < pool.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < pool.length; secondIndex += 1) {
      const first = pool[firstIndex];
      const second = pool[secondIndex];
      const repeatPenalty = getSet(opponentMap, first.name).has(second.name) ? 10 : 0;
      const score = first.matches + second.matches + repeatPenalty;
      const tieBreaker = random();

      if (score < bestScore || (score === bestScore && tieBreaker < bestTieBreaker)) {
        bestMatch = [first, second];
        bestScore = score;
        bestTieBreaker = tieBreaker;
      }
    }
  }

  return bestMatch;
}

function recordSinglesHistory(first, second, opponentMap) {
  getSet(opponentMap, first.name).add(second.name);
  getSet(opponentMap, second.name).add(first.name);
}

function makeCourtList(courtNumbers, courtCount) {
  const numbers = Array.isArray(courtNumbers) ? courtNumbers : [];

  return Array.from({ length: courtCount }, (_, index) => {
    const value = String(numbers[index] || "").trim();
    return value ? `Court ${value}` : `Court ${index + 1}`;
  });
}

export function generateSchedule({ playersText, playersData, startTime, courts, rounds, minutesPerRound, estimatedMinutesPerRound = 30, gamesToWin = 3, courtNumbers, mode, lockedPairs = [], matchFormat = "timed", shuffleSeed = 1 }) {
  const safeCourts = parseOptionalPositiveInteger(courts, 0, 0, 50);
  const safeRounds = parseOptionalPositiveInteger(rounds, 0, 0, 50);
  const safeMinutesPerRound = parseOptionalPositiveInteger(matchFormat === "timed" ? minutesPerRound : estimatedMinutesPerRound, 30, 5, 180);
  const startMinutes = parseTimeToMinutes(startTime, 19 * 60);
  const random = seededRandom(shuffleSeed || 1);
  const sourcePlayers = playersData || parsePlayers(playersText, startTime || "7:00 PM");
  const players = shuffleArray(sourcePlayers.map((player) => ({ ...player, matches: 0 })), random);
  const partnerMap = new Map();
  const opponentMap = new Map();
  const courtList = makeCourtList(courtNumbers, safeCourts);
  const schedule = [];
  const requireMixed = mode === "mixed";
  const singlesOnly = mode === "singles";
  const playersById = new Map(players.map((player) => [player.id, player]));
  const lockedPartnerMap = new Map();
  const errors = [];

  for (const pair of singlesOnly ? [] : lockedPairs) {
    const [first, second] = pair.map((id) => playersById.get(id));
    if (pair.length !== 2 || !first || !second || first.id === second.id) {
      errors.push("Each locked pairing needs two different named players. Update or remove the pairing.");
    } else if (lockedPartnerMap.has(first.id) || lockedPartnerMap.has(second.id)) {
      errors.push("A player can only belong to one locked pairing.");
    } else if (requireMixed && !isMixedPair(first, second)) {
      errors.push(`${first.name} / ${second.name}: mixed doubles requires one male and one female player. Update their selections or unlock the pairing.`);
    } else {
      lockedPartnerMap.set(first.id, second.id);
      lockedPartnerMap.set(second.id, first.id);
    }
  }

  if (errors.length) return { schedule, standings: [], errors };

  players.forEach((player) => {
    partnerMap.set(player.name, new Set());
    opponentMap.set(player.name, new Set());
  });

  if (players.length === 0 || safeCourts === 0 || safeRounds === 0) {
    return { schedule, standings: [], errors };
  }

  for (let roundIndex = 0; roundIndex < safeRounds; roundIndex += 1) {
    const roundStart = startMinutes + roundIndex * safeMinutesPerRound;
    const used = new Set();
    const matches = [];

    const available = players
      .filter((player) => player.arrivalMinutes <= roundStart)
      .sort((a, b) => a.matches - b.matches || a.arrivalMinutes - b.arrivalMinutes || random() - 0.5);
    const availableIds = new Set(available.map((player) => player.id));
    const waitingForPartner = singlesOnly ? [] : available
      .filter((player) => lockedPartnerMap.has(player.id) && !availableIds.has(lockedPartnerMap.get(player.id)))
      .map((player) => ({ ...player, partnerName: playersById.get(lockedPartnerMap.get(player.id)).name }));
    const waitingIds = new Set(waitingForPartner.map((player) => player.id));

    for (let courtIndex = 0; courtIndex < safeCourts; courtIndex += 1) {
      const pool = available
        .filter((player) => !used.has(player.name) && !waitingIds.has(player.id))
        .sort((a, b) => a.matches - b.matches || random() - 0.5);

      if (singlesOnly) {
        if (pool.length < 2) break;
        const singlesPlayers = chooseBestSinglesMatch(pool, opponentMap, random);
        if (!singlesPlayers) break;

        singlesPlayers.forEach((player) => {
          used.add(player.name);
          player.matches += 1;
        });
        recordSinglesHistory(singlesPlayers[0], singlesPlayers[1], opponentMap);
        matches.push({
          court: courtList[courtIndex],
          type: "Singles",
          pairA: [singlesPlayers[0]],
          pairB: [singlesPlayers[1]],
        });
        continue;
      }

      if (pool.length < 4) break;

      const bestMatch = chooseBestDoublesMatch(pool, partnerMap, opponentMap, lockedPartnerMap, random, requireMixed);
      if (!bestMatch) break;

      bestMatch.pairA.forEach((player) => used.add(player.name));
      bestMatch.pairB.forEach((player) => used.add(player.name));

      const match = {
        court: courtList[courtIndex],
        type: requireMixed ? "Mixed Doubles" : "Doubles",
        pairA: bestMatch.pairA,
        pairB: bestMatch.pairB,
      };

      matches.push(match);
      [...match.pairA, ...match.pairB].forEach((player) => {
        player.matches += 1;
      });
      recordDoublesHistory(match, partnerMap, opponentMap);
    }

    const sitOuts = available.filter((player) => !used.has(player.name) && !waitingIds.has(player.id));

    schedule.push({
      round: roundIndex + 1,
      time: formatRoundTime(startMinutes, roundIndex, safeMinutesPerRound),
      minutesPerRound: safeMinutesPerRound,
      gamesToWin: parsePositiveInteger(gamesToWin, 3, 1, 99),
      arrivalTimesEstimated: matchFormat !== "timed" && players.some((player) => player.arrivalMinutes > startMinutes),
      matches,
      sitOuts,
      waitingForPartner,
      notArrived: players.filter((player) => player.arrivalMinutes > roundStart),
    });
  }

  const standings = [...players]
    .map((player) => ({
      name: player.name,
      gender: player.gender,
      matches: player.matches,
      arrival: player.arrival,
    }))
    .sort((a, b) => b.matches - a.matches || a.name.localeCompare(b.name));

  return { schedule, standings, errors };
}

export function buildCopyText(schedule, matchFormat = "timed") {
  if (!schedule.length) return "";

  const text = schedule
    .map((round) => {
      const roundLabel = `Round ${round.round} - ${matchFormat === "timed" ? `${round.time} (Timed: ${round.minutesPerRound} min)` : getMatchFormatLabel(matchFormat, round.gamesToWin)}`;
      const lines = [roundLabel];

      round.matches.forEach((match) => {
        const left = match.pairA.map((player) => player.name).join(" / ");
        const right = match.pairB.map((player) => player.name).join(" / ");
        lines.push(`${match.court} - ${left} vs ${right}`);
      });

      if (round.sitOuts.length > 0) {
        lines.push(`Rotate / sit out: ${round.sitOuts.map((player) => player.name).join(", ")}`);
      }

      if (round.waitingForPartner?.length > 0) {
        lines.push(`Waiting for partner: ${round.waitingForPartner.map((player) => `${player.name} (waiting for ${player.partnerName})`).join(", ")}`);
      }

      if (round.notArrived.length > 0) {
        lines.push(`Not arrived yet: ${round.notArrived.map((player) => `${player.name} (${player.arrival})`).join(", ")}`);
      }

      return lines.join("\n");
    })
    .join("\n\n");

  return schedule[0].arrivalTimesEstimated
    ? `Late arrivals planned using an estimated ${schedule[0].minutesPerRound} minutes per round. Start each round when all courts finish; adjust the estimate if play runs early or late.\n\n${text}`
    : text;
}
