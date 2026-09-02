import { buildPlayersTextFromRows, buildPlayersFromRows, parseOptionalPositiveInteger, parsePlayers, generateSchedule, buildCopyText, MATCH_FORMATS, getMatchFormatLabel } from "./scheduler.mjs";
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
  const [estimatedMinutesPerRound, setEstimatedMinutesPerRound] = useState("30");
  const [matchFormat, setMatchFormat] = useState("timed");
  const [lockedPairs, setLockedPairs] = useState([]);
  const [courtNumbers, setCourtNumbers] = useState([]);
  const [mode, setMode] = useState("doubles");
  const [copyStatus, setCopyStatus] = useState("idle");
  const [shuffleSeed, setShuffleSeed] = useState(1);
  const outputRef = useRef(null);

  const courtCount = parseOptionalPositiveInteger(courts, 0, 0, 20);
  const visibleCourtNumbers = useMemo(() => normalizeCourtNumbers(courtNumbers, courtCount), [courtNumbers, courtCount]);
  const playersText = useMemo(() => buildPlayersTextFromRows(playerRows), [playerRows]);
  const playersData = useMemo(() => buildPlayersFromRows(playerRows, startTime || "7:00 PM"), [playerRows, startTime]);
  const isMixedMode = mode === "mixed";
  const hasLatePlayers = playerRows.some((row) => row.name.trim() && row.isLate);
  const lockedPartnerById = new Map(lockedPairs.flatMap(([first, second]) => [[first, second], [second, first]]));

  const generated = useMemo(
    () =>
      generateSchedule({
        playersText,
        playersData,
        startTime,
        courts,
        rounds,
        minutesPerRound,
        estimatedMinutesPerRound,
        matchFormat,
        lockedPairs,
        courtNumbers: visibleCourtNumbers,
        mode,
        shuffleSeed,
      }),
    [playersText, playersData, startTime, courts, rounds, minutesPerRound, estimatedMinutesPerRound, matchFormat, lockedPairs, visibleCourtNumbers, mode, shuffleSeed]
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
    if (updates.name !== undefined && !updates.name.trim()) {
      setLockedPairs((current) => current.filter((pair) => !pair.includes(id)));
    }
  }

  function keepPairedWith(playerId, partnerId) {
    setLockedPairs((current) => {
      if (partnerId && current.some((pair) => pair.includes(partnerId) && !pair.includes(playerId))) return current;
      const remaining = current.filter((pair) => !pair.includes(playerId));
      return partnerId ? [...remaining, [playerId, partnerId]] : remaining;
    });
    setCopyStatus("idle");
  }

  function addPlayerRow() {
    setPlayerRows((current) => [...current, createBlankPlayer()]);
  }

  function removePlayerRow(id) {
    setLockedPairs((current) => current.filter((pair) => !pair.includes(id)));
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
    setEstimatedMinutesPerRound("30");
    setLockedPairs([]);
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
  const scheduleReady = playerCount > 0 && courtCount > 0 && parseOptionalPositiveInteger(rounds, 0, 0, 20) > 0 && mixedReady && generated.errors.length === 0;

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
                            aria-label={`Player ${index + 1} name`}
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
                              aria-label={`Player ${index + 1} gender`}
                              onChange={(event) => updatePlayerRow(row.id, { gender: event.target.value })}
                              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-slate-400 transition focus:ring-2"
                            >
                              <option value="">Select Male/Female</option>
                              <option value="male">Male</option>
                              <option value="female">Female</option>
                            </select>
                          </div>
                        ) : null}

                        {row.name.trim() ? (
                          <div className="mt-3 space-y-1">
                            <label htmlFor={`partner-${row.id}`} className="text-sm font-medium text-slate-700">Keep paired with</label>
                            <select
                              id={`partner-${row.id}`}
                              value={lockedPartnerById.get(row.id) || ""}
                              onChange={(event) => keepPairedWith(row.id, event.target.value)}
                              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-slate-400 transition focus:ring-2"
                            >
                              <option value="">Rotate partners</option>
                              {playersData.filter((player) => player.id !== row.id).map((player) => {
                                const pairedElsewhere = lockedPartnerById.has(player.id) && lockedPartnerById.get(player.id) !== row.id;
                                const mixedCompatible = (row.gender === "male" && player.gender === "female") || (row.gender === "female" && player.gender === "male");
                                return (
                                  <option key={player.id} value={player.id} disabled={pairedElsewhere || (isMixedMode && !mixedCompatible)}>
                                    {player.name}{pairedElsewhere ? " (already paired)" : isMixedMode && !mixedCompatible ? " (needs opposite gender)" : ""}
                                  </option>
                                );
                              })}
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
                <p className="text-sm text-slate-600">Choose a partner on either player's row to keep them together in every round, including after Shuffle. Both players wait if one arrives late. Choose Rotate partners to unlock them.</p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
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
                  <FieldLabel>Match format</FieldLabel>
                  <select
                    aria-label="Match format"
                    value={matchFormat}
                    onChange={(event) => setMatchFormat(event.target.value)}
                    className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-slate-400 transition focus:ring-2"
                  >
                    {MATCH_FORMATS.map((format) => <option key={format.value} value={format.value}>{format.label}</option>)}
                  </select>
                </div>
              </div>

              {matchFormat === "timed" ? (
                <div className="space-y-2">
                  <FieldLabel>Minutes / round</FieldLabel>
                  <input
                    type="number"
                    min="5"
                    max="180"
                    aria-label="Minutes per round"
                    value={minutesPerRound}
                    onChange={(event) => setMinutesPerRound(event.target.value)}
                    className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-slate-400 transition focus:ring-2"
                    placeholder="30"
                  />
                </div>
              ) : (
                <div className="space-y-3 rounded-2xl bg-slate-100 p-3 text-sm text-slate-700">
                  <p>{MATCH_FORMATS.find((format) => format.value === matchFormat)?.description} Start the next round when every court finishes.</p>
                  {hasLatePlayers ? (
                    <div className="space-y-2">
                      <label htmlFor="estimated-round-minutes" className="font-semibold">Estimated minutes / round</label>
                      <input
                        id="estimated-round-minutes"
                        type="number"
                        min="5"
                        max="180"
                        value={estimatedMinutesPerRound}
                        onChange={(event) => setEstimatedMinutesPerRound(event.target.value)}
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-slate-400 focus:ring-2"
                        placeholder="30"
                      />
                      <p>Used only to plan late arrivals; defaults to 30 minutes if blank. Update the estimate if play runs early or late.</p>
                    </div>
                  ) : null}
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
                <FieldLabel>Pairing mode</FieldLabel>
                <select
                  aria-label="Pairing mode"
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
                  <div className="text-lg font-bold">{generated.errors.length ? "Pairing issue" : scheduleReady ? "Ready" : "Missing Info"}</div>
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
                  <p className="text-sm text-slate-500">Copy and paste this into your group chat. Locked partners stay together while other partners rotate.</p>
                </div>
                <div className="rounded-full bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700">
                  {isMixedMode ? "Mixed doubles · " : ""}{getMatchFormatLabel(matchFormat)}
                </div>
              </div>

              {generated.errors.length > 0 ? (
                <div role="alert" className="mb-4 space-y-2 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">
                  {generated.errors.map((error, index) => <p key={index}>{error}</p>)}
                </div>
              ) : null}

              {generated.schedule[0]?.arrivalTimesEstimated ? (
                <p className="mb-4 rounded-2xl bg-slate-100 p-3 text-sm text-slate-700">Late arrivals are planned using {generated.schedule[0].minutesPerRound} minutes per round. Actual round lengths may vary; adjust the estimate if needed.</p>
              ) : null}

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
                  {generated.errors.length ? "Resolve the pairing issue above to generate your schedule." : "Fill in players, number of courts, court numbers, and rounds to generate a schedule."}
                </div>
              ) : (
                <div className="space-y-5">
                  {generated.schedule.map((round) => (
                    <section key={round.round} className="rounded-3xl border border-white/50 bg-white/70 p-4 shadow-sm">
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <h3 className="text-lg font-bold">Round {round.round}</h3>
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700">
                          {matchFormat === "timed" ? `${round.time} · ${round.minutesPerRound} min` : getMatchFormatLabel(matchFormat)}
                        </span>
                      </div>

                      <div className="grid gap-3">
                        {round.matches.length === 0 ? (
                          <div className="rounded-2xl bg-amber-50 p-3 text-sm text-amber-800">No match can be formed with the available players and selected pairing rules.</div>
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

                      {(round.sitOuts.length > 0 || round.notArrived.length > 0 || round.waitingForPartner.length > 0) && (
                        <div className="mt-3 grid gap-2 md:grid-cols-2">
                          {round.sitOuts.length > 0 && (
                            <div className="rounded-2xl bg-slate-100 p-3 text-sm">
                              <span className="font-semibold">Rotate / sit out: </span>
                              {round.sitOuts.map((player) => player.name).join(", ")}
                            </div>
                          )}

                          {round.waitingForPartner.length > 0 && (
                            <div className="rounded-2xl bg-amber-50 p-3 text-sm text-amber-900">
                              <span className="font-semibold">Waiting for partner: </span>
                              {round.waitingForPartner.map((player) => `${player.name} (waiting for ${player.partnerName})`).join(", ")}
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
