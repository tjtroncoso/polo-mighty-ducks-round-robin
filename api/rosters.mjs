import { getOrganizerUserId } from "../server/auth.mjs";
import { createRosterHandler } from "../server/roster-handler.mjs";
import { getEventStore } from "../server/store.mjs";

const handle = createRosterHandler(getEventStore, getOrganizerUserId);
export const GET = handle;
export const POST = handle;
export const DELETE = handle;
