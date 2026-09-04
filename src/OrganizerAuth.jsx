import React from "react";
import { ClerkProvider, SignInButton, UserButton, useAuth } from "@clerk/react";
import App from "./App.jsx";

function AccountControls() {
  const { isLoaded, isSignedIn } = useAuth();

  return (
    <div className="flex shrink-0 items-center gap-3 rounded-2xl border border-emerald-950/10 bg-white/90 px-3 py-2 shadow-sm">
      <span className="hidden text-xs font-semibold uppercase tracking-wide text-emerald-900 sm:inline">Paid beta</span>
      {!isLoaded ? <span className="text-sm text-slate-500">Loading account…</span> : null}
      {isLoaded && !isSignedIn ? (
        <SignInButton mode="modal">
          <button type="button" className="rounded-xl bg-emerald-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-800">
            Organizer sign in
          </button>
        </SignInButton>
      ) : null}
      {isLoaded && isSignedIn ? <UserButton /> : null}
    </div>
  );
}

export function ClerkGenerator() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  return (
    <App
      auth={{ enabled: true, getToken, isLoaded, isSignedIn: Boolean(isSignedIn) }}
      accountControls={<AccountControls />}
    />
  );
}

export function ClerkGeneratorRoot({ publishableKey }) {
  return (
    <ClerkProvider publishableKey={publishableKey}>
      <ClerkGenerator />
    </ClerkProvider>
  );
}
