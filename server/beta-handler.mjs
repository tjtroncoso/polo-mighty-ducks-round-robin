import { InputError } from "../src/events.mjs";
import { validateBetaFeedback } from "../src/beta-feedback.mjs";

const maximumBodyBytes = 8 * 1024;

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
  const decoder = new TextDecoder();
  let size = 0;
  let text = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maximumBodyBytes) {
      await reader.cancel();
      throw new InputError("This feedback is too large.");
    }
    text += decoder.decode(value, { stream: true });
  }
  text += decoder.decode();
  try { return JSON.parse(text); }
  catch { throw new InputError("The request contains invalid JSON."); }
}

function adminUserIds(environment) {
  return new Set((environment.BETA_ADMIN_USER_IDS || "").split(",").map((value) => value.trim()).filter(Boolean));
}

export function createBetaHandler(getStore, getOrganizerUserId = async () => null, environment = process.env) {
  return async function handle(request) {
    const startedAt = Date.now();
    const requestId = request.headers.get("x-vercel-id") || undefined;
    const finish = (body, status = 200) => {
      console.log(JSON.stringify({ level: "info", message: "Beta request completed", route: "/api/beta", method: request.method, status, durationMs: Date.now() - startedAt, requestId }));
      return json(body, status);
    };
    console.log(JSON.stringify({ level: "info", message: "Beta request started", route: "/api/beta", method: request.method, requestId }));

    try {
      const url = new URL(request.url);
      if (!["GET", "POST"].includes(request.method)) return finish({ error: "Method not allowed." }, 405);
      if (request.method === "POST") {
        const origin = request.headers.get("origin");
        if (origin && origin !== url.origin) return finish({ error: "Open the organizer dashboard to send feedback." }, 403);
      }

      const userId = await getOrganizerUserId(request);
      if (!userId) return finish({ error: "Sign in as an organizer to continue." }, 401);
      const store = getStore();

      if (request.method === "GET" && url.searchParams.get("insights") === "1") {
        if (!adminUserIds(environment).has(userId)) return finish({ error: "This private beta insights page is only available to the site owner." }, 403);
        return finish({ insights: await store.getBetaInsights() });
      }

      if (request.method === "GET") return finish({ feedback: await store.getBetaFeedback(userId) });
      const feedback = validateBetaFeedback(await readBody(request));
      return finish({ feedback: await store.saveBetaFeedback(userId, feedback) }, 201);
    } catch (error) {
      if (error instanceof InputError) return finish({ error: error.message }, 400);
      if (error.status === 503) return finish({ error: error.message }, 503);
      console.error(JSON.stringify({ level: "error", message: "Beta request failed", route: "/api/beta", method: request.method, durationMs: Date.now() - startedAt, requestId }));
      return json({ error: "We could not reach the beta feedback service. Please try again." }, 503);
    }
  };
}
