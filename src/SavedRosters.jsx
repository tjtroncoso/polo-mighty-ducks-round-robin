import React, { useEffect, useState } from "react";
import { Plus, RefreshCw, Trash2, UserRoundCheck } from "lucide-react";
import { rosterApi } from "./event-api.mjs";

export default function SavedRosters({ getToken, playerRows, onLoadRoster }) {
  const [rosters, setRosters] = useState([]);
  const [name, setName] = useState("");
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const namedPlayers = playerRows.filter((player) => player.name.trim());

  useEffect(() => {
    const controller = new AbortController();
    setStatus("loading");
    rosterApi.list(getToken, controller.signal)
      .then((data) => { setRosters(data.rosters); setStatus("ready"); setError(""); })
      .catch((requestError) => { if (!controller.signal.aborted) { setError(requestError.message); setStatus("error"); } });
    return () => controller.abort();
  }, [getToken, refreshKey]);

  async function saveRoster() {
    if (!name.trim() || namedPlayers.length < 2) return;
    setStatus("saving");
    setError("");
    try {
      await rosterApi.save({
        id: crypto.randomUUID(),
        name: name.trim(),
        players: namedPlayers.map(({ id, name: playerName, gender }) => ({ id, name: playerName.trim(), gender })),
      }, getToken);
      setName("");
      setNotice("Roster saved.");
      setRefreshKey((value) => value + 1);
    } catch (requestError) { setError(requestError.message); setStatus("error"); }
  }

  async function removeRoster(roster) {
    if (!window.confirm(`Delete the saved roster “${roster.name}”? Published events will not be affected.`)) return;
    setError("");
    try {
      await rosterApi.delete(roster.id, getToken);
      setRosters((current) => current.filter((item) => item.id !== roster.id));
      setNotice("Roster deleted.");
    } catch (requestError) { setError(requestError.message); }
  }

  return (
    <section className="tennis-panel rounded-3xl p-6 shadow-2xl" aria-labelledby="saved-rosters-heading">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 id="saved-rosters-heading" className="flex items-center gap-2 text-xl font-semibold"><UserRoundCheck className="h-5 w-5" /> Saved Rosters</h2>
          <p className="mt-1 text-sm text-slate-600">Reuse player names and mixed-doubles gender selections.</p>
        </div>
        <button type="button" onClick={() => setRefreshKey((value) => value + 1)} disabled={status === "loading"} className="rounded-xl border border-slate-300 bg-white p-2" aria-label="Refresh saved rosters"><RefreshCw className={`h-4 w-4 ${status === "loading" ? "animate-spin" : ""}`} /></button>
      </div>
      <div className="mt-4 flex gap-2">
        <input value={name} onChange={(event) => setName(event.target.value)} maxLength={80} placeholder="Roster name" className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm" />
        <button type="button" onClick={saveRoster} disabled={!name.trim() || namedPlayers.length < 2 || status === "saving"} className="inline-flex items-center gap-1 rounded-xl bg-emerald-950 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"><Plus className="h-4 w-4" /> Save</button>
      </div>
      <p className="mt-2 text-xs text-slate-500">Enter at least two players below, name the group, then save it. Loading a roster resets arrivals and partner locks.</p>
      {error ? <p role="alert" className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{error}</p> : null}
      {notice ? <p role="status" className="mt-3 text-sm text-emerald-800">{notice}</p> : null}
      {status === "ready" && rosters.length === 0 ? <p className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">No saved rosters yet.</p> : null}
      {rosters.length ? <div className="mt-4 space-y-2">{rosters.map((roster) => (
        <div key={roster.id} className="flex items-center justify-between gap-3 rounded-2xl bg-emerald-50/70 p-3">
          <button type="button" onClick={() => { onLoadRoster(roster.players); setNotice(`${roster.name} loaded.`); }} className="min-w-0 flex-1 text-left"><span className="block truncate font-semibold text-emerald-950">{roster.name}</span><span className="text-xs text-slate-600">{roster.players.length} players · Load roster</span></button>
          <button type="button" onClick={() => removeRoster(roster)} className="rounded-xl p-2 text-slate-500 hover:bg-white hover:text-red-700" aria-label={`Delete ${roster.name}`}><Trash2 className="h-4 w-4" /></button>
        </div>
      ))}</div> : null}
    </section>
  );
}
