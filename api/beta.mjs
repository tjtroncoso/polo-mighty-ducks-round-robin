import { getOrganizerUserId } from "../server/auth.mjs";
import { createBetaHandler } from "../server/beta-handler.mjs";
import { getEventStore } from "../server/store.mjs";

const handle = createBetaHandler(getEventStore, getOrganizerUserId);
export const GET = handle;
export const POST = handle;
