# Tennis Round Robin Generator

Create round robin schedules for tennis groups, clubs, and social play. Supports rotating or locked doubles partners, mixed doubles, optional singles courts, late arrivals, custom court numbers, and copyable schedules.

## Pairings and match formats

- Use **Keep paired with** on either player's row to lock a partnership for all rounds and shuffles. Choose **Rotate partners** on either row to unlock it. Removing a player or clearing their name releases the pairing.
- Mixed doubles locks require one male and one female player. Incompatible pairings show an error until corrected or unlocked. Locked players wait for a late partner and are never assigned to an extra singles court.
- Choose **Timed**, **First to**, **Full Set**, or **Full Match**. **First to** shows a **Games to win** field (1–99, default 3), similar to the minutes field for timed rounds. The chosen number appears in the schedule, copied text, and published event. There is no automated timer.
- Non-timed rounds start when all courts finish. If anyone arrives late, set **Estimated minutes / round** to plan their availability. The app labels that estimate in the schedule; update it if the actual pace changes.

Ready-to-deploy Vite + React app.

## Publish a lineup and enter results

1. Generate the lineup, optionally name the event, and choose **Publish lineup & track results**.
2. Share the event link with the group. Anyone holding that link can enter, correct, or clear scores without an account. The link is the access key; there is no organizer-only role or public event directory.
3. On each court, choose **Enter score**, then **Save progress** or **Save final score**. The page checks for shared updates every 15 seconds and when returning to the tab. If another person edits the same match, load their score before making a correction.

Publishing saves an immutable lineup in PostgreSQL. Editing or shuffling the generator afterward cannot change it; publish a new event for a new lineup. Repeating a publication after a lost response returns the same event. Keep the event link to return later; there is no account-based event history.

Scoring:

- **Timed:** games won, with draws allowed.
- **First to:** the winning side must reach the chosen target; no win-by-two requirement.
- **Full Set:** a completed standard set, including 7–6, or an advantage set won by two. A set tiebreak's points are not entered separately.
- **Full Match:** record 1–5 standard sets according to the group's agreed match length. An optional deciding match tiebreak is first to 10 points, win by two. Use **Save progress** for unfinished play. Retirement, walkover, and custom short-set scoring are not supported yet.

Standings count completed matches only: 2 points for a win, 1 for a draw, 0 for a loss; ties use game difference and then games won. Exact ties are displayed alphabetically. Both doubles partners receive the result. A separate view tracks locked pairs. Match tiebreak points decide the winner but do not inflate games won. Clearing or correcting a result recalculates standings.

## Local test

```bash
npm install
npm run dev
```

Run `npm test` for scheduling, scoring, and API/database checks; `npm run build` builds the frontend. API tests use PGlite (PostgreSQL in WebAssembly), including persistence after a database restart and conflicting writes. They do not require a cloud database or network connection.

`npm run dev` serves the frontend only. To use shared results locally, sign in and link this repository with the Vercel CLI, connect a development Neon database, then run `vercel env pull .env.local` and `vercel dev`. Never commit environment files or connection strings.

## Vercel

Framework: Vite
Build command: npm run build
Output directory: dist

### One-time database setup

Shared results need a database; schedule generation and copying work without one.

1. Open this project's **Storage** tab in Vercel and create or connect a **Neon Postgres** database through the [Vercel Marketplace](https://vercel.com/marketplace/neon). Choose the plan and region in the dashboard.
2. Connect the database to this project for **Production** and **Preview** (and Development if needed). Confirm it supplies the server environment variable `DATABASE_URL`. Keep preview/development data separate from production using the integration's database branches or separate databases.
3. Redeploy after connecting the database, or merge this feature after the connection is in place. Environment variables apply to new deployments.

The API creates its two tables (`tennis_events`, `tennis_results`) automatically on first use, using a PostgreSQL advisory lock so simultaneous function starts are safe. No manual SQL migration is needed for initial setup. The connection role needs permission to create these tables. Database errors fail explicitly; the app never substitutes local-only results or reports a successful publish without a database write.

`api/events.mjs` is a Vercel Node.js function. `vercel.json` sends `/events/:id` to the React app without rewriting `/api/events`. Database access stays on the server, and responses containing events/scores are not cached. Event pages ask search engines not to index them and omit referrer information. These headers do not replace the link-based editing policy above.

Before sharing an event with the group, publish on the deployed site, open the link on a second device, save a score, and confirm it appears on the first device. Automated local tests cannot verify your Vercel account's database connection.
