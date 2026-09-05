export const PRO_PRICING = Object.freeze({
  monthly: 5.99,
  annual: 39,
  annualMonthlyEquivalent: 3.25,
  foundingAnnual: 29,
});

export const PRO_VALUE_CARDS = Object.freeze([
  {
    title: "Live scoring",
    description: "Publish one link that players can open on any phone to enter and correct scores.",
  },
  {
    title: "Automatic standings",
    description: "Turn submitted results into a clear leaderboard without a separate spreadsheet.",
  },
  {
    title: "Organizer dashboard",
    description: "Find, duplicate, export, archive, and delete every event from one place.",
  },
]);

export const PLAN_COMPARISON = Object.freeze([
  { feature: "Generate singles, doubles, and mixed schedules", free: true, pro: true },
  { feature: "Timed, first-to, full-set, and full-match formats", free: true, pro: true },
  { feature: "Locked partners, late arrivals, shuffle, copy, and print", free: true, pro: true },
  { feature: "Publish a live results link", free: false, pro: true },
  { feature: "Automatic standings", free: false, pro: true },
  { feature: "Organizer dashboard and event history", free: false, pro: true },
  { feature: "Frequent Players, duplicate, archive, and delete", free: false, pro: true },
  { feature: "CSV export and co-organizer access", free: false, pro: true },
]);
