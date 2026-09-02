async function request(path, options = {}) {
  const { signal, ...init } = options;
  const controller = new AbortController();
  let timedOut = false;
  const cancel = () => controller.abort();
  if (signal?.aborted) controller.abort();
  signal?.addEventListener("abort", cancel, { once: true });
  const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, 20000);
  try {
    const response = await fetch(path, { cache: "no-store", ...init, signal: controller.signal });
    let data;
    try { data = await response.json(); }
    catch { throw new Error("Shared results are unavailable. Please try again shortly."); }
    if (!response.ok) {
      const error = new Error(data.error || "The score could not be saved.");
      error.status = response.status;
      error.current = data.current;
      throw error;
    }
    return data;
  } catch (error) {
    if (timedOut) throw new Error("The connection timed out, so we could not confirm your request. Please try again.");
    if (error instanceof TypeError) throw new Error("Unable to connect. Check your internet connection and try again.");
    throw error;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", cancel);
  }
}

export const eventApi = {
  publish: (id, snapshot) => request("/api/events", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, snapshot }) }),
  get: (id, signal) => request(`/api/events?id=${encodeURIComponent(id)}`, { signal }),
  save: (id, matchId, version, result) => request(`/api/events?id=${encodeURIComponent(id)}&match=${encodeURIComponent(matchId)}`, {
    method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ version, result }),
  }),
};
