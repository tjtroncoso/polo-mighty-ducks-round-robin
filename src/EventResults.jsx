import React, { useEffect, useState } from "react";
import { ArrowLeft, Check, Copy, Pencil, Plus, RefreshCw, Trophy, X } from "lucide-react";
import { copyTextToClipboard } from "./App.jsx";
import { eventApi } from "./event-api.mjs";
import { buildStandings, mergeResults, resultOutcome, validateResult } from "./events.mjs";
import { getMatchFormatLabel } from "./scheduler.mjs";

const emptyResult = { status: "scheduled", scores: [], version: 0 };
const buttonClass = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-emerald-900/20 bg-white px-4 py-2 text-sm font-semibold text-emerald-950 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50";
const statusNames = { scheduled: "Not started", in_progress: "In progress", completed: "Completed" };

function scoreDraft(result) {
  return result.scores.length ? result.scores.map((score) => ({ ...score, a: String(score.a), b: String(score.b) })) : [{ a: "", b: "", kind: "games" }];
}

function ScoreForm({ eventId, match, format, names, latest, onSaved, onClose }) {
  const [scores, setScores] = useState(() => scoreDraft(latest));
  const [baseVersion, setBaseVersion] = useState(latest.version);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [conflictingResult, setConflictingResult] = useState(null);
  const [edited, setEdited] = useState(false);
  const newer = conflictingResult && conflictingResult.version > latest.version ? conflictingResult : latest;
  const conflict = newer.version !== baseVersion;

  useEffect(() => {
    if (!edited) return;
    const protectDraft = (event) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", protectDraft);
    return () => window.removeEventListener("beforeunload", protectDraft);
  }, [edited]);

  function changeScore(index, values) {
    setScores((current) => current.map((score, i) => i === index ? { ...score, ...values } : score));
    setEdited(true);
    setError("");
  }

  async function save(status) {
    if (saving || conflict) return;
    setError("");
    try {
      if (status !== "scheduled" && scores.some((score) => score.a === "" || score.b === "")) throw new Error("Enter a score for both sides, including zero.");
      const result = validateResult({ status, scores: scores.map((score) => ({ ...score, a: Number(score.a), b: Number(score.b) })) }, format);
      if (status === "scheduled" && !window.confirm("Clear this match’s score for everyone and return it to Not started?")) return;
      setSaving(true);
      const response = await eventApi.save(eventId, match.id, baseVersion, result);
      onSaved(match.id, response.result);
      onClose();
    } catch (saveError) {
      setError(saveError.message);
      if (saveError.current) setConflictingResult(saveError.current);
      setSaving(false);
    }
  }

  function loadLatest() {
    setScores(scoreDraft(newer));
    setBaseVersion(newer.version);
    setError("");
    setConflictingResult(null);
    setEdited(false);
    onSaved(match.id, newer);
  }

  return <form onSubmit={(event) => { event.preventDefault(); save("completed"); }} className="mt-4 space-y-4 border-t border-emerald-900/10 pt-4">
    <p className="text-sm text-slate-600">{format.type === "match" ? "Enter each full set. Add a match tiebreak if your group uses one to decide the match." : format.type === "timed" ? "Enter games won when time is up, or save the current score. Timed matches can finish in a draw." : format.type === "games" ? `Enter games won. The first side to ${format.gamesToWin} wins.` : "Enter the set’s game score. A set tiebreak is recorded as 7–6."}</p>
    <fieldset disabled={saving} className="space-y-3">
      <legend className="sr-only">Scores for {names(match.pairA)} versus {names(match.pairB)}</legend>
      {scores.map((score, index) => <div key={index} className="rounded-xl bg-white p-3">
        {format.type === "match" && <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-semibold">Set {index + 1}</span>
          <div className="flex items-center gap-2">
            {index === scores.length - 1 && index > 0 && <select aria-label={`Scoring for set ${index + 1}`} value={score.kind} onChange={(event) => changeScore(index, { kind: event.target.value })} className="min-h-11 max-w-44 rounded-lg border border-slate-300 px-2 text-sm"><option value="games">Full set</option><option value="tiebreak">Match tiebreak</option></select>}
            {index > 0 && index === scores.length - 1 && <button type="button" className="p-3 text-slate-600" aria-label={`Remove set ${index + 1}`} onClick={() => { setScores((current) => current.slice(0, -1)); setEdited(true); }}><X size={18} /></button>}
          </div>
        </div>}
        <div className="grid grid-cols-2 gap-3">
          {["a", "b"].map((side) => <label key={side} className="flex min-w-0 flex-col justify-end gap-2 text-sm font-semibold text-emerald-950">
            <span className="break-words">{names(side === "a" ? match.pairA : match.pairB)}</span>
            <input type="number" inputMode="numeric" min="0" max={format.type === "games" ? format.gamesToWin : 99} step="1" value={score[side]} onChange={(event) => changeScore(index, { [side]: event.target.value })} aria-label={`${names(side === "a" ? match.pairA : match.pairB)}, ${format.type === "match" ? `set ${index + 1}, ` : ""}${score.kind === "tiebreak" ? "points" : "games"}`} className="w-full rounded-xl border border-slate-300 bg-slate-50 p-3 text-center text-3xl font-bold tabular-nums focus:outline-emerald-700" placeholder="0" />
          </label>)}
        </div>
        <p className="mt-2 text-center text-xs text-slate-500">{score.kind === "tiebreak" ? "Tiebreak points · first to 10, win by two" : "Games won"}</p>
      </div>)}
      {format.type === "match" && scores.length < 5 && scores.at(-1).kind !== "tiebreak" && <button type="button" className={buttonClass} onClick={() => { setScores((current) => [...current, { a: "", b: "", kind: "games" }]); setEdited(true); }}><Plus size={16} /> Add set</button>}
    </fieldset>
    {conflict && <div role="alert" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-950">
      <p className="font-semibold">Another person updated this match.</p>
      <p className="mt-1">Latest: {statusNames[newer.status]}{newer.scores.length ? ` · ${newer.scores.map((score) => `${score.a}–${score.b}${score.kind === "tiebreak" ? " (TB)" : ""}`).join(", ")}` : ""}. Load that score before making a correction.</p>
      <button type="button" onClick={loadLatest} className={`${buttonClass} mt-2`}>Load latest score</button>
    </div>}
    {error && <p role="alert" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{error}</p>}
    <div className="flex flex-wrap gap-2">
      <button type="submit" disabled={saving || conflict} className={`${buttonClass} !bg-emerald-950 !text-white`}><Check size={16} /> {saving ? "Saving…" : "Save final score"}</button>
      <button type="button" disabled={saving || conflict} className={buttonClass} onClick={() => save("in_progress")}>Save progress</button>
      <button type="button" disabled={saving} className={buttonClass} onClick={onClose}>Cancel</button>
    </div>
    {latest.status !== "scheduled" && <button type="button" disabled={saving || conflict} className="min-h-11 text-sm text-slate-600 underline disabled:opacity-50" onClick={() => save("scheduled")}>Clear score / reset match</button>}
  </form>;
}

