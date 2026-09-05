import React, { useEffect, useState } from "react";
import { ArrowLeft, BarChart3, CheckCircle2, MessageSquareText, RefreshCw, Users } from "lucide-react";
import { betaApi } from "./event-api.mjs";

const willingnessLabels = { yes: "Yes", maybe: "Maybe", not_yet: "Not yet" };

function MetricCard({ label, value, detail, icon: Icon }) {
  return (
    <article className="rounded-2xl border border-emerald-950/10 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div><p className="text-sm font-semibold text-slate-500">{label}</p><p className="mt-2 text-4xl font-bold text-emerald-950">{value}</p></div>
        <div className="rounded-xl bg-lime-200 p-2 text-emerald-950"><Icon className="h-5 w-5" /></div>
      </div>
      <p className="mt-3 text-xs text-slate-500">{detail}</p>
    </article>
  );
}

function percentage(part, whole) {
  return whole ? `${Math.round((part / whole) * 100)}%` : "—";
}

export default function BetaInsights({ getToken, isLoaded, isSignedIn, signInAction }) {
  const [insights, setInsights] = useState(null);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return undefined;
    const controller = new AbortController();
    setStatus("loading");
    setError("");
    betaApi.insights(getToken, controller.signal)
      .then((data) => { setInsights(data.insights); setStatus("ready"); })
      .catch((requestError) => {
        if (controller.signal.aborted) return;
        setError(requestError.message);
        setStatus("error");
      });
    return () => controller.abort();
  }, [getToken, isLoaded, isSignedIn, refreshKey]);

  return (
    <div className="tennis-app relative min-h-screen overflow-hidden px-4 py-6 text-slate-950 sm:px-6 lg:px-8">
      <div className="tennis-backdrop" aria-hidden="true" />
      <div className="relative z-10 mx-auto max-w-6xl space-y-6">
        <nav className="flex items-center justify-between gap-3 rounded-2xl border border-white/70 bg-white/95 px-4 py-3 shadow-lg" aria-label="Beta insights navigation">
          <a href="/" className="inline-flex items-center gap-2 text-sm font-bold text-emerald-950 hover:underline"><ArrowLeft className="h-4 w-4" /> Organizer dashboard</a>
          <a href="/faq" className="text-sm font-semibold text-emerald-900 hover:underline">FAQ</a>
        </nav>
        <header className="rounded-3xl border border-white/70 bg-emerald-950 px-6 py-8 text-white shadow-2xl sm:px-9">
          <p className="text-xs font-bold uppercase tracking-wider text-lime-200">Owner only</p>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <div><h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Beta insights</h1><p className="mt-2 max-w-2xl text-emerald-100">Real usage from published events and voluntary organizer feedback. No player profiles or behavioral tracking.</p></div>
            {insights ? <button type="button" onClick={() => setRefreshKey((value) => value + 1)} disabled={status === "loading"} className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-sm font-bold hover:bg-white/20 disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${status === "loading" ? "animate-spin" : ""}`} /> Refresh</button> : null}
          </div>
        </header>

        {!isLoaded ? <section className="tennis-panel rounded-3xl p-8 text-center shadow-2xl">Checking organizer account…</section> : null}
        {isLoaded && !isSignedIn ? <section className="tennis-panel rounded-3xl p-8 text-center shadow-2xl"><h2 className="text-2xl font-bold">Organizer sign-in required</h2><p className="mt-2 text-slate-600">Only the configured beta owner can view aggregate results.</p><div className="mx-auto mt-5 max-w-xs">{signInAction}</div></section> : null}
        {isSignedIn && status === "loading" ? <section className="tennis-panel rounded-3xl p-8 text-center shadow-2xl">Loading beta results…</section> : null}
        {error ? <section className="tennis-panel rounded-3xl p-8 shadow-2xl"><p role="alert" className="rounded-xl bg-amber-50 p-4 text-amber-950">{error}</p><p className="mt-3 text-sm text-slate-600">To authorize the owner, add the Clerk user ID to <code className="rounded bg-slate-100 px-1.5 py-1">BETA_ADMIN_USER_IDS</code> for the paid-beta Preview branch, then redeploy.</p></section> : null}

        {insights ? <>
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="Beta usage metrics">
            <MetricCard label="Organizers" value={insights.organizers} detail={`${insights.repeatOrganizers} published two or more events`} icon={Users} />
            <MetricCard label="Published events" value={insights.events} detail={`${insights.recentEvents} published in the last 30 days`} icon={BarChart3} />
            <MetricCard label="Events with scores" value={insights.scoredEvents} detail={`${percentage(insights.scoredEvents, insights.events)} of published events`} icon={CheckCircle2} />
            <MetricCard label="Completed events" value={insights.completedEvents} detail={`${percentage(insights.completedEvents, insights.events)} of published events`} icon={CheckCircle2} />
            <MetricCard label="Repeat organizers" value={insights.repeatOrganizers} detail={`${percentage(insights.repeatOrganizers, insights.organizers)} of organizers`} icon={Users} />
            <MetricCard label="Pricing responses" value={insights.responses} detail={`${insights.willingness.yes} yes · ${insights.willingness.maybe} maybe · ${insights.willingness.notYet} not yet`} icon={MessageSquareText} />
          </section>

          <section className="tennis-panel rounded-3xl p-6 shadow-2xl sm:p-8" aria-labelledby="signal-heading">
            <h2 id="signal-heading" className="text-2xl font-bold">Demand signal</h2>
            <p className="mt-2 text-slate-600">A useful first checkpoint is 10–15 real organizers testing the beta, with repeat event creation and at least 3–5 saying the $29 founding year is worth it.</p>
            <div className="mt-5 grid grid-cols-3 gap-3 text-center">
              <div className="rounded-2xl bg-emerald-50 p-4"><p className="text-2xl font-bold text-emerald-950">{insights.willingness.yes}</p><p className="text-xs font-semibold text-slate-600">Yes</p></div>
              <div className="rounded-2xl bg-lime-50 p-4"><p className="text-2xl font-bold text-emerald-950">{insights.willingness.maybe}</p><p className="text-xs font-semibold text-slate-600">Maybe</p></div>
              <div className="rounded-2xl bg-slate-100 p-4"><p className="text-2xl font-bold text-emerald-950">{insights.willingness.notYet}</p><p className="text-xs font-semibold text-slate-600">Not yet</p></div>
            </div>
          </section>

          <section className="tennis-panel rounded-3xl p-6 shadow-2xl sm:p-8" aria-labelledby="comments-heading">
            <h2 id="comments-heading" className="text-2xl font-bold">Organizer comments</h2>
            {insights.comments.length ? <div className="mt-5 space-y-3">{insights.comments.map((item, index) => (
              <article key={`${item.updatedAt}-${index}`} className="rounded-2xl bg-slate-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2"><span className="rounded-full bg-lime-200 px-2.5 py-1 text-xs font-bold text-emerald-950">{willingnessLabels[item.willingness]}</span><time className="text-xs text-slate-500" dateTime={item.updatedAt}>{new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(item.updatedAt))}</time></div>
                <p className="mt-3 whitespace-pre-wrap text-slate-700">{item.comment}</p>
              </article>
            ))}</div> : <p className="mt-4 rounded-xl bg-slate-50 p-4 text-slate-600">No written feedback yet.</p>}
          </section>
        </> : null}
      </div>
    </div>
  );
}
