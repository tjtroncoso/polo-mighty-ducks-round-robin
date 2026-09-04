import { buildPlayersTextFromRows, buildPlayersFromRows, parseOptionalPositiveInteger, parsePlayers, generateSchedule, buildCopyText, MATCH_FORMATS, getMatchFormatLabel } from "./scheduler.mjs";
import React, { useMemo, useRef, useState } from "react";
import { Copy, Plus, RefreshCw, Shuffle, Trash2, Users } from "lucide-react";
import { createSnapshot } from "./events.mjs";
import { eventApi } from "./event-api.mjs";
import { getSetupIssues } from "./setup-status.mjs";

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

const createBlankPlayers = (count = 4) => Array.from({ length: count }, createBlankPlayer);

export function copyTextToClipboard(text) {
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
  return <div className={`tennis-panel rounded-3xl shadow-2xl ${className}`}>{children}</div>;
}

function normalizeCourtNumbers(existingNumbers, courtCount) {
  return Array.from({ length: courtCount }, (_, index) => existingNumbers[index] || "");
}

export default function TennisRoundRobinGenerator() {
  const [playerRows, setPlayerRows] = useState(() => createBlankPlayers());
  const [startTime, setStartTime] = useState("");
  const [courts, setCourts] = useState("");
  const [rounds, setRounds] = useState("");
  const [minutesPerRound, setMinutesPerRound] = useState("");
  const [estimatedMinutesPerRound, setEstimatedMinutesPerRound] = useState("30");
  const [matchFormat, setMatchFormat] = useState("timed");
  const [gamesToWin, setGamesToWin] = useState("3");
  const [lockedPairs, setLockedPairs] = useState([]);
  const [courtNumbers, setCourtNumbers] = useState([]);
  const [mode, setMode] = useState("doubles");
  const [copyStatus, setCopyStatus] = useState("idle");
  const [shuffleSeed, setShuffleSeed] = useState(1);
  const [eventTitle, setEventTitle] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState("");
  const publicationRef = useRef(null);
  const outputRef = useRef(null);

  const courtCount = parseOptionalPositiveInteger(courts, 0, 0, 50);
  const visibleCourtNumbers = useMemo(() => normalizeCourtNumbers(courtNumbers, courtCount), [courtNumbers, courtCount]);
  const playersText = useMemo(() => buildPlayersTextFromRows(playerRows), [playerRows]);
  const playersData = useMemo(() => buildPlayersFromRows(playerRows, startTime || "7:00 PM"), [playerRows, startTime]);
  const isMixedMode = mode === "mixed";
  const isSinglesMode = mode === "singles";
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
        gamesToWin,
        lockedPairs,
        courtNumbers: visibleCourtNumbers,
        mode,
        shuffleSeed,
      }),
    [playersText, playersData, startTime, courts, rounds, minutesPerRound, estimatedMinutesPerRound, matchFormat, gamesToWin, lockedPairs, visibleCourtNumbers, mode, shuffleSeed]
  );

  const copyText = useMemo(() => buildCopyText(generated.schedule, matchFormat), [generated.schedule, matchFormat]);

  async function publishEvent() {
    if (publishing) return;
    setPublishing(true);
    setPublishError("");
    try {
      const snapshot = createSnapshot({ title: eventTitle, players: playersData, schedule: generated.schedule, matchFormat, lockedPairs: isSinglesMode ? [] : lockedPairs });
      const fingerprint = JSON.stringify(snapshot);
      // Reuse the ID if a response was lost after the database committed.
      if (publicationRef.current?.fingerprint !== fingerprint) publicationRef.current = { id: crypto.randomUUID(), fingerprint };
      const { id } = await eventApi.publish(publicationRef.current.id, snapshot);
      window.location.assign(`/events/${id}`);
    } catch (error) {
      setPublishError(error.message);
      setPublishing(false);
    }
  }

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
    setPlayerRows(createBlankPlayers());
    setStartTime("");
    setCourts("");
    setRounds("");
    setMinutesPerRound("");
    setEstimatedMinutesPerRound("30");
    setLockedPairs([]);
    setCourtNumbers([]);
    setMatchFormat("timed");
    setGamesToWin("3");
    setMode("doubles");
    setCopyStatus("idle");
    setShuffleSeed(1);
    setEventTitle("");
    setPublishError("");
    publicationRef.current = null;
  }

  const playerCount = parsePlayers(playersText, startTime).length;
  const maleCount = playersData.filter((player) => player.gender === "male").length;
  const femaleCount = playersData.filter((player) => player.gender === "female").length;
  const mixedReady = !isMixedMode || (maleCount >= 2 && femaleCount >= 2);
  const setupIssues = getSetupIssues({ playerRows, startTime, matchFormat, minutesPerRound, gamesToWin, courts, rounds, mode });
  const hasPlayableMatch = generated.schedule.some((round) => round.matches.length > 0);
  if (setupIssues.length === 0 && generated.errors.length === 0 && !hasPlayableMatch) {
    setupIssues.push({ targetId: "players-section", label: "No playable match—check arrival times and locked pairs" });
  }
  const scheduleReady = setupIssues.length === 0 && generated.errors.length === 0 && mixedReady && hasPlayableMatch;

  function focusSetupField(targetId) {
    const target = document.getElementById(targetId);
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "center" });
    window.setTimeout(() => target.focus({ preventScroll: true }), 350);
  }

  return (
    <div className="tennis-app relative min-h-screen overflow-hidden p-4 text-slate-950 md:p-8">
      <div className="tennis-backdrop" aria-hidden="true" />

      <div className="relative z-10 mx-auto max-w-7xl space-y-6">
        <header className="tennis-header rounded-3xl p-6 shadow-2xl md:p-8">
          <h1 className="max-w-2xl text-3xl font-bold tracking-tight text-emerald-950 md:text-5xl">Tennis Round Robin Generator</h1>
          <p className="mt-3 max-w-xl text-base text-slate-700 md:text-lg">
            Enter your players, courts, and round settings. Share a schedule or publish an event so everyone can enter results.
          </p>
        </header>

        <div className="grid gap-6 lg:grid-cols-[460px_1fr]">
          <Panel className="p-6">
            <div className="mb-5 flex items-center gap-2">
              <Users className="h-5 w-5" />
              <h2 className="text-xl font-semibold">Setup</h2>
            </div>

            <div className="space-y-5">
              <div className="space-y-2">
                <FieldLabel>Pairing mode</FieldLabel>
                <select
                  aria-label="Pairing mode"
                  value={mode}
                  onChange={(event) => {
                    const nextMode = event.target.value;
                    setMode(nextMode);
                    if (nextMode === "singles") setLockedPairs([]);
                  }}
                  className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-slate-400 transition focus:ring-2"
                >
                  <option value="doubles">Doubles</option>
                  <option value="mixed">Mixed Doubles</option>
                  <option value="singles">Singles</option>
                </select>
              </div>

              <div id="players-section" className="space-y-3" tabIndex={-1}>
                <div className="flex items-center justify-between gap-3">
                  <FieldLabel>Players</FieldLabel>
                  <button
                    id="add-player"
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
                            id={`player-name-${row.id}`}
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
                              id={`gender-${row.id}`}
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

                        {row.name.trim() && !isSinglesMode ? (
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
                              id={`late-toggle-${row.id}`}
                              type="checkbox"
                              checked={row.isLate}
                              onChange={(event) => updatePlayerRow(row.id, { isLate: event.target.checked, arrival: event.target.checked ? row.arrival : "" })}
                              className="h-4 w-4 rounded border-slate-300"
                            />
                            Late arrival
                          </label>

                          {row.isLate ? (
                            <input
                              id={`arrival-${row.id}`}
                              type="time"
                              step="300"
                              value={row.arrival}
                              onChange={(event) => updatePlayerRow(row.id, { arrival: event.target.value })}
                              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-slate-400 transition focus:ring-2 sm:w-36"
                              aria-label={`${row.name.trim() || `Player ${index + 1}`} arrival time`}
                            />
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <p className="text-xs text-slate-500">Add one player per row. Check late arrival only for players arriving after the start time.</p>
                {!isSinglesMode ? (
                  <p className="text-sm text-slate-600">Choose a partner on either player's row to keep them together in every round, including after Shuffle. Both players wait if one arrives late. Choose Rotate partners to unlock them.</p>
                ) : null}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <FieldLabel>Start time</FieldLabel>
                  <input
                    id="start-time"
                    type="time"
                    step="300"
                    value={startTime}
                    onChange={(event) => setStartTime(event.target.value)}
                    className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-slate-400 transition focus:ring-2"
                  />
                  <p className="text-xs text-slate-500">Click the time control or type a time. Use the arrows and AM/PM selector where shown by your browser.</p>
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

              {matchFormat === "games" ? (
                <div className="space-y-2">
                  <label htmlFor="games-to-win" className="text-sm font-semibold text-slate-700">Games to win</label>
                  <input
                    id="games-to-win"
                    type="number"
                    min="1"
                    max="99"
                    step="1"
                    value={gamesToWin}
                    onChange={(event) => setGamesToWin(event.target.value)}
                    onBlur={() => setGamesToWin(String(parseOptionalPositiveInteger(gamesToWin, 3, 1, 99)))}
                    className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-slate-400 transition focus:ring-2"
                    placeholder="3"
                  />
                </div>
              ) : null}

              {matchFormat === "timed" ? (
                <div className="space-y-2">
                  <FieldLabel>Minutes / round</FieldLabel>
                  <input
                    id="minutes-per-round"
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
                    id="courts"
                    type="number"
                    min="1"
                    max="50"
                    value={courts}
                    onChange={(event) => {
                      const value = event.target.value;
                      setCourts(value);
                      setCourtNumbers((current) => normalizeCourtNumbers(current, parseOptionalPositiveInteger(value, 0, 0, 50)));
                    }}
                    className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-slate-400 transition focus:ring-2"
                    placeholder="3"
                  />
                </div>

                <div className="space-y-2">
                  <FieldLabel>Rounds</FieldLabel>
                  <input
                    id="rounds"
                    type="number"
                    min="1"
                    max="50"
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
                  <div className="text-lg font-bold">{generated.errors.length ? "Pairing issue" : scheduleReady ? "Ready" : "Needs attention"}</div>
                </div>
              </div>

              {!scheduleReady ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950" role="status" aria-live="polite">
                  <div className="font-bold">Complete these items:</div>
                  <ul className="mt-2 space-y-1.5">
                    {setupIssues.map((issue) => (
                      <li key={`${issue.targetId}-${issue.label}`}>
                        <button type="button" onClick={() => focusSetupField(issue.targetId)} className="min-h-8 text-left font-medium underline decoration-amber-500 underline-offset-2 hover:text-emerald-900">
                          {issue.label}
                        </button>
                      </li>
                    ))}
                    {generated.errors.map((error, index) => (
                      <li key={`${index}-${error}`}>
                        <button type="button" onClick={() => focusSetupField("players-section")} className="min-h-8 text-left font-medium underline decoration-amber-500 underline-offset-2 hover:text-emerald-900">
                          {error}
                        </button>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-xs text-amber-800">Select an item to jump to the field that needs attention.</p>
                </div>
              ) : null}

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
              <h2 className="text-xl font-semibold">Ready to play?</h2>
              <p className="mt-2 text-sm text-slate-600">Publish this lineup to save it and get a shared results page. Anyone with the link can enter and correct scores—no account needed.</p>
              <label className="mt-4 block text-sm font-semibold" htmlFor="event-title">Event name <span className="font-normal text-slate-500">(optional)</span></label>
              <input id="event-title" maxLength={120} value={eventTitle} onChange={(event) => setEventTitle(event.target.value)} placeholder="Saturday morning tennis" className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm" />
              <button type="button" onClick={publishEvent} disabled={publishing || !scheduleReady || !generated.schedule.some((round) => round.matches.length)} className="mt-4 w-full rounded-2xl bg-emerald-950 px-4 py-3 font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50">
                {publishing ? "Publishing lineup…" : "Publish lineup & track results"}
              </button>
              <p className="mt-2 text-xs text-slate-500">Publishing fixes the lineup for this event. Changes to the generator are saved only when you publish a new event.</p>
              {publishError && <p role="alert" className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{publishError}</p>}
            </Panel>
            <Panel className="p-6">
              <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-2xl font-semibold">Generated Schedule</h2>
                  <p className="text-sm text-slate-500">{isSinglesMode ? "Copy and paste this into your group chat. Players rotate through singles opponents and sit-outs." : "Copy and paste this into your group chat. Locked partners stay together while other partners rotate."}</p>
                </div>
                <div className="rounded-full bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700">
                  {isMixedMode ? "Mixed Doubles · " : isSinglesMode ? "Singles · " : "Doubles · "}{getMatchFormatLabel(matchFormat, gamesToWin)}
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
                          {matchFormat === "timed" ? `${round.time} · ${round.minutesPerRound} min` : getMatchFormatLabel(matchFormat, round.gamesToWin)}
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
