import { InputError, validateSnapshot, validateResult } from "../src/events.mjs";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const maximumBodyBytes = 256 * 1024;

function json(body, status = 200) {
  return Response.json(body, { status, headers: {
    "Cache-Control": "private, no-store",
    "X-Robots-Tag": "noindex, nofollow",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
  } });
}

async function readBody(request) {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) throw new InputError("Send JSON to this endpoint.");
  const reader = request.body?.getReader();
  if (!reader) throw new InputError("A request body is required.");
  let size = 0;
  const decoder = new TextDecoder();
  let body = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maximumBodyBytes) {
      await reader.cancel();
      throw new InputError("This lineup is too large. Use at most 200 players and 20 rounds.");
    }
    body += decoder.decode(value, { stream: true });
  }
  body += decoder.decode();
  try { return JSON.parse(body); }
  catch { throw new InputError("The request contains invalid JSON."); }
}

export function createEventHandler(getStore) {
  return async function handle(request) {
    try {
      const url = new URL(request.url);
      if (!["GET", "POST", "PUT"].includes(request.method)) return json({ error: "Method not allowed." }, 405);
      if (request.method !== "GET") {
        const origin = request.headers.get("origin");
        if (origin && origin !== url.origin) return json({ error: "Open the event link to enter results." }, 403);
      }
      if (request.method === "POST") {
        const body = await readBody(request);
        if (!uuid.test(body?.id)) throw new InputError("Invalid event ID.");
        const snapshot = validateSnapshot(body.snapshot);
        const created = await getStore().create(body.id, snapshot);
        if (!created) return json({ error: "That event already has a published lineup. Publish a new event for a different lineup." }, 409);
        return json({ id: body.id }, 201);
      }
      const id = url.searchParams.get("id");
      if (!uuid.test(id || "")) return json({ error: "This event link is invalid." }, 404);
      const store = getStore();
      const event = await store.get(id);
      if (!event) return json({ error: "Event not found. Check that you have the complete event link." }, 404);
      if (request.method === "GET") return json(event);
      const matchId = url.searchParams.get("match");
      if (!event.snapshot.rounds.some((round) => round.matches.some((match) => match.id === matchId))) return json({ error: "This match is not in the published lineup." }, 404);
      const body = await readBody(request);
      if (!Number.isInteger(body?.version) || body.version < 0 || body.version > 2147483646) throw new InputError("Reload the match before saving.");
      const result = validateResult(body.result, event.snapshot.format);
      const saved = await store.save(id, matchId, result, body.version);
      if (!saved) {
        const latest = await store.get(id);
        return json({ error: "Someone else updated this match. Load their score before making another change.", current: latest.results[matchId] || { status: "scheduled", scores: [], version: 0 } }, 409);
      }
      return json({ result: saved });
    } catch (error) {
      if (error instanceof InputError) return json({ error: error.message }, 400);
      if (error.status === 503) return json({ error: error.message }, 503);
      // Driver errors may include connection strings; never return or log their text.
      console.error("Event storage request failed.");
      return json({ error: "We could not reach the shared scores. Your changes have not been confirmed; please try again." }, 503);
    }
  };
}
