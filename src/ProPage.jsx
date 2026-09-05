import React from "react";
import { Archive, ArrowLeft, BarChart3, CalendarDays, Check, CopyPlus, Download, Link2, UserPlus, Users, X } from "lucide-react";
import { PLAN_COMPARISON, PRO_PRICING, PRO_VALUE_CARDS } from "./plans.mjs";

const VALUE_ICONS = [Link2, BarChart3, CalendarDays];

const SAMPLE_EVENTS = [
  { title: "Saturday Morning Round Robin", detail: "16 players · 12 of 16 matches completed", status: "In progress", progress: 75 },
  { title: "Mixed Doubles Social", detail: "12 players · 9 of 9 matches completed", status: "Completed", progress: 100 },
  { title: "Wednesday Night Tennis", detail: "8 players · Ready to begin", status: "Ready", progress: 0 },
];

function Included({ value }) {
  return value ? <Check className="mx-auto h-5 w-5 text-emerald-700" aria-label="Included" /> : <X className="mx-auto h-5 w-5 text-slate-300" aria-label="Not included" />;
}

export default function ProPage({ renderAccessAction, accountControls }) {
  return (
    <div className="tennis-app relative min-h-screen overflow-hidden px-4 py-6 text-slate-950 sm:px-6 lg:px-8">
      <div className="tennis-backdrop" aria-hidden="true" />
      <div className="relative z-10 mx-auto max-w-6xl space-y-6">
        <nav className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/70 bg-white/95 px-4 py-3 shadow-lg" aria-label="Pro page navigation">
          <a href="/" className="inline-flex items-center gap-2 text-sm font-bold text-emerald-950 hover:underline"><ArrowLeft className="h-4 w-4" /> Free generator</a>
          {accountControls}
        </nav>

        <header className="overflow-hidden rounded-3xl border border-white/70 bg-emerald-950 text-white shadow-2xl">
          <div className="grid gap-8 px-6 py-10 md:grid-cols-[1.2fr_0.8fr] md:px-10 md:py-14">
            <div>
              <span className="inline-flex rounded-full bg-lime-300 px-3 py-1 text-xs font-bold uppercase tracking-wider text-emerald-950">Tennis Round Robin Pro</span>
              <h1 className="mt-5 max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl">Generate for free. Run the entire event with Pro.</h1>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-emerald-50">Share live scoring, calculate standings automatically, and keep every event organized—without chasing texts or rebuilding spreadsheets.</p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
                {renderAccessAction ? renderAccessAction("hero") : <a href="/" className="rounded-xl bg-lime-300 px-5 py-3 text-center font-bold text-emerald-950 transition hover:bg-lime-200">Open the generator</a>}
                <a href="#compare" className="rounded-xl border border-white/30 px-5 py-3 text-center font-semibold text-white transition hover:bg-white/10">Compare plans</a>
              </div>
              <p className="mt-4 text-sm text-emerald-100">Private beta access is free for now. No card required and billing is not active.</p>
            </div>

            <div className="rounded-3xl border border-lime-200/30 bg-white/10 p-6 backdrop-blur-sm">
              <p className="text-sm font-bold uppercase tracking-wider text-lime-200">Planned launch price</p>
              <p className="mt-4"><span className="text-5xl font-bold">${PRO_PRICING.annual}</span><span className="text-emerald-100"> / year</span></p>
              <p className="mt-1 text-sm text-emerald-100">About ${PRO_PRICING.annualMonthlyEquivalent}/month, billed annually</p>
              <div className="my-5 h-px bg-white/20" />
              <p className="text-lg font-bold">Or ${PRO_PRICING.monthly}/month</p>
              <p className="mt-4 rounded-xl bg-lime-300 px-3 py-2 text-sm font-bold text-emerald-950">Founding offer under consideration: ${PRO_PRICING.foundingAnnual} for the first year</p>
            </div>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-3" aria-label="Pro highlights">
          {PRO_VALUE_CARDS.map((card, index) => {
            const Icon = VALUE_ICONS[index];
            return (
              <article key={card.title} className="tennis-panel rounded-3xl p-6 shadow-xl">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-lime-200 text-emerald-950"><Icon className="h-5 w-5" /></div>
                <h2 className="mt-4 text-xl font-bold">{card.title}</h2>
                <p className="mt-2 leading-6 text-slate-600">{card.description}</p>
              </article>
            );
          })}
        </section>

        <section className="tennis-panel overflow-hidden rounded-3xl shadow-2xl" aria-labelledby="dashboard-preview-heading">
          <div className="border-b border-slate-200 bg-white px-6 py-5 sm:px-8">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">Sample Pro experience</span>
            <h2 id="dashboard-preview-heading" className="mt-1 text-2xl font-bold">Your organizer dashboard</h2>
            <p className="mt-1 text-sm text-slate-600">A preview of how your published events stay manageable in one place.</p>
          </div>
          <div className="grid gap-5 bg-slate-50 p-5 sm:p-8 lg:grid-cols-[1fr_270px]">
            <div className="space-y-3">
              {SAMPLE_EVENTS.map((event) => (
                <article key={event.title} className="rounded-2xl border border-emerald-950/10 bg-white p-4 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h3 className="font-bold text-emerald-950">{event.title}</h3>
                      <p className="mt-1 text-xs text-slate-600">{event.detail}</p>
                    </div>
                    <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-900">{event.status}</span>
                  </div>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-lime-500" style={{ width: `${event.progress}%` }} /></div>
                </article>
              ))}
            </div>
            <aside className="rounded-2xl bg-emerald-950 p-5 text-white">
              <p className="text-sm font-bold uppercase tracking-wider text-lime-200">Organizer tools</p>
              <ul className="mt-4 space-y-3 text-sm">
                <li className="flex items-center gap-2"><Users className="h-4 w-4 text-lime-300" /> Frequent Players</li>
                <li className="flex items-center gap-2"><CopyPlus className="h-4 w-4 text-lime-300" /> Duplicate events</li>
                <li className="flex items-center gap-2"><Download className="h-4 w-4 text-lime-300" /> Export results</li>
                <li className="flex items-center gap-2"><UserPlus className="h-4 w-4 text-lime-300" /> Invite co-organizers</li>
                <li className="flex items-center gap-2"><Archive className="h-4 w-4 text-lime-300" /> Archive or delete</li>
              </ul>
            </aside>
          </div>
        </section>

        <section id="compare" className="tennis-panel scroll-mt-6 overflow-hidden rounded-3xl shadow-2xl" aria-labelledby="compare-heading">
          <div className="px-6 py-6 sm:px-8">
            <h2 id="compare-heading" className="text-2xl font-bold">Free vs. Pro</h2>
            <p className="mt-1 text-sm text-slate-600">Free handles schedule creation. Pro handles everything that happens around and after it.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-y border-slate-200 bg-slate-50">
                  <th scope="col" className="px-6 py-4 font-bold sm:px-8">Feature</th>
                  <th scope="col" className="w-28 px-4 py-4 text-center font-bold">Free</th>
                  <th scope="col" className="w-28 bg-lime-100 px-4 py-4 text-center font-bold text-emerald-950">Pro</th>
                </tr>
              </thead>
              <tbody>
                {PLAN_COMPARISON.map((item) => (
                  <tr key={item.feature} className="border-b border-slate-100">
                    <th scope="row" className="px-6 py-4 font-medium text-slate-700 sm:px-8">{item.feature}</th>
                    <td className="px-4 py-4 text-center"><Included value={item.free} /></td>
                    <td className="bg-lime-50/60 px-4 py-4 text-center"><Included value={item.pro} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-3xl border border-lime-300 bg-lime-200 px-6 py-8 text-center shadow-2xl sm:px-8">
          <h2 className="text-3xl font-bold tracking-tight text-emerald-950">Ready to run your next round robin?</h2>
          <p className="mx-auto mt-2 max-w-2xl text-emerald-950/80">Join the private beta to publish events, invite players, and manage results. Billing comes later.</p>
          <div className="mx-auto mt-5 flex max-w-sm flex-col">{renderAccessAction ? renderAccessAction("footer") : <a href="/" className="rounded-xl bg-emerald-950 px-5 py-3 font-bold text-white">Open the free generator</a>}</div>
        </section>

        <footer className="pb-4 text-center text-xs text-white/80">Tennis Round Robin Generator · Free scheduling with optional Pro event management</footer>
      </div>
    </div>
  );
}
