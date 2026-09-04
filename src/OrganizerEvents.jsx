import React, { useEffect, useMemo, useState } from "react";
import { Archive, ArchiveRestore, CalendarDays, Copy, CopyPlus, Download, ExternalLink, RefreshCw, Search, Trash2, UserPlus } from "lucide-react";
import { eventApi } from "./event-api.mjs";
import { downloadEventCsv } from "./exports.mjs";

function eventDate(value) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function eventStatus(event) {
  if (event.matches > 0 && event.completedMatches === event.matches) return "Completed";
  if (event.completedMatches > 0) return "In progress";
  return "Ready";
}

async function copyText(value) {
  if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(value);
  const input = document.createElement("textarea");
  input.value = value;
  document.body.appendChild(input);
  input.select();
  document.execCommand("copy");
  input.remove();
}

export default function OrganizerEvents({ getToken }) {
  const [events, setEvents] = useState([]);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [tab, setTab] = useState("active");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("newest");
  const [busyId, setBusyId] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    setStatus("loading");
    setError("");
    eventApi.mine(getToken, controller.signal)
      .then((data) => { setEvents(data.events); setStatus("ready"); })
      .catch((requestError) => {
        if (controller.signal.aborted) return;
        setError(requestError.message);
        setStatus("error");
      });
    return () => controller.abort();
  }, [getToken, refreshKey]);

  const visibleEvents = useMemo(() => {
    const query = search.trim().toLowerCase();
    return events
      .filter((event) => (tab === "archived") === Boolean(event.archivedAt))
      .filter((event) => !query || event.title.toLowerCase().includes(query))
      .slice()
      .sort((a, b) => sort === "oldest"
        ? new Date(a.createdAt) - new Date(b.createdAt)
        : new Date(b.createdAt) - new Date(a.createdAt));
  }, [events, search, sort, tab]);

  async function setArchived(event, action) {
    setBusyId(event.id);
    setError("");
    try {
      const data = await eventApi.setArchived(event.id, action, getToken);
      setEvents((current) => current.map((item) => item.id === event.id ? { ...item, archivedAt: data.archivedAt } : item));
      setNotice(action === "archive" ? "Event archived. Its shared link still works." : "Event restored.");
    } catch (requestError) { setError(requestError.message); }
    finally { setBusyId(""); }
  }

  async function duplicate(event) {
    setBusyId(event.id);
    setError("");
    try {
      await eventApi.duplicate(event.id, crypto.randomUUID(), getToken);
      setNotice("Event duplicated with a fresh results page.");
      setRefreshKey((value) => value + 1);
    } catch (requestError) { setError(requestError.message); }
    finally { setBusyId(""); }
  }

  async function remove(event) {
    if (!window.confirm(`Permanently delete “${event.title}” and all of its scores? Its shared link will stop working. This cannot be undone.`)) return;
    setBusyId(event.id);
    setError("");
    try {
      await eventApi.delete(event.id, getToken);
      setEvents((current) => current.filter((item) => item.id !== event.id));
      setNotice("Event and scores permanently deleted.");
    } catch (requestError) { setError(requestError.message); }
    finally { setBusyId(""); }
  }

  async function copyLink(event) {
    try {
      await copyText(`${window.location.origin}/events/${event.id}`);
      setNotice(`Link copied for ${event.title}.`);
    } catch { setError("Your browser blocked copying. Open the event and copy its link."); }
  }

  async function exportEvent(event) {
    setBusyId(event.id);
    setError("");
    try {
      downloadEventCsv(await eventApi.get(event.id));
      setNotice("CSV export downloaded.");
    } catch (requestError) { setError(requestError.message); }
    finally { setBusyId(""); }
  }

  async function inviteOrganizer(event) {
    setBusyId(event.id);
    setError("");
    try {
      const token = crypto.randomUUID();
      await eventApi.createInvite(event.id, token, getToken);
      await copyText(`${window.location.origin}/join/${token}`);
      setNotice("Secure co-organizer invitation copied. It expires in 7 days and can be used once.");
    } catch (requestError) { setError(requestError.message); }
    finally { setBusyId(""); }
  }

  const activeCount = events.filter((event) => !event.archivedAt).length;
  const archivedCount = events.length - activeCount;

  return (
    <section className="tennis-panel rounded-3xl p-6 shadow-2xl" aria-labelledby="my-events-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="my-events-heading" className="text-xl font-semibold">Organizer Dashboard</h2>
          <p className="mt-1 text-sm text-slate-600">Manage, reuse and export every event you publish.</p>
        </div>
        <button type="button" onClick={() => setRefreshKey((value) => value + 1)} disabled={status === "loading"} className="rounded-xl border border-slate-300 bg-white p-2 text-slate-700 transition hover:bg-slate-50 disabled:opacity-50" aria-label="Refresh my events">
          <RefreshCw className={`h-4 w-4 ${status === "loading" ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="mt-4 flex gap-1 rounded-xl bg-slate-100 p-1">
        <button type="button" onClick={() => setTab("active")} aria-pressed={tab === "active"} className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold ${tab === "active" ? "bg-white text-emerald-950 shadow-sm" : "text-slate-600"}`}>Active ({activeCount})</button>
        <button type="button" onClick={() => setTab("archived")} aria-pressed={tab === "archived"} className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold ${tab === "archived" ? "bg-white text-emerald-950 shadow-sm" : "text-slate-600"}`}>Archived ({archivedCount})</button>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
        <label className="relative">
          <span className="sr-only">Search events</span>
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search events" className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm" />
        </label>
        <select aria-label="Sort events" value={sort} onChange={(event) => setSort(event.target.value)} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm">
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
        </select>
      </div>

      {status === "loading" ? <p className="mt-4 text-sm text-slate-500">Loading your events…</p> : null}
      {error ? <p role="alert" className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{error}</p> : null}
      {notice ? <p role="status" className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">{notice}</p> : null}
      {status === "ready" && visibleEvents.length === 0 ? <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">{search ? "No events match your search." : tab === "active" ? "Your first published event will appear here." : "Archived events will appear here."}</p> : null}

      {visibleEvents.length ? <div className="mt-4 space-y-3">{visibleEvents.map((event) => {
        const progress = event.matches ? Math.round((event.completedMatches / event.matches) * 100) : 0;
        const busy = busyId === event.id;
        return (
          <article key={event.id} className="rounded-2xl border border-emerald-950/10 bg-emerald-50/70 p-4">
            <div className="flex items-start gap-3">
              <CalendarDays className="mt-0.5 h-5 w-5 shrink-0 text-emerald-800" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <a href={`/events/${event.id}`} className="truncate font-semibold text-emerald-950 hover:underline">{event.title}</a>
                  <div className="flex gap-1"><span className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-emerald-900">{eventStatus(event)}</span>{event.role === "co-organizer" ? <span className="rounded-full bg-lime-200 px-2 py-1 text-xs font-semibold text-emerald-950">Co-organizer</span> : null}</div>
                </div>
                <p className="mt-1 text-xs text-slate-600">{event.players} players · {event.completedMatches} of {event.matches} matches completed</p>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white"><div className="h-full rounded-full bg-lime-500" style={{ width: `${progress}%` }} /></div>
                <p className="mt-2 text-xs text-slate-500">Published {eventDate(event.createdAt)}</p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <a href={`/events/${event.id}`} className="inline-flex min-h-9 items-center gap-1 rounded-lg bg-emerald-950 px-3 py-2 text-xs font-semibold text-white"><ExternalLink className="h-3.5 w-3.5" /> Open</a>
              <button type="button" onClick={() => copyLink(event)} className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold"><Copy className="h-3.5 w-3.5" /> Link</button>
              <button type="button" onClick={() => duplicate(event)} disabled={busy} className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold disabled:opacity-50"><CopyPlus className="h-3.5 w-3.5" /> Duplicate</button>
              <button type="button" onClick={() => exportEvent(event)} disabled={busy} className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold disabled:opacity-50"><Download className="h-3.5 w-3.5" /> CSV</button>
              {event.role === "owner" ? <button type="button" onClick={() => inviteOrganizer(event)} disabled={busy} className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold disabled:opacity-50"><UserPlus className="h-3.5 w-3.5" /> Invite</button> : null}
              {event.role === "owner" && event.archivedAt ? <>
                <button type="button" onClick={() => setArchived(event, "restore")} disabled={busy} className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold disabled:opacity-50"><ArchiveRestore className="h-3.5 w-3.5" /> Restore</button>
                <button type="button" onClick={() => remove(event)} disabled={busy} className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-700 disabled:opacity-50"><Trash2 className="h-3.5 w-3.5" /> Delete</button>
              </> : event.role === "owner" ? <button type="button" onClick={() => setArchived(event, "archive")} disabled={busy} className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold disabled:opacity-50"><Archive className="h-3.5 w-3.5" /> Archive</button> : null}
            </div>
          </article>
        );
      })}</div> : null}
    </section>
  );
}
