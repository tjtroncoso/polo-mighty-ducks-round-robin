import { getOrganizerUserId } from "../server/auth.mjs";
import { createPlayerHandler } from "../server/player-handler.mjs";
import { getEventStore } from "../server/store.mjs";

const handle = createPlayerHandler(getEventStore, getOrganizerUserId);
export const GET = handle;
export const POST = handle;
export const DELETE = handle;
