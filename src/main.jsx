import React from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import EventResults from "./EventResults.jsx";

const eventPath = window.location.pathname.match(/^\/events\/([^/]+)\/?$/);
const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const root = createRoot(document.getElementById("root"));

if (eventPath) {
  root.render(<EventResults eventId={eventPath[1]} />);
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
