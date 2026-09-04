import { InputError } from "./events.mjs";

const playerUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validateFrequentPlayers(input) {
  if (!Array.isArray(input?.players) || input.players.length < 1 || input.players.length > 200) {
    throw new InputError("Save 1–200 frequent players at a time.");
  }
  const names = new Set();
  return input.players.map((player) => {
    const id = typeof player?.id === "string" ? player.id.trim() : "";
    const name = typeof player?.name === "string" ? player.name.trim() : "";
    const gender = player?.gender || "";
    const normalizedName = name.toLowerCase();
    if (!playerUuid.test(id)) throw new InputError("Each frequent player needs a valid ID.");
    if (!name || name.length > 120) throw new InputError("Each frequent player needs a name of at most 120 characters.");
    if (names.has(normalizedName)) throw new InputError("Save each player name only once.");
    if (!["", "male", "female"].includes(gender)) throw new InputError("Choose a valid player gender.");
    names.add(normalizedName);
    return { id, name, normalizedName, gender };
  });
}
