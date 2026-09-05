import React, { useEffect, useRef } from "react";
import { BarChart3, CalendarDays, Check, Link2, X } from "lucide-react";
import { PRO_PRICING, PRO_VALUE_CARDS } from "./plans.mjs";

const VALUE_ICONS = [Link2, BarChart3, CalendarDays];

export default function ProUpgradeModal({ accessAction, onClose }) {
  const closeButtonRef = useRef(null);
  const dialogRef = useRef(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    function handleKeyDown(event) {
      if (event.key === "Escape") onClose();
      if (event.key !== "Tab") return;

      const focusable = dialogRef.current?.querySelectorAll('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])');
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus?.();
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-emerald-950/80 p-4 backdrop-blur-sm" role="presentation">
      <button type="button" className="fixed inset-0 cursor-default" onClick={onClose} aria-label="Close Pro details" />
      <section ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="pro-dialog-title" className="relative mx-auto my-4 max-w-3xl overflow-hidden rounded-3xl border border-white/30 bg-white shadow-2xl sm:my-10">
        <div className="bg-emerald-950 px-6 py-7 text-white sm:px-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <span className="inline-flex rounded-full bg-lime-300 px-3 py-1 text-xs font-bold uppercase tracking-wider text-emerald-950">Pro beta</span>
              <h2 id="pro-dialog-title" className="mt-4 text-3xl font-bold tracking-tight">Run the entire event with Pro.</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-emerald-50">The schedule generator stays free. Pro adds the live results, standings, and organizer tools that take over once play begins.</p>
            </div>
            <button ref={closeButtonRef} type="button" onClick={onClose} className="rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20" aria-label="Close Pro details">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="p-6 sm:p-8">
          <div className="grid gap-3 sm:grid-cols-3">
            {PRO_VALUE_CARDS.map((card, index) => {
              const Icon = VALUE_ICONS[index];
              return (
                <article key={card.title} className="rounded-2xl border border-emerald-950/10 bg-emerald-50 p-4">
                  <Icon className="h-5 w-5 text-emerald-800" />
                  <h3 className="mt-3 font-bold text-emerald-950">{card.title}</h3>
                  <p className="mt-1 text-sm leading-5 text-slate-600">{card.description}</p>
                </article>
              );
            })}
          </div>

          <div className="mt-6 grid gap-4 rounded-2xl border border-lime-300 bg-lime-50 p-5 sm:grid-cols-[1fr_auto] sm:items-center">
            <div>
              <p className="font-bold text-emerald-950">Planned launch price</p>
              <p className="mt-1 text-sm text-slate-600"><span className="text-2xl font-bold text-emerald-950">${PRO_PRICING.annual}/year</span> or ${PRO_PRICING.monthly}/month</p>
              <p className="mt-1 text-xs text-slate-500">Billing is not active during the private beta.</p>
            </div>
            <div className="flex flex-col gap-2 sm:min-w-52">
              {accessAction || <a href="/pro" className="rounded-xl bg-emerald-950 px-5 py-3 text-center text-sm font-bold text-white">Explore Pro</a>}
              <a href="/pro" className="text-center text-sm font-semibold text-emerald-900 underline underline-offset-4">See everything in Pro</a>
            </div>
          </div>

          <button type="button" onClick={onClose} className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-emerald-900">
            <Check className="h-4 w-4" /> Continue using the free generator
          </button>
        </div>
      </section>
    </div>
  );
}
