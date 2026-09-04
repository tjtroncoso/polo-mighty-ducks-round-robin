import React, { useState } from "react";
import { SignInButton, UserButton, useAuth } from "@clerk/react";
import { eventApi } from "./event-api.mjs";

export default function OrganizerInvite({ token }) {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");

  async function accept() {
    setStatus("joining");
    setError("");
    try {
      await eventApi.claimInvite(token, getToken);
      setStatus("joined");
    } catch (requestError) { setError(requestError.message); setStatus("idle"); }
  }

  return (
    <div className="tennis-app relative min-h-screen overflow-hidden p-4 text-slate-950 md:p-8">
      <div className="tennis-backdrop" aria-hidden="true" />
      <main className="relative z-10 mx-auto max-w-xl">
        <section className="tennis-panel rounded-3xl p-6 shadow-2xl md:p-8">
          <div className="flex items-start justify-between gap-4">
            <div><p className="text-xs font-bold uppercase tracking-widest text-emerald-800">Paid beta</p><h1 className="mt-2 text-3xl font-bold text-emerald-950">Co-organizer invitation</h1></div>
            {isLoaded && isSignedIn ? <UserButton /> : null}
          </div>
          <p className="mt-3 text-slate-600">Join this event as a co-organizer so it appears in your dashboard. The event owner keeps control of archiving and permanent deletion.</p>
          {!isLoaded ? <p className="mt-5 text-sm text-slate-500">Checking your organizer account…</p> : null}
          {isLoaded && !isSignedIn ? <SignInButton mode="modal"><button type="button" className="mt-5 w-full rounded-2xl bg-emerald-950 px-4 py-3 font-semibold text-white">Sign in to accept</button></SignInButton> : null}
          {isLoaded && isSignedIn && status !== "joined" ? <button type="button" onClick={accept} disabled={status === "joining"} className="mt-5 w-full rounded-2xl bg-emerald-950 px-4 py-3 font-semibold text-white disabled:opacity-50">{status === "joining" ? "Joining event…" : "Accept invitation"}</button> : null}
          {status === "joined" ? <div className="mt-5 rounded-2xl bg-emerald-50 p-4 text-emerald-950"><p className="font-semibold">You are now a co-organizer.</p><a href="/" className="mt-3 inline-block font-semibold underline">Open organizer dashboard</a></div> : null}
          {error ? <p role="alert" className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{error}</p> : null}
        </section>
      </main>
    </div>
  );
}
