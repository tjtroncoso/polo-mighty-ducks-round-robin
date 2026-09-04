function validInteger(value, minimum, maximum) {
  const number = Number(value);
  return String(value).trim() !== "" && Number.isInteger(number) && number >= minimum && number <= maximum;
}

function plural(count, singular, pluralForm = `${singular}s`) {
  return count === 1 ? singular : pluralForm;
}

export function getSetupIssues({ playerRows, startTime, matchFormat, minutesPerRound, gamesToWin, courts, rounds, mode }) {
  const namedPlayers = playerRows.filter((row) => row.name.trim());
  const minimumPlayers = mode === "singles" ? 2 : 4;
  const playersNeeded = Math.max(0, minimumPlayers - namedPlayers.length);
  const issues = [];

  if (playersNeeded > 0) {
    issues.push({
      targetId: "add-player",
      label: `Add ${playersNeeded} more named ${plural(playersNeeded, "player")}`,
    });
  }
  if (!startTime.trim()) issues.push({ targetId: "start-time", label: "Enter a start time" });
  if (matchFormat === "timed" && !validInteger(minutesPerRound, 5, 180)) {
    issues.push({ targetId: "minutes-per-round", label: "Enter minutes per round (5–180)" });
  }
  if (matchFormat === "games" && !validInteger(gamesToWin, 1, 99)) {
    issues.push({ targetId: "games-to-win", label: "Enter games to win (1–99)" });
  }
  if (!validInteger(courts, 1, 50)) issues.push({ targetId: "courts", label: "Enter the number of courts (1–50)" });
  if (!validInteger(rounds, 1, 50)) issues.push({ targetId: "rounds", label: "Enter the number of rounds (1–50)" });

  const lateWithoutTime = namedPlayers.find((row) => row.isLate && !row.arrival.trim());
  if (lateWithoutTime) {
    issues.push({ targetId: `arrival-${lateWithoutTime.id}`, label: `Enter an arrival time for ${lateWithoutTime.name.trim()}` });
  }

  if (mode === "mixed" && namedPlayers.length >= minimumPlayers) {
    const withoutGender = namedPlayers.filter((row) => !row.gender);
    if (withoutGender.length > 0) {
      issues.push({
        targetId: `gender-${withoutGender[0].id}`,
        label: `Select Male/Female for ${withoutGender.length} ${plural(withoutGender.length, "player")}`,
      });
    } else {
      const maleCount = namedPlayers.filter((row) => row.gender === "male").length;
      const femaleCount = namedPlayers.filter((row) => row.gender === "female").length;
      if (maleCount < 2) issues.push({ targetId: `gender-${namedPlayers[0].id}`, label: "Choose at least 2 male players for mixed doubles" });
      if (femaleCount < 2) issues.push({ targetId: `gender-${namedPlayers[0].id}`, label: "Choose at least 2 female players for mixed doubles" });
    }
  }

  return issues;
}
