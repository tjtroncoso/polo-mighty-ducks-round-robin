import { buildStandings } from "./events.mjs";

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function scoreText(result) {
  if (!result?.scores?.length) return "";
  return result.scores.map((score) => `${score.a}-${score.b}${score.kind === "tiebreak" ? " TB" : ""}`).join("; ");
}

export function buildEventCsv(event) {
  const names = new Map(event.snapshot.players.map((player) => [player.id, player.name]));
  const rows = [["Event", "Round", "Time", "Court", "Side A", "Side B", "Match type", "Status", "Score"]];
  for (const round of event.snapshot.rounds) {
    for (const match of round.matches) {
      const result = event.results[match.id];
      rows.push([
        event.snapshot.title,
        round.number,
        round.time,
        match.court,
        match.pairA.map((id) => names.get(id)).join(" / "),
        match.pairB.map((id) => names.get(id)).join(" / "),
        match.type,
        result?.status || "scheduled",
        scoreText(result),
      ]);
    }
  }
  rows.push([]);
  rows.push(["Standings"]);
  rows.push(["Player", "Played", "Wins", "Losses", "Draws", "Games for", "Games against", "Points"]);
  for (const row of buildStandings(event.snapshot, event.results)) {
    rows.push([row.name, row.played, row.wins, row.losses, row.draws, row.gamesFor, row.gamesAgainst, row.points]);
  }
  return rows.map((row) => row.map(csvCell).join(",")).join("\n");
}

export function downloadEventCsv(event) {
  const blob = new Blob([buildEventCsv(event)], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.href = url;
  link.download = `${event.snapshot.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "tennis-event"}-results.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
