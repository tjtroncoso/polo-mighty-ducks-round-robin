import React, { useMemo, useRef, useState } from "react";
import { Copy, Plus, RefreshCw, Shuffle, Trash2, Users } from "lucide-react";

const createBlankPlayer = () => ({
  id:
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random()}`,
  name: "",
  gender: "",
  isLate: false,
  arrival: "",
});

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

function buildPlayersTextFromRows(playerRows) {
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

function buildPlayersFromRows(playerRows, defaultStartTime) {
  const text = buildPlayersTextFromRows(playerRows);
  const parsedPlayers = parsePlayers(text, defaultStartTime);
  const namedRows = playerRows.filter((row) => String(row.name || "").trim());

  return parsedPlayers.map((player, index) => ({
    ...player,
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

function parsePositiveInteger(value, fallback, min = 1, max = 99) {
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}

function parseOptionalPositiveInteger(value, fallback = 0, min = 0, max = 99) {
  if (String(value || "").trim() === "") return fallback;
  return parsePositiveInteger(value, fallback, min, max);
}

function parsePlayers(text, defaultStartTime) {
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
      const arrival = rawArrival || defaultStartTime;

      return {
        id: `${name}-${index}`,
        name,
        gender: "",
        arrival,
        arrivalMinutes: parseTimeToMinutes(arrival, defaultArrivalMinutes),
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

function scorePair(playerA, playerB, partnerMap) {
  let score = 0;
  score += playerA.matches + playerB.matches;

  if (getSet(partnerMap, playerA.name).has(playerB.name)) {
    score += 10;
  }

  return score;
}

function chooseBestPair(players, partnerMap, random = Math.random, requireMixed = false) {
  if (players.length < 2) return null;

  let bestPair = null;
  let bestScore = Infinity;
  let bestTieBreaker = Infinity;

  for (let i = 0; i < players.length; i += 1) {
    for (let j = i + 1; j < players.length; j += 1) {
      if (requireMixed && !isMixedPair(players[i], players[j])) continue;

      const currentScore = scorePair(players[i], players[j], partnerMap);
      const tieBreaker = random();

      if (currentScore < bestScore || (currentScore === bestScore && tieBreaker < bestTieBreaker)) {
        bestPair = [players[i], players[j]];
        bestScore = currentScore;
        bestTieBreaker = tieBreaker;
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

function chooseBestDoublesMatch(pool, partnerMap, opponentMap, random = Math.random, requireMixed = false) {
  if (pool.length < 4) return null;

  let bestMatch = null;
  let bestScore = Infinity;
  let bestTieBreaker = Infinity;

  for (let a = 0; a < pool.length; a += 1) {
    for (let b = a + 1; b < pool.length; b += 1) {
      const pairA = [pool[a], pool[b]];
      if (requireMixed && !isMixedPair(pairA[0], pairA[1])) continue;

      const remaining = pool.filter((_, index) => index !== a && index !== b);
      const pairB = chooseBestPair(remaining, partnerMap, random, requireMixed);

      if (!pairB) continue;

      const currentScore =
        scorePair(pairA[0], pairA[1], partnerMap) +
        scorePair(pairB[0], pairB[1], partnerMap) +
        scoreDoublesMatch(pairA, pairB, opponentMap);
      const tieBreaker = random();

      if (currentScore < bestScore || (currentScore === bestScore && tieBreaker < bestTieBreaker)) {
        bestMatch = { pairA, pairB };
        bestScore = currentScore;
        bestTieBreaker = tieBreaker;
      }
    }
  }

  return bestMatch;
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

function makeCourtList(courtNumbers, courtCount) {
  const numbers = Array.isArray(courtNumbers) ? courtNumbers : [];

  return Array.from({ length: courtCount }, (_, index) => {
    const value = String(numbers[index] || "").trim();
    return value ? `Court ${value}` : `Court ${index + 1}`;
  });
}

function generateSchedule({ playersText, playersData, startTime, courts, rounds, minutesPerRound, courtNumbers, mode, shuffleSeed = 1 }) {
  const safeCourts = parseOptionalPositiveInteger(courts, 0, 0, 20);
  const safeRounds = parseOptionalPositiveInteger(rounds, 0, 0, 20);
  const safeMinutesPerRound = parseOptionalPositiveInteger(minutesPerRound, 30, 5, 180);
  const startMinutes = parseTimeToMinutes(startTime, 19 * 60);
  const random = seededRandom(shuffleSeed || 1);
  const sourcePlayers = playersData || parsePlayers(playersText, startTime || "7:00 PM");
  const players = shuffleArray(sourcePlayers.map((player) => ({ ...player, matches: 0 })), random);
  const partnerMap = new Map();
  const opponentMap = new Map();
  const courtList = makeCourtList(courtNumbers, safeCourts);
  const schedule = [];
  const requireMixed = mode === "mixed";

  players.forEach((player) => {
    partnerMap.set(player.name, new Set());
    opponentMap.set(player.name, new Set());
  });

  if (players.length === 0 || safeCourts === 0 || safeRounds === 0) {
    return { schedule, standings: [] };
  }

  for (let roundIndex = 0; roundIndex < safeRounds; roundIndex += 1) {
    const roundStart = startMinutes + roundIndex * safeMinutesPerRound;
    const used = new Set();
    const matches = [];

    const available = players
      .filter((player) => player.arrivalMinutes <= roundStart)
      .sort((a, b) => a.matches - b.matches || a.arrivalMinutes - b.arrivalMinutes || random() - 0.5);

    for (let courtIndex = 0; courtIndex < safeCourts; courtIndex += 1) {
      const pool = available
        .filter((player) => !used.has(player.name))
        .sort((a, b) => a.matches - b.matches || random() - 0.5);

      if (pool.length < 4) break;

      const bestMatch = chooseBestDoublesMatch(pool, partnerMap, opponentMap, random, requireMixed);
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

    let sitOuts = available.filter((player) => !used.has(player.name));

    if (mode === "singles" && matches.length < safeCourts && sitOuts.length >= 2) {
      const singlesPlayers = [...sitOuts].sort((a, b) => a.matches - b.matches || random() - 0.5).slice(0, 2);
      singlesPlayers.forEach((player) => {
        used.add(player.name);
        player.matches += 1;
      });

      matches.push({
        court: courtList[matches.length],
        type: "Singles",
        pairA: [singlesPlayers[0]],
        pairB: [singlesPlayers[1]],
      });

      sitOuts = available.filter((player) => !used.has(player.name));
    }

    schedule.push({
      round: roundIndex + 1,
      time: formatRoundTime(startMinutes, roundIndex, safeMinutesPerRound),
      matches,
      sitOuts,
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

  return { schedule, standings };
}

function buildCopyText(schedule, matchFormat = "timed") {
  if (!schedule.length) return "";

  return schedule
    .map((round) => {
      const roundLabel = matchFormat === "set" ? `Round ${round.round} - One Set` : `Round ${round.round} - ${round.time}`;
      const lines = [roundLabel];

      round.matches.forEach((match) => {
        const left = match.pairA.map((player) => player.name).join(" / ");
        const right = match.pairB.map((player) => player.name).join(" / ");
        lines.push(`${match.court} - ${left} vs ${right}`);
      });

      if (round.sitOuts.length > 0) {
        lines.push(`Rotate / sit out: ${round.sitOuts.map((player) => player.name).join(", ")}`);
      }

      if (round.notArrived.length > 0) {
        lines.push(`Not arrived yet: ${round.notArrived.map((player) => `${player.name} (${player.arrival})`).join(", ")}`);
      }

      return lines.join("\n");
    })
    .join("\n\n");
}

function copyTextToClipboard(text) {
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(text);
  }

  return new Promise((resolve, reject) => {
    try {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.setAttribute("readonly", "");
      textArea.style.position = "fixed";
      textArea.style.top = "0";
      textArea.style.left = "0";
      textArea.style.opacity = "0";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      textArea.setSelectionRange(0, textArea.value.length);
      const successful = document.execCommand("copy");
      document.body.removeChild(textArea);

      if (successful) {
        resolve(true);
      } else {
        reject(new Error("Clipboard permission was denied."));
      }
    } catch (error) {
      reject(error);
    }
  });
}

function FieldLabel({ children }) {
  return <label className="text-sm font-semibold text-slate-700">{children}</label>;
}

function Panel({ children, className = "" }) {
  return <div className={`rounded-3xl border border-white/25 bg-white/82 shadow-2xl backdrop-blur-md ${className}`}>{children}</div>;
}

function normalizeCourtNumbers(existingNumbers, courtCount) {
  return Array.from({ length: courtCount }, (_, index) => existingNumbers[index] || "");
}

export default function TennisRoundRobinGenerator() {
  const [playerRows, setPlayerRows] = useState([createBlankPlayer()]);
  const [startTime, setStartTime] = useState("");
  const [courts, setCourts] = useState("");
  const [rounds, setRounds] = useState("");
  const [minutesPerRound, setMinutesPerRound] = useState("");
  const [matchFormat, setMatchFormat] = useState("timed");
  const [courtNumbers, setCourtNumbers] = useState([]);
  const [mode, setMode] = useState("doubles");
  const [copyStatus, setCopyStatus] = useState("idle");
  const [shuffleSeed, setShuffleSeed] = useState(1);
  const outputRef = useRef(null);

  const courtCount = parseOptionalPositiveInteger(courts, 0, 0, 20);
  const visibleCourtNumbers = normalizeCourtNumbers(courtNumbers, courtCount);
  const playersText = useMemo(() => buildPlayersTextFromRows(playerRows), [playerRows]);
  const playersData = useMemo(() => buildPlayersFromRows(playerRows, startTime || "7:00 PM"), [playerRows, startTime]);
  const isMixedMode = mode === "mixed";

  const generated = useMemo(
    () =>
      generateSchedule({
        playersText,
        playersData,
        startTime,
        courts,
        rounds,
        minutesPerRound,
        courtNumbers: visibleCourtNumbers,
        mode,
        shuffleSeed,
      }),
    [playersText, playersData, startTime, courts, rounds, minutesPerRound, visibleCourtNumbers, mode, shuffleSeed]
  );

  const copyText = useMemo(() => buildCopyText(generated.schedule, matchFormat), [generated.schedule, matchFormat]);

  async function copySchedule() {
    if (!copyText.trim()) {
      setCopyStatus("empty");
      window.setTimeout(() => setCopyStatus("idle"), 1600);
      return;
    }

    try {
      await copyTextToClipboard(copyText);
      setCopyStatus("copied");
      window.setTimeout(() => setCopyStatus("idle"), 1600);
    } catch (error) {
      if (outputRef.current) {
        outputRef.current.focus();
        outputRef.current.select();
      }
      setCopyStatus("manual");
      console.warn("Automatic copy was blocked by the browser. Select and copy the schedule manually.", error);
    }
  }

  function updatePlayerRow(id, updates) {
    setPlayerRows((current) => current.map((row) => (row.id === id ? { ...row, ...updates } : row)));
  }

  function addPlayerRow() {
    setPlayerRows((current) => [...current, createBlankPlayer()]);
  }

  function removePlayerRow(id) {
    setPlayerRows((current) => {
      const next = current.filter((row) => row.id !== id);
      return next.length ? next : [createBlankPlayer()];
    });
  }

  function updateCourtNumber(index, value) {
    setCourtNumbers((current) => {
      const next = normalizeCourtNumbers(current, courtCount);
      next[index] = value;
      return next;
    });
  }

  function shuffleSchedule() {
    setShuffleSeed((current) => current + 1);
    setCopyStatus("idle");
  }

  function clearForm() {
    setPlayerRows([createBlankPlayer()]);
    setStartTime("");
    setCourts("");
    setRounds("");
    setMinutesPerRound("");
    setCourtNumbers([]);
    setMatchFormat("timed");
    setMode("doubles");
    setCopyStatus("idle");
    setShuffleSeed(1);
  }

  const playerCount = parsePlayers(playersText, startTime).length;
  const maleCount = playersData.filter((player) => player.gender === "male").length;
  const femaleCount = playersData.filter((player) => player.gender === "female").length;
  const mixedReady = !isMixedMode || (maleCount >= 2 && femaleCount >= 2);
  const scheduleReady = playerCount > 0 && courtCount > 0 && parseOptionalPositiveInteger(rounds, 0, 0, 20) > 0 && mixedReady;

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#062d2b] p-4 text-slate-950 md:p-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_62%,rgba(210,255,45,0.35),transparent_10%),radial-gradient(circle_at_15%_18%,rgba(20,184,166,0.25),transparent_24%),linear-gradient(135deg,#052724_0%,#063d38_42%,#021817_100%)]" />
      <div className="pointer-events-none absolute -left-24 top-10 h-80 w-80 rounded-full bg-emerald-300/10 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-96 w-96 rounded-full bg-lime-300/15 blur-3xl" />
      <div className="pointer-events-none absolute right-[-8rem] top-24 h-[32rem] w-[32rem] rotate-12 rounded-[4rem] border-[18px] border-white/10" />
      <div className="pointer-events-none absolute right-[-4rem] top-44 h-[18rem] w-[38rem] rotate-12 border-y-4 border-white/15" />
      <div className="pointer-events-none absolute bottom-12 left-[-7rem] h-48 w-[42rem] -rotate-12 rounded-full border-t border-lime-300/25" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,rgba(255,255,255,0.08)_1px,transparent_1px)] bg-[length:80px_80px] opacity-20" />

      <div className="relative z-10 mx-auto max-w-7xl space-y-6">
        <header className="rounded-3xl border border-white/25 bg-white/84 p-6 shadow-2xl backdrop-blur-md md:p-8">
          <h1 className="max-w-3xl text-3xl font-bold tracking-tight md:text-5xl">Tennis Round Robin Generator</h1>
          <p className="mt-3 max-w-2xl text-base text-slate-600 md:text-lg">
            Enter your players, courts, and round settings. Create a tennis schedule and copy it into your group chat.
          </p>
        </header>

        <div className="grid gap-6 lg:grid-cols-[460px_1fr]">
          <Panel className="p-6">
            <div className="mb-5 flex items-center gap-2">
              <Users className="h-5 w-5" />
              <h2 className="text-xl font-semibold">Setup</h2>
            </div>

            <div className="space-y-5">
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <FieldLabel>Players</FieldLabel>
                  <button
                    type="button"
                    onClick={addPlayerRow}
                    className="inline-flex items-center gap-1 rounded-full bg-emerald-950 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-800"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add Player
                  </button>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">One Player Per Line</div>

                  {isMixedMode ? (
                    <div className="mb-3 rounded-xl bg-emerald-50 p-3 text-xs text-emerald-900">
                      Mixed Doubles mode is on. Select Male or Female for each player so the app can create male/female teams.
                    </div>
                  ) : null}

                  <div className="space-y-3">
                    {playerRows.map((row, index) => (
                      <div key={row.id} className="rounded-2xl bg-white p-3 shadow-sm">
                        <div className="flex items-center gap-2">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-bold text-slate-600">{index + 1}</div>
                          <input
                            value={row.name}
                            onChange={(event) => updatePlayerRow(row.id, { name: event.target.value })}
                            className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-slate-400 transition focus:ring-2"
                            placeholder="Player name"
                          />
                          <button
                            type="button"
                            onClick={() => removePlayerRow(row.id)}
                            className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                            aria-label={`Remove player ${index + 1}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>

                        {isMixedMode ? (
                          <div className="mt-3">
                            <select
                              value={row.gender}
                              onChange={(event) => updatePlayerRow(row.id, { gender: event.target.value })}
                              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-slate-400 transition focus:ring-2"
                            >
                              <option value="">Select Male/Female</option>
                              <option value="male">Male</option>
                              <option value="female">Female</option>
                            </select>
                          </div>
                        ) : null}

                        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                            <input
                              type="checkbox"
                              checked={row.isLate}
                              onChange={(event) => updatePlayerRow(row.id, { isLate: event.target.checked, arrival: event.target.checked ? row.arrival : "" })}
                              className="h-4 w-4 rounded border-slate-300"
                            />
                            Late arrival
                          </label>

                          {row.isLate ? (
                            <input
                              value={row.arrival}
                              onChange={(event) => updatePlayerRow(row.id, { arrival: event.target.value })}
                              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-slate-400 transition focus:ring-2 sm:w-36"
                              placeholder="7:30 PM"
                            />
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <p className="text-xs text-slate-500">Add one player per row. Check late arrival only for players arriving after the start time.</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <FieldLabel>Start time</FieldLabel>
                  <input
                    value={startTime}
                    onChange={(event) => setStartTime(event.target.value)}
                    className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-slate-400 transition focus:ring-2"
                    placeholder="7:00 PM"
                  />
                </div>

                <div className="space-y-2">
                  <FieldLabel>Round type</FieldLabel>
                  <select
                    value={matchFormat}
                    onChange={(event) => setMatchFormat(event.target.value)}
                    className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-slate-400 transition focus:ring-2"
                  >
                    <option value="timed">Timed rounds</option>
                    <option value="set">One set per round</option>
                  </select>
                </div>
              </div>

              {matchFormat === "timed" ? (
                <div className="space-y-2">
                  <FieldLabel>Minutes / round</FieldLabel>
                  <input
                    type="number"
                    min="5"
                    value={minutesPerRound}
                    onChange={(event) => setMinutesPerRound(event.target.value)}
                    className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-slate-400 transition focus:ring-2"
                    placeholder="30"
                  />
                </div>
              ) : (
                <div className="rounded-2xl bg-slate-100 p-3 text-sm text-slate-700">
                  <span className="font-semibold">One set mode:</span> each round is labeled as one set instead of a timed block. Move to the next round when every court finishes.
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <FieldLabel>Number of courts</FieldLabel>
                  <input
                    type="number"
                    min="0"
                    value={courts}
                    onChange={(event) => {
                      const value = event.target.value;
                      setCourts(value);
                      setCourtNumbers((current) => normalizeCourtNumbers(current, parseOptionalPositiveInteger(value, 0, 0, 20)));
                    }}
                    className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-slate-400 transition focus:ring-2"
                    placeholder="3"
                  />
                </div>

                <div className="space-y-2">
                  <FieldLabel>Rounds</FieldLabel>
                  <input
                    type="number"
                    min="0"
                    value={rounds}
                    onChange={(event) => setRounds(event.target.value)}
                    className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-slate-400 transition focus:ring-2"
                    placeholder="3"
                  />
                </div>
              </div>

              {courtCount > 0 ? (
                <div className="space-y-3">
                  <FieldLabel>Court numbers</FieldLabel>
                  <div className="grid grid-cols-2 gap-3">
                    {visibleCourtNumbers.map((courtNumber, index) => (
                      <div key={`court-number-${index}`} className="space-y-1">
                        <label className="text-xs font-medium text-slate-500">Court {index + 1}</label>
                        <input
                          value={courtNumber}
                          onChange={(event) => updateCourtNumber(index, event.target.value)}
                          className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-slate-400 transition focus:ring-2"
                          placeholder={`ex: ${index + 1}`}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="space-y-2">
                <FieldLabel>Format</FieldLabel>
                <select
                  value={mode}
                  onChange={(event) => setMode(event.target.value)}
                  className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-slate-400 transition focus:ring-2"
                >
                  <option value="doubles">Doubles only</option>
                  <option value="mixed">Mixed doubles</option>
                  <option value="singles">Allow singles court if extra players</option>
                </select>
              </div>

              {isMixedMode && !mixedReady ? (
                <div className="rounded-2xl bg-amber-50 p-3 text-sm text-amber-800">
                  Mixed Doubles needs at least 2 male and 2 female players available to create a court.
                </div>
              ) : null}

              <div className="grid grid-cols-2 gap-3 rounded-2xl bg-emerald-950/10 p-3 text-sm">
                <div>
                  <div className="text-slate-500">Players</div>
                  <div className="text-lg font-bold">{playerCount}</div>
                </div>
                <div>
                  <div className="text-slate-500">Status</div>
                  <div className="text-lg font-bold">{scheduleReady ? "Ready" : "Missing Info"}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <button
                  type="button"
                  onClick={shuffleSchedule}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-900/20 bg-white px-4 py-3 text-sm font-semibold text-emerald-950 shadow-sm transition hover:bg-emerald-50"
                >
                  <Shuffle className="h-4 w-4" /> Shuffle
                </button>
                <button
                  type="button"
                  onClick={copySchedule}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-950 px-4 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-emerald-800"
                >
                  <Copy className="h-4 w-4" /> {copyStatus === "copied" ? "Copied" : copyStatus === "manual" ? "Select Text Below" : copyStatus === "empty" ? "Nothing to Copy" : "Copy Schedule"}
                </button>
              </div>

              <button
                type="button"
                onClick={clearForm}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold transition hover:bg-slate-100"
                aria-label="Clear form"
              >
                <RefreshCw className="h-4 w-4" /> Reset Form
              </button>
            </div>
          </Panel>

          <main className="space-y-6">
            <Panel className="p-6">
              <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-2xl font-semibold">Generated Schedule</h2>
                  <p className="text-sm text-slate-500">Copy and paste this into your group chat. Use timed rounds, one-set rounds, or mixed doubles.</p>
                </div>
                <div className="rounded-full bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700">
                  {isMixedMode ? "Mixed doubles" : matchFormat === "set" ? "One set per round" : "Auto-balances match counts"}
                </div>
              </div>

              <textarea
                ref={outputRef}
                readOnly
                value={copyText}
                placeholder="Your generated schedule will appear here."
                className="mb-5 min-h-[180px] w-full rounded-2xl border border-white/40 bg-white/80 p-4 font-mono text-sm outline-none ring-emerald-400 transition focus:ring-2"
                aria-label="Copy-ready generated schedule"
              />

              {generated.schedule.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-emerald-300/60 bg-white/55 p-6 text-center text-sm text-slate-600">
                  Fill in players, number of courts, court numbers, and rounds to generate a schedule.
                </div>
              ) : (
                <div className="space-y-5">
                  {generated.schedule.map((round) => (
                    <section key={round.round} className="rounded-3xl border border-white/50 bg-white/70 p-4 shadow-sm">
                      <div className="mb-3 flex items-center justify-between">
                        <h3 className="text-lg font-bold">Round {round.round}</h3>
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700">
                          {matchFormat === "set" ? "One Set" : round.time}
                        </span>
                      </div>

                      <div className="grid gap-3">
                        {round.matches.length === 0 ? (
                          <div className="rounded-2xl bg-amber-50 p-3 text-sm text-amber-800">Not enough available players for a match this round.</div>
                        ) : null}

                        {round.matches.map((match, index) => (
                          <div key={`${round.round}-${match.court}-${index}`} className="grid gap-2 rounded-2xl bg-emerald-950/5 p-4 md:grid-cols-[110px_1fr] md:items-center">
                            <div className="font-semibold text-slate-700">{match.court}</div>
                            <div className="text-slate-950">
                              <span className="font-semibold">{match.pairA.map((player) => player.name).join(" / ")}</span>
                              <span className="px-2 text-slate-400">vs</span>
                              <span className="font-semibold">{match.pairB.map((player) => player.name).join(" / ")}</span>
                              <span className="ml-2 rounded-full bg-white px-2 py-1 text-xs font-medium text-slate-500">{match.type}</span>
                            </div>
                          </div>
                        ))}
                      </div>

                      {(round.sitOuts.length > 0 || round.notArrived.length > 0) && (
                        <div className="mt-3 grid gap-2 md:grid-cols-2">
                          {round.sitOuts.length > 0 && (
                            <div className="rounded-2xl bg-slate-100 p-3 text-sm">
                              <span className="font-semibold">Rotate / sit out: </span>
                              {round.sitOuts.map((player) => player.name).join(", ")}
                            </div>
                          )}

                          {round.notArrived.length > 0 && (
                            <div className="rounded-2xl bg-slate-100 p-3 text-sm">
                              <span className="font-semibold">Not arrived yet: </span>
                              {round.notArrived.map((player) => `${player.name} (${player.arrival})`).join(", ")}
                            </div>
                          )}
                        </div>
                      )}
                    </section>
                  ))}
                </div>
              )}
            </Panel>

            <Panel className="p-6">
              <div className="mb-4 flex items-center gap-2">
                <Shuffle className="h-5 w-5" />
                <h2 className="text-xl font-semibold">Player Match Count</h2>
              </div>

              {generated.standings.length === 0 ? (
                <div className="rounded-2xl bg-white/55 px-4 py-6 text-center text-sm text-slate-600">Player match counts will appear after a schedule is generated.</div>
              ) : (
                <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                  {generated.standings.map((player) => (
                    <div key={player.name} className="flex items-center justify-between rounded-2xl bg-emerald-950/5 px-4 py-3">
                      <div>
                        <div className="font-medium">{player.name}</div>
                        <div className="text-xs text-slate-500">
                          {isMixedMode && player.gender ? `${player.gender === "male" ? "Male" : "Female"} • ` : ""}Arrives {player.arrival || "start"}
                        </div>
                      </div>
                      <span className="rounded-full bg-white px-3 py-1 text-sm font-semibold shadow-sm">{player.matches}</span>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          </main>
        </div>
      </div>
    </div>
  );
}
