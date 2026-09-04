import { InputError } from "../src/events.mjs";
import { validateFrequentPlayers } from "../src/frequent-players.mjs";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const maximumBodyBytes = 128 * 1024;

function json(body, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff" } });
}

async function readBody(request) {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) throw new InputError("Send JSON to this endpoint.");
  const reader = request.body?.getReader();
  if (!reader) throw new InputError("A request body is required.");
  const decoder = new TextDecoder();
  let size = 0;
  let text = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maximumBodyBytes) {
      await reader.cancel();
      throw new InputError("This frequent-player list is too large.");
    }
    text += decoder.decode(value, { stream: true });
  }
  text += decoder.decode();
  try { return JSON.parse(text); }
  catch { throw new InputError("The request contains invalid JSON."); }
}

export function createPlayerHandler(getStore, getOrganizerUserId = async () => null) {
  return async function handle(request) {
    try {
      const url = new URL(request.url);
      if (!["GET", "POST", "DELETE"].includes(request.method)) return json({ error: "Method not allowed." }, 405);
      if (request.method !== "GET") {
        const origin = request.headers.get("origin");
        if (origin && origin !== url.origin) return json({ error: "Open the organizer dashboard to manage frequent players." }, 403);
      }
      const ownerUserId = await getOrganizerUserId(request);
      if (!ownerUserId) return json({ error: "Sign in to manage frequent players." }, 401);
      const store = getStore();
      if (request.method === "GET") return json({ players: await store.listFrequentPlayers(ownerUserId) });
      if (request.method === "POST") {
        const players = validateFrequentPlayers(await readBody(request));
        return json({ players: await store.saveFrequentPlayers(ownerUserId, players) }, 201);
      }
      const id = url.searchParams.get("id");
      if (!uuid.test(id || "")) return json({ error: "Invalid player ID." }, 404);
      if (!await store.deleteFrequentPlayer(id, ownerUserId)) return json({ error: "Frequent player not found." }, 404);
      return json({ deleted: true });
    } catch (error) {
      if (error instanceof InputError) return json({ error: error.message }, 400);
      if (error.status === 503) return json({ error: error.message }, 503);
      console.error("Frequent-player storage request failed.");
      return json({ error: "We could not reach frequent players. Please try again." }, 503);
    }
  };
}
