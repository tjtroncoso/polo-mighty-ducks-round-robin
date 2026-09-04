import { createEventHandler } from "../server/handler.mjs";
import { getOrganizerUserId } from "../server/auth.mjs";
import { getEventStore } from "../server/store.mjs";

const handle = createEventHandler(getEventStore, getOrganizerUserId);
export const GET = handle;
export const POST = handle;
export const PUT = handle;
