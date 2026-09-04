import { neon } from "@neondatabase/serverless";

const schema = [
  // Separate serverless instances may initialize together; serialize their DDL.
  "SELECT pg_advisory_xact_lock(746380192)",
  `CREATE TABLE IF NOT EXISTS tennis_events (
    id UUID PRIMARY KEY,
    snapshot JSONB NOT NULL,
    owner_user_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  "ALTER TABLE tennis_events ADD COLUMN IF NOT EXISTS owner_user_id TEXT",
  "CREATE INDEX IF NOT EXISTS tennis_events_owner_created_idx ON tennis_events (owner_user_id, created_at DESC)",
  `CREATE TABLE IF NOT EXISTS tennis_results (
    event_id UUID NOT NULL REFERENCES tennis_events(id),
    match_id TEXT NOT NULL,
    result JSONB NOT NULL,
    version INTEGER NOT NULL CHECK (version > 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (event_id, match_id)
  )`,
];

function publicResult(row) {
  return { ...row.result, version: row.version, updatedAt: new Date(row.updated_at).toISOString() };
}

// The production adapter uses Neon HTTP; tests run these same queries in PostgreSQL.
export function createEventStore(database) {
  let ready;
  async function initialize() {
    if (!ready) ready = database.transaction(schema.map((query) => [query, []])).catch((error) => { ready = null; throw error; });
    await ready;
  }
  return {
    async create(id, snapshot, ownerUserId) {
      await initialize();
      const rows = await database.query(
        "INSERT INTO tennis_events (id, snapshot, owner_user_id) VALUES ($1, $2::jsonb, $3) ON CONFLICT DO NOTHING RETURNING id",
        [id, JSON.stringify(snapshot), ownerUserId],
      );
      if (!rows.length) {
        const [existing] = await database.query(
          "SELECT snapshot = $2::jsonb AND owner_user_id = $3 AS same FROM tennis_events WHERE id = $1",
          [id, JSON.stringify(snapshot), ownerUserId],
        );
        if (!existing?.same) return false;
      }
      return true;
    },
    async listByOwner(ownerUserId) {
      await initialize();
      const rows = await database.query(
        "SELECT id, snapshot, created_at FROM tennis_events WHERE owner_user_id = $1 ORDER BY created_at DESC LIMIT 100",
        [ownerUserId],
      );
      return rows.map((event) => ({
        id: event.id,
        title: event.snapshot.title || "Untitled tennis event",
        createdAt: new Date(event.created_at).toISOString(),
        players: event.snapshot.players.length,
        matches: event.snapshot.rounds.reduce((total, round) => total + round.matches.length, 0),
      }));
    },
    async get(id) {
      await initialize();
      const [event] = await database.query("SELECT id, snapshot, created_at FROM tennis_events WHERE id = $1", [id]);
      if (!event) return null;
      const rows = await database.query("SELECT match_id, result, version, updated_at FROM tennis_results WHERE event_id = $1", [id]);
      return {
        id: event.id,
        snapshot: event.snapshot,
        createdAt: new Date(event.created_at).toISOString(),
        results: Object.fromEntries(rows.map((row) => [row.match_id, publicResult(row)])),
      };
    },
    async save(id, matchId, result, expectedVersion) {
      await initialize();
      const parameters = [id, matchId, JSON.stringify(result)];
      const rows = expectedVersion === 0
        ? await database.query(
          `INSERT INTO tennis_results (event_id, match_id, result, version)
           VALUES ($1, $2, $3::jsonb, 1) ON CONFLICT DO NOTHING RETURNING result, version, updated_at`, parameters)
        : await database.query(
          `UPDATE tennis_results SET result = $3::jsonb, version = version + 1, updated_at = now()
           WHERE event_id = $1 AND match_id = $2 AND version = $4 RETURNING result, version, updated_at`, [...parameters, expectedVersion]);
      return rows.length ? publicResult(rows[0]) : null;
    },
  };
}

let productionStore;

export function getDatabaseUrl(environment = process.env) {
  return environment.VERCEL_ENV === "preview"
    ? environment.PAID_BETA_DATABASE_URL || environment.PAID_BETA_DATABASE_URL_DATABASE_URL
    : environment.DATABASE_URL;
}

export function getEventStore() {
  const databaseUrl = getDatabaseUrl();
  if (!databaseUrl) {
    const error = new Error("Shared results are not available yet. The organizer needs to connect the event database in Vercel.");
    error.status = 503;
    throw error;
  }
  if (!productionStore) {
    const sql = neon(databaseUrl);
    productionStore = createEventStore({
      query: (query, parameters) => sql.query(query, parameters),
      transaction: (statements) => sql.transaction(statements.map(([query, parameters]) => sql.query(query, parameters))),
    });
  }
  return productionStore;
}