function MatchCard({ eventId, match, format, names, result = emptyResult, onSaved }) {
  const [editing, setEditing] = useState(false);
  const winner = result.status === "completed" ? resultOutcome(result, format).winner : null;
  return <article className="rounded-2xl border border-emerald-900/10 bg-emerald-950/5 p-4">
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
      <h3 className="font-bold text-emerald-950">{match.court} <span className="font-normal text-slate-500">· {match.type}</span></h3>
      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${result.status === "completed" ? "bg-emerald-100 text-emerald-900" : result.status === "in_progress" ? "bg-lime-200 text-emerald-950" : "bg-white text-slate-600"}`}>{statusNames[result.status]}</span>
    </div>
    <div className="space-y-2">
      {[["a", match.pairA], ["b", match.pairB]].map(([side, ids]) => <div key={side} className="flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-3">
        <span className="min-w-0 break-words font-semibold">{names(ids)}{winner === side && <Check className="ml-2 inline text-emerald-700" size={16} aria-label="Winner" />}</span>
        <span className="flex shrink-0 gap-3 text-xl font-bold tabular-nums text-emerald-950">
          {result.scores.length ? result.scores.map((score, index) => <span key={index} title={score.kind === "tiebreak" ? "Match tiebreak points" : `Set ${index + 1} games`}>{score.kind === "tiebreak" ? `[${score[side]}]` : score[side]}</span>) : "—"}
        </span>
      </div>)}
    </div>
    {winner === "draw" && <p className="mt-2 text-sm font-semibold text-slate-600">Draw</p>}
    {result.updatedAt && <p className="mt-2 text-xs text-slate-500">Saved {new Date(result.updatedAt).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</p>}
    {editing ? <ScoreForm eventId={eventId} match={match} format={format} names={names} latest={result} onSaved={onSaved} onClose={() => setEditing(false)} /> : <button type="button" className={`${buttonClass} mt-4 w-full`} onClick={() => setEditing(true)}><Pencil size={16} /> {result.status === "scheduled" ? "Enter score" : "Edit score"}</button>}
  </article>;
}

function Standings({ snapshot, results }) {
  const [teams, setTeams] = useState(false);
  const rows = buildStandings(snapshot, results, teams);
  return <section className="tennis-panel rounded-3xl p-5 shadow-xl md:p-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="flex items-center gap-2 text-xl font-bold text-emerald-950"><Trophy size={22} /> Standings</h2>
      {snapshot.lockedPairs.length > 0 && <div className="flex gap-1 rounded-xl bg-slate-100 p-1"><button type="button" aria-pressed={!teams} onClick={() => setTeams(false)} className={`min-h-11 rounded-lg px-3 text-sm font-semibold ${!teams ? "bg-white shadow-sm" : ""}`}>Players</button><button type="button" aria-pressed={teams} onClick={() => setTeams(true)} className={`min-h-11 rounded-lg px-3 text-sm font-semibold ${teams ? "bg-white shadow-sm" : ""}`}>Locked pairs</button></div>}
    </div>
    <p className="mt-2 text-sm text-slate-600">Completed matches only. Win = 2 points; draw = 1. Ties use game difference, then games won. {teams ? "Only locked partnerships appear here." : "Doubles results count for both partners."}</p>
    <div className="mt-4 overflow-x-auto">
      <table className="w-full text-left text-sm tabular-nums">
        <caption className="sr-only">{teams ? "Locked pair" : "Player"} standings</caption>
        <thead className="border-b border-emerald-900/15 text-xs text-slate-500"><tr>{[teams ? "Pair" : "Player", "Played", "W", "L", "D", "Games +/−", "Pts"].map((label) => <th key={label} scope="col" className="whitespace-nowrap px-3 py-3 first:pl-0">{label}</th>)}</tr></thead>
        <tbody>{rows.map((row) => <tr key={row.id} className="border-b border-slate-100 last:border-0"><th scope="row" className="min-w-32 py-3 pr-3 font-semibold text-emerald-950">{row.name}</th><td className="px-3 py-3">{row.played}</td><td className="px-3 py-3">{row.wins}</td><td className="px-3 py-3">{row.losses}</td><td className="px-3 py-3">{row.draws}</td><td className="whitespace-nowrap px-3 py-3">{row.gamesFor}–{row.gamesAgainst} <span className="text-slate-500">({row.gamesFor - row.gamesAgainst > 0 ? "+" : ""}{row.gamesFor - row.gamesAgainst})</span></td><td className="px-3 py-3 font-bold">{row.points}</td></tr>)}</tbody>
      </table>
    </div>
    {snapshot.format.type === "match" && <p className="mt-3 text-xs text-slate-500">Match tiebreak points decide the winning set and do not count as games.</p>}
  </section>;
}

export default function EventResults({ eventId }) {
  const [event, setEvent] = useState(null);
  const [error, setError] = useState("");
  const [loadedAt, setLoadedAt] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [copyStatus, setCopyStatus] = useState("");
  const [notice, setNotice] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    let loading = false;
    async function load() {
      if (loading || document.hidden) return;
      loading = true;
      try {
        const latest = await eventApi.get(eventId, controller.signal);
        if (controller.signal.aborted) return;
        setEvent((current) => current ? { ...latest, results: mergeResults(current.results, latest.results) } : latest);
        setError("");
        setLoadedAt(new Date());
      } catch (loadError) {
        if (!controller.signal.aborted) setError(loadError.message);
      } finally { loading = false; }
    }
    load();
    const interval = window.setInterval(load, 15000);
    window.addEventListener("focus", load);
    window.addEventListener("online", load);
    document.addEventListener("visibilitychange", load);
    return () => {
      controller.abort();
      window.clearInterval(interval);
      window.removeEventListener("focus", load);
      window.removeEventListener("online", load);
      document.removeEventListener("visibilitychange", load);
    };
  }, [eventId, refreshKey]);

  useEffect(() => {
    const previous = document.title;
    if (event) document.title = `${event.snapshot.title} · Results`;
    return () => { document.title = previous; };
  }, [event?.snapshot.title]);

  async function copyLink() {
    try { await copyTextToClipboard(window.location.href); setCopyStatus("Link copied"); }
    catch { setCopyStatus("Select and copy the event link below."); }
  }

  function saved(matchId, result) {
    setEvent((current) => ({ ...current, results: mergeResults(current.results, { [matchId]: result }) }));
    setNotice("Score updated. Standings are up to date.");
  }

  const snapshot = event?.snapshot;
  const namesById = new Map(snapshot?.players.map((player) => [player.id, player.name]) || []);
  const names = (ids) => ids.map((id) => namesById.get(id)).join(" / ");
  const total = snapshot?.rounds.reduce((sum, round) => sum + round.matches.length, 0) || 0;
  const completed = Object.values(event?.results || {}).filter((result) => result.status === "completed").length;

  return <div className="tennis-app relative min-h-screen overflow-hidden p-4 text-slate-950 md:p-8">
    <div className="tennis-backdrop" aria-hidden="true" />
    <main className="relative z-10 mx-auto max-w-5xl space-y-6">
      <header className="tennis-header rounded-3xl p-6 shadow-2xl md:p-8">
        <a href="/" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-emerald-900"><ArrowLeft size={16} /> Create another event</a>
        <p className="mt-3 text-xs font-bold uppercase tracking-widest text-emerald-800">Published lineup · Shared results</p>
        <h1 className="mt-2 max-w-2xl break-words text-3xl font-bold text-emerald-950 md:text-5xl">{snapshot?.title || "Event results"}</h1>
        <p className="mt-3 max-w-xl text-slate-700">Players and organizers can enter scores here. Anyone with this link can edit results.</p>
        {snapshot && <div className="mt-4 flex flex-wrap gap-2 text-sm font-semibold"><span className="rounded-full bg-white px-3 py-2">{getMatchFormatLabel(snapshot.format.type, snapshot.format.gamesToWin)}{snapshot.format.type === "timed" ? ` · ${snapshot.format.minutesPerRound} min` : ""}</span><span className="rounded-full bg-lime-200 px-3 py-2">{completed} of {total} matches completed</span></div>}
      </header>
      <section className="tennis-panel rounded-3xl p-5 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-bold">Share with your group</h2><p className="text-sm text-slate-600">Save this link to return to the event.</p></div><button type="button" onClick={copyLink} className={buttonClass}><Copy size={16} /> {copyStatus === "Link copied" ? "Link copied" : "Copy event link"}</button></div>
        <input aria-label="Event link" readOnly value={window.location.href} onFocus={(e) => e.target.select()} className="mt-3 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600" />
        {copyStatus && <p role="status" className="mt-2 text-sm text-emerald-800">{copyStatus}</p>}
      </section>
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-emerald-950/90 px-4 py-2 text-sm text-white">
        <span>{loadedAt ? `Updates every 15 seconds · Last checked ${loadedAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : error ? "Unable to load this event" : "Loading saved lineup and scores…"}</span><button type="button" onClick={() => setRefreshKey((key) => key + 1)} className="inline-flex min-h-11 items-center gap-2 font-semibold"><RefreshCw size={16} /> Refresh</button>
      </div>
      {error && <p role="alert" className="rounded-2xl bg-amber-50 p-4 text-amber-900">{error}{event && " Showing the last loaded scores."}</p>}
      <p role="status" className="sr-only">{notice}</p>
      {snapshot && <>
        <div className="flex flex-wrap gap-2"><a href="#rounds" className={buttonClass}>Enter results</a><a href="#standings" className={buttonClass}>View standings</a></div>
        <div id="rounds" className="space-y-5">
          {snapshot.rounds.map((round) => <section key={round.number} className="tennis-panel rounded-3xl p-5 shadow-xl md:p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2"><h2 className="text-xl font-bold text-emerald-950">Round {round.number}</h2>{snapshot.format.type === "timed" && <span className="text-sm font-semibold text-slate-600">{round.time}</span>}</div>
            <div className="grid items-start gap-4 md:grid-cols-2">{round.matches.map((match) => <MatchCard key={match.id} eventId={eventId} match={match} format={snapshot.format} names={names} result={event.results[match.id]} onSaved={saved} />)}</div>
            {!round.matches.length && <p className="text-sm text-slate-600">No matches scheduled this round.</p>}
            {round.sitOuts.length > 0 && <p className="mt-3 text-sm text-slate-600"><strong>Sitting out:</strong> {names(round.sitOuts)}</p>}
            {round.notArrived.length > 0 && <p className="mt-3 text-sm text-slate-600"><strong>Not arrived yet:</strong> {round.notArrived.map((id) => `${namesById.get(id)} (${snapshot.players.find((player) => player.id === id).arrival})`).join(", ")}</p>}
            {round.waitingForPartner.length > 0 && <p className="mt-3 text-sm text-slate-600"><strong>Waiting for partner:</strong> {round.waitingForPartner.map((entry) => `${namesById.get(entry.playerId)} (waiting for ${entry.partnerName})`).join(", ")}</p>}
          </section>)}
        </div>
        {snapshot.rounds.some((round) => round.arrivalTimesEstimated) && <p className="rounded-xl bg-white/95 p-4 text-sm text-slate-600">Late arrivals were planned using an estimate of {snapshot.format.minutesPerRound} minutes per round. Non-timed rounds start when the courts finish.</p>}
        <div id="standings"><Standings snapshot={snapshot} results={event.results} /></div>
      </>}
    </main>
  </div>;
}
