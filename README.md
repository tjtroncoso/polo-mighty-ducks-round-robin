# Tennis Round Robin Generator

Create round robin schedules for tennis groups, clubs, and social play. Supports rotating or locked doubles partners, mixed doubles, optional singles courts, late arrivals, custom court numbers, and copyable schedules.

## Pairings and match formats

- Use **Keep paired with** on either player's row to lock a partnership for all rounds and shuffles. Choose **Rotate partners** on either row to unlock it. Removing a player or clearing their name releases the pairing.
- Mixed doubles locks require one male and one female player. Incompatible pairings show an error until corrected or unlocked. Locked players wait for a late partner and are never assigned to an extra singles court.
- Choose **Timed**, **First to**, **Full Set**, or **Full Match**. **First to** shows a **Games to win** field (1–99, default 3), similar to the minutes field for timed rounds. The chosen number appears in the schedule and copied text. Full Match uses the group's agreed match scoring. These are scheduling labels, not an automated timer or scorekeeper.
- Non-timed rounds start when all courts finish. If anyone arrives late, set **Estimated minutes / round** to plan their availability. The app labels that estimate in the schedule; update it if the actual pace changes.

Ready-to-deploy Vite + React app.

## Local test

```bash
npm install
npm run dev
```

Run scheduling checks with `npm test` and the production build with `npm run build`.

## Vercel

Framework: Vite
Build command: npm run build
Output directory: dist
