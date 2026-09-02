import { createEventHandler } from "../server/handler.mjs";
import { getEventStore } from "../server/store.mjs";

const handle = createEventHandler(getEventStore);
export const GET = handle;
export const POST = handle;
export const PUT = handle;
