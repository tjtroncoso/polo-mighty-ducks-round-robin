import React from "react";
import { ArrowLeft, HelpCircle } from "lucide-react";

const FAQS = [
  ["Is the schedule generator free?", "Yes. Creating, shuffling, copying, and printing a schedule stays free and does not require an account. The private Pro beta adds event publishing, shared results, standings, saved players, and organizer tools."],
  ["Do players need accounts?", "No. Players and organizers can open a published event link and enter or correct scores without signing in. Treat that unique link like an invitation and share it only with your group."],
  ["What can an organizer account do?", "Signed-in organizers can publish events, find previous events, track progress, reuse frequent players, duplicate events, export results, invite a co-organizer, and archive or delete events."],
  ["Which tennis formats are supported?", "Singles, Doubles, and Mixed Doubles are supported. Match formats include Timed, First to a selected number of games, Full Set, and Full Match."],
  ["Can partners stay together?", "Yes. In Doubles and Mixed Doubles, choose Keep paired with on either player's row. Locked partners remain together through every round and shuffle."],
  ["How are late arrivals handled?", "Mark a player as a late arrival and enter their arrival time. The generator keeps them out until they are available. A locked partner waits with them."],
  ["How long are events stored?", "Published events remain in the connected event database until the owner permanently deletes them. Archiving only removes an event from the active dashboard; its shared link still works. Beta retention rules may change before public launch."],
  ["Can I delete an event and its scores?", "Yes. Archive the event first, then choose Delete from the Archived tab. Permanent deletion removes the event and scores and stops its shared link from working."],
  ["Is payment active?", "No. The private Pro beta is free while the product is being tested. No card is required, and submitting pricing feedback does not create a subscription."],
  ["What information should I enter for players?", "A display name is enough. For youth groups or anyone who prefers more privacy, use first names, initials, or nicknames rather than full legal names."],
];

export default function FaqPage() {
  return (
    <div className="tennis-app relative min-h-screen overflow-hidden px-4 py-6 text-slate-950 sm:px-6 lg:px-8">
      <div className="tennis-backdrop" aria-hidden="true" />
      <div className="relative z-10 mx-auto max-w-4xl space-y-6">
        <nav className="rounded-2xl border border-white/70 bg-white/95 px-4 py-3 shadow-lg" aria-label="FAQ navigation">
          <a href="/" className="inline-flex items-center gap-2 text-sm font-bold text-emerald-950 hover:underline"><ArrowLeft className="h-4 w-4" /> Back to generator</a>
        </nav>
        <header className="tennis-header rounded-3xl p-7 shadow-2xl sm:p-10">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-lime-200 text-emerald-950"><HelpCircle className="h-6 w-6" /></div>
          <p className="mt-5 text-xs font-bold uppercase tracking-wider text-emerald-700">Help center</p>
          <h1 className="mt-1 text-4xl font-bold tracking-tight text-emerald-950">Frequently asked questions</h1>
          <p className="mt-3 max-w-2xl text-slate-600">The essentials for creating a schedule, publishing an event, and testing the private Pro beta.</p>
        </header>
        <main className="tennis-panel rounded-3xl p-5 shadow-2xl sm:p-8">
          <div className="divide-y divide-slate-200">
            {FAQS.map(([question, answer], index) => (
              <details key={question} className="group py-5" open={index === 0}>
                <summary className="cursor-pointer list-none pr-8 font-bold text-emerald-950 marker:content-none">{question}<span className="float-right text-emerald-700 group-open:rotate-45">+</span></summary>
                <p className="mt-3 max-w-3xl leading-7 text-slate-600">{answer}</p>
              </details>
            ))}
          </div>
        </main>
        <footer className="pb-4 text-center text-xs text-white/80">Tennis Round Robin Generator · Private beta</footer>
      </div>
    </div>
  );
}
