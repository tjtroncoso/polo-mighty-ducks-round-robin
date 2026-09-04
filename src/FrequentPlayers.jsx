import React, { useEffect, useMemo, useState } from "react";
import { Plus, RefreshCw, Save, Search, Trash2, UserRoundCheck, UsersRound } from "lucide-react";
import { frequentPlayerApi } from "./event-api.mjs";

function normalizedName(value) {
  return value.trim().toLowerCase();
}

export default function FrequentPlayers({ getToken, playerRows, onAddPlayers }) {
  const [players, setPlayers] = useState([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const namedPlayers = playerRows.filter((player) => player.name.trim());
  const currentNames = new Set(namedPlayers.map((player) => normalizedName(player.name)));
  const visiblePlayers = useMemo(() => {
    const query = players.length > 6 ? normalizedName(search) : "";
    return query ? players.filter((player) => normalizedName(player.name).includes(query)) : players;
  }, [players, search]);
  const availablePlayers = players.filter((player) => !currentNames.has(normalizedName(player.name)));

  useEffect(() => {
    const controller = new AbortController();
    setStatus("loading");
    frequentPlayerApi.list(getToken, controller.signal)
      .then((data) => { setPlayers(data.players); setStatus("ready"); setError(""); })
      .catch((requestError) => { if (!controller.signal.aborted) { setError(requestError.message); setStatus("error"); } });
    return () => controller.abort();
  }, [getToken, refreshKey]);

  async function saveCurrentPlayers() {
    const uniquePlayers = new Map();
    for (const player of namedPlayers) {
      const name = player.name.trim();
      const key = normalizedName(name);
      if (!uniquePlayers.has(key)) uniquePlayers.set(key, { id: crypto.randomUUID(), name, gender: player.gender || "" });
    }
    if (!uniquePlayers.size) return;
    setStatus("saving");
    setError("");
    try {
      const data = await frequentPlayerApi.save({ players: [...uniquePlayers.values()] }, getToken);
      setPlayers(data.players);
      setStatus("ready");
      setNotice(`${uniquePlayers.size} player${uniquePlayers.size === 1 ? "" : "s"} saved.`);
    } catch (requestError) { setError(requestError.message); setStatus("error"); }
  }

  function addPlayers(selected) {
    onAddPlayers(selected);
    setNotice(`${selected.length} player${selected.length === 1 ? "" : "s"} added to this event.`);
  }

  async function removePlayer(player) {
    if (!window.confirm(`Remove ${player.name} from frequent players? Published events will not be affected.`)) return;
    setError("");
    try {
      await frequentPlayerApi.delete(player.id, getToken);
      setPlayers((current) => current.filter((item) => item.id !== player.id));
      setNotice(`${player.name} removed from frequent players.`);
    } catch (requestError) { setError(requestError.message); }
  }

  return (
    <section className="tennis-panel rounded-3xl p-6 shadow-2xl" aria-labelledby="frequent-players-heading">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="frequent-players-heading" className="flex items-center gap-2 text-xl font-semibold"><UserRoundCheck className="h-5 w-5" /> Frequent Players</h2>
          <p className="mt-1 text-sm text-slate-600">Build new events from the people you play with most.</p>
        </div>
        <button type="button" onClick={() => setRefreshKey((value) => value + 1)} disabled={status === "loading"} className="rounded-xl border border-slate-300 bg-white p-2" aria-label="Refresh frequent players"><RefreshCw className={`h-4 w-4 ${status === "loading" ? "animate-spin" : ""}`} /></button>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <button type="button" onClick={saveCurrentPlayers} disabled={!namedPlayers.length || status === "saving"} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-950 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"><Save className="h-4 w-4" /> Save current players</button>
        <button type="button" onClick={() => addPlayers(availablePlayers)} disabled={!availablePlayers.length} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold disabled:opacity-50"><UsersRound className="h-4 w-4" /> Add all available</button>
      </div>
      <p className="mt-2 text-xs text-slate-500">Saving updates existing names instead of creating duplicates. Gender selections are remembered for Mixed Doubles.</p>

      {players.length > 6 ? <label className="relative mt-4 block"><span className="sr-only">Search frequent players</span><Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search frequent players" className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm" /></label> : null}
      {error ? <p role="alert" className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{error}</p> : null}
      {notice ? <p role="status" className="mt-3 text-sm text-emerald-800">{notice}</p> : null}
      {status === "ready" && players.length === 0 ? <p className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">No frequent players yet. Enter names in Setup, then select Save current players.</p> : null}
      {players.length && visiblePlayers.length === 0 ? <p className="mt-4 text-sm text-slate-600">No players match that search.</p> : null}

      {visiblePlayers.length ? <div className="mt-4 space-y-2">{visiblePlayers.map((player) => {
        const alreadyAdded = currentNames.has(normalizedName(player.name));
        return (
          <div key={player.id} className="flex items-center gap-2 rounded-2xl bg-emerald-50/70 p-3">
            <div className="min-w-0 flex-1"><span className="block truncate font-semibold text-emerald-950">{player.name}</span>{player.gender ? <span className="text-xs capitalize text-slate-600">{player.gender}</span> : <span className="text-xs text-slate-500">No gender selected</span>}</div>
            <button type="button" onClick={() => addPlayers([player])} disabled={alreadyAdded} className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold disabled:opacity-50"><Plus className="h-3.5 w-3.5" /> {alreadyAdded ? "Added" : "Add"}</button>
            <button type="button" onClick={() => removePlayer(player)} className="rounded-xl p-2 text-slate-500 hover:bg-white hover:text-red-700" aria-label={`Remove ${player.name} from frequent players`}><Trash2 className="h-4 w-4" /></button>
          </div>
        );
      })}</div> : null}
    </section>
  );
}
