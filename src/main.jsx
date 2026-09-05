import React from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import EventResults from "./EventResults.jsx";

const eventPath = window.location.pathname.match(/^\/events\/([^/]+)\/?$/);
const invitePath = window.location.pathname.match(/^\/join\/([^/]+)\/?$/);
const proPath = window.location.pathname.match(/^\/pro\/?$/);
const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const root = createRoot(document.getElementById("root"));

if (eventPath) {
  root.render(<EventResults eventId={eventPath[1]} />);
} else if (invitePath && publishableKey) {
  import("./OrganizerAuth.jsx").then(({ ClerkInviteRoot }) => {
    root.render(<ClerkInviteRoot publishableKey={publishableKey} token={invitePath[1]} />);
  });
} else if (invitePath) {
  root.render(<div className="tennis-app min-h-screen p-8 text-white">Organizer login setup pending.</div>);
} else if (proPath && publishableKey) {
  import("./OrganizerAuth.jsx").then(({ ClerkProPageRoot }) => {
    root.render(<ClerkProPageRoot publishableKey={publishableKey} />);
  });
} else if (proPath) {
  import("./ProPage.jsx").then(({ default: ProPage }) => {
    root.render(<ProPage />);
  });
} else if (publishableKey) {
  import("./OrganizerAuth.jsx").then(({ ClerkGeneratorRoot }) => {
    root.render(<ClerkGeneratorRoot publishableKey={publishableKey} />);
  });
} else {
  root.render(
    <App
      auth={{ enabled: false, getToken: async () => null, isLoaded: true, isSignedIn: false }}
      accountControls={(
        <div className="shrink-0 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-950">
          Organizer login setup pending
        </div>
      )}
    />,
  );
}
