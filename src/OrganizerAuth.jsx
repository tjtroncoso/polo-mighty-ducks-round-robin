import React from "react";
import { ClerkProvider, SignInButton, UserButton, useAuth } from "@clerk/react";
import App from "./App.jsx";
import OrganizerInvite from "./OrganizerInvite.jsx";
import ProPage from "./ProPage.jsx";

function BetaAccessButton({ variant = "dark" }) {
  const { isLoaded, isSignedIn } = useAuth();
  const buttonClass = variant === "hero"
    ? "rounded-xl bg-lime-300 px-5 py-3 text-center text-sm font-bold text-emerald-950 transition hover:bg-lime-200"
    : "rounded-xl bg-emerald-950 px-5 py-3 text-center text-sm font-bold text-white transition hover:bg-emerald-800";

  if (!isLoaded) return <button type="button" disabled className={`${buttonClass} opacity-60`}>Loading account…</button>;
  if (isSignedIn) return <a href="/" className={buttonClass}>Open organizer dashboard</a>;

  return (
    <SignInButton mode="modal">
      <button type="button" className={buttonClass}>Join the Pro beta</button>
    </SignInButton>
  );
}

function AccountControls() {
  const { isLoaded, isSignedIn } = useAuth();

  return (
    <div className="flex shrink-0 items-center gap-3 rounded-2xl border border-emerald-950/10 bg-white/90 px-3 py-2 shadow-sm">
      <span className="hidden text-xs font-semibold uppercase tracking-wide text-emerald-900 sm:inline">Paid beta</span>
      <a href="/pro" className="text-sm font-semibold text-emerald-900 hover:underline">Explore Pro</a>
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
      proSignInAction={<BetaAccessButton />}
    />
  );
}

export function ClerkProPage() {
  return <ProPage renderAccessAction={(variant) => <BetaAccessButton variant={variant} />} accountControls={<AccountControls />} />;
}

export function ClerkGeneratorRoot({ publishableKey }) {
  return (
    <ClerkProvider publishableKey={publishableKey}>
      <ClerkGenerator />
    </ClerkProvider>
  );
}

export function ClerkInviteRoot({ publishableKey, token }) {
  return (
    <ClerkProvider publishableKey={publishableKey}>
      <OrganizerInvite token={token} />
    </ClerkProvider>
  );
}

export function ClerkProPageRoot({ publishableKey }) {
  return (
    <ClerkProvider publishableKey={publishableKey}>
      <ClerkProPage />
    </ClerkProvider>
  );
}
