import React from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import EventResults from "./EventResults.jsx";

const eventPath = window.location.pathname.match(/^\/events\/([^/]+)\/?$/);
createRoot(document.getElementById("root")).render(eventPath ? <EventResults eventId={eventPath[1]} /> : <App />);
