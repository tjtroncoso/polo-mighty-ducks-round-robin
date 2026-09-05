import React, { useEffect, useState } from "react";
import { MessageSquareText } from "lucide-react";
import { betaApi } from "./event-api.mjs";
import { BETA_WILLINGNESS_OPTIONS } from "./beta-feedback.mjs";

export default function BetaFeedback({ getToken }) {
  const [willingness, setWillingness] = useState("");
  const [comment, setComment] = useState("");
  const [status, setStatus] = useState("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    betaApi.feedback(getToken, controller.signal)
      .then(({ feedback }) => {
        if (feedback) {
          setWillingness(feedback.willingness);
          setComment(feedback.comment);
        }
        setStatus("ready");
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        setMessage(error.message);
        setStatus("error");
      });
    return () => controller.abort();
  }, [getToken]);

  async function saveFeedback(event) {
    event.preventDefault();
    setStatus("saving");
    setMessage("");
    try {
      const { feedback } = await betaApi.saveFeedback({ willingness, comment }, getToken);
      setWillingness(feedback.willingness);
      setComment(feedback.comment);
      setStatus("ready");
      setMessage("Thank you—your beta feedback is saved. You can update it anytime.");
    } catch (error) {
      setStatus("error");
      setMessage(error.message);
    }
  }

  return (
    <section className="tennis-panel rounded-3xl p-6 shadow-2xl" aria-labelledby="beta-feedback-heading">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-lime-200 text-emerald-950"><MessageSquareText className="h-5 w-5" /></div>
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">Private beta feedback</p>
          <h2 id="beta-feedback-heading" className="mt-1 text-xl font-bold">Would Founding Pro be worth $29 for your first year?</h2>
          <p className="mt-1 text-sm text-slate-600">Your answer helps decide whether this becomes a paid product. This will not start a subscription or charge you.</p>
        </div>
      </div>

      {status === "loading" ? <p className="mt-4 text-sm text-slate-500">Loading your previous answer…</p> : (
        <form className="mt-5 space-y-4" onSubmit={saveFeedback}>
          <fieldset>
            <legend className="sr-only">Would Founding Pro be worth 29 dollars for your first year?</legend>
            <div className="grid grid-cols-3 gap-2">
              {BETA_WILLINGNESS_OPTIONS.map((option) => (
                <label key={option.value} className={`cursor-pointer rounded-xl border px-3 py-3 text-center text-sm font-bold transition ${willingness === option.value ? "border-emerald-900 bg-emerald-950 text-white" : "border-slate-300 bg-white text-slate-700 hover:bg-emerald-50"}`}>
                  <input className="sr-only" type="radio" name="willingness" value={option.value} checked={willingness === option.value} onChange={(event) => setWillingness(event.target.value)} />
                  {option.label}
                </label>
              ))}
            </div>
          </fieldset>
          <div>
            <label htmlFor="beta-comment" className="text-sm font-semibold text-slate-700">What would make Pro worth paying for? <span className="font-normal text-slate-500">(optional)</span></label>
            <textarea id="beta-comment" value={comment} onChange={(event) => setComment(event.target.value)} maxLength={1000} rows={3} placeholder="Tell us what you need for your tennis group or club." className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm outline-none ring-emerald-400 focus:ring-2" />
            <p className="mt-1 text-right text-xs text-slate-500">{comment.length}/1,000</p>
          </div>
          <button type="submit" disabled={!willingness || status === "saving"} className="w-full rounded-xl bg-emerald-950 px-4 py-3 text-sm font-bold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50">
            {status === "saving" ? "Saving feedback…" : "Save feedback"}
          </button>
        </form>
      )}
      {message ? <p role={status === "error" ? "alert" : "status"} className={`mt-4 rounded-xl p-3 text-sm ${status === "error" ? "bg-amber-50 text-amber-900" : "bg-emerald-50 text-emerald-900"}`}>{message}</p> : null}
    </section>
  );
}
