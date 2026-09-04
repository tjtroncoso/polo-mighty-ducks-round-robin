import React, { useEffect, useState } from "react";
import { CalendarDays, RefreshCw } from "lucide-react";
import { eventApi } from "./event-api.mjs";

function eventDate(value) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default function OrganizerEvents({ getToken }) {
  const [events, setEvents] = useState([]);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setStatus("loading");
    setError("");
    eventApi.mine(getToken, controller.signal)
      .then((data) => {
        setEvents(data.events);
        setStatus("ready");
      })
      .catch((requestError) => {
        if (controller.signal.aborted) return;
        setError(requestError.message);
        setStatus("error");
      });
    return () => controller.abort();
  }, [getToken, refreshKey]);

  return (
    <section className="tennis-panel rounded-3xl p-6 shadow-2xl" aria-labelledby="my-events-heading">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 id="my-events-heading" className="text-xl font-semibold">My Events</h2>
          <p className="mt-1 text-sm text-slate-600">Events you publish while signed in appear here.</p>
        </div>
        <button type="button" onClick={() => setRefreshKey((value) => value + 1)} disabled={status === "loading"} className="rounded-xl border border-slate-300 bg-white p-2 text-slate-700 transition hover:bg-slate-50 disabled:opacity-50" aria-label="Refresh my events">
          <RefreshCw className={`h-4 w-4 ${status === "loading" ? "animate-spin" : ""}`} />
        </button>
      </div>

      {status === "loading" ? <p className="mt-4 text-sm text-slate-500">Loading your events…</p> : null}
      {status === "error" ? <p role="alert" className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{error}</p> : null}
      {status === "ready" && events.length === 0 ? <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">Your first published event will appear here.</p> : null}
      {events.length > 0 ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {events.map((event) => (
            <a key={event.id} href={`/events/${event.id}`} className="rounded-2xl border border-emerald-950/10 bg-emerald-50/70 p-4 transition hover:border-emerald-700/40 hover:bg-emerald-50">
              <div className="flex items-start gap-3">
                <CalendarDays className="mt-0.5 h-5 w-5 shrink-0 text-emerald-800" />
                <div className="min-w-0">
                  <h3 className="truncate font-semibold text-emerald-950">{event.title}</h3>
                  <p className="mt-1 text-xs text-slate-600">{event.players} players · {event.matches} matches</p>
                  <p className="mt-1 text-xs text-slate-500">Published {eventDate(event.createdAt)}</p>
                </div>
              </div>
            </a>
          ))}
        </div>
      ) : null}
    </section>
  );
}
