import { InputError } from "./events.mjs";

const rosterUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validateRoster(input) {
  if (!input || !rosterUuid.test(input.id || "")) throw new InputError("Invalid roster ID.");
  const name = typeof input.name === "string" ? input.name.trim() : "";
  if (!name || name.length > 80) throw new InputError("Roster name must be 1–80 characters.");
  if (!Array.isArray(input.players) || input.players.length < 2 || input.players.length > 200) throw new InputError("Save 2–200 players in a roster.");
  const ids = new Set();
  const players = input.players.map((player) => {
    const id = typeof player?.id === "string" ? player.id.trim() : "";
    const playerName = typeof player?.name === "string" ? player.name.trim() : "";
    const gender = player?.gender || "";
    if (!id || id.length > 160 || ids.has(id)) throw new InputError("Each roster player needs a unique ID.");
    if (!playerName || playerName.length > 120) throw new InputError("Each roster player needs a name of at most 120 characters.");
    if (!["", "male", "female"].includes(gender)) throw new InputError("Choose a valid player gender.");
    ids.add(id);
    return { id, name: playerName, gender };
  });
  return { id: input.id, name, players };
}
