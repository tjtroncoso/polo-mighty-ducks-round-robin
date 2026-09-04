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
  "ALTER TABLE tennis_events ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ",
  "CREATE INDEX IF NOT EXISTS tennis_events_owner_created_idx ON tennis_events (owner_user_id, created_at DESC)",
  `CREATE TABLE IF NOT EXISTS tennis_event_members (
    event_id UUID NOT NULL REFERENCES tennis_events(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'editor',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (event_id, user_id)
  )`,
  `CREATE TABLE IF NOT EXISTS tennis_event_invites (
    token UUID PRIMARY KEY,
    event_id UUID NOT NULL REFERENCES tennis_events(id) ON DELETE CASCADE,
    created_by TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
    claimed_at TIMESTAMPTZ,
    claimed_by TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS tennis_results (
    event_id UUID NOT NULL REFERENCES tennis_events(id),
    match_id TEXT NOT NULL,
    result JSONB NOT NULL,
    version INTEGER NOT NULL CHECK (version > 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (event_id, match_id)
  )`,
  `CREATE TABLE IF NOT EXISTS tennis_rosters (
    id UUID PRIMARY KEY,
    owner_user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    players JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  "CREATE INDEX IF NOT EXISTS tennis_rosters_owner_updated_idx ON tennis_rosters (owner_user_id, updated_at DESC)",
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
        `SELECT id, snapshot, created_at, archived_at,
          CASE WHEN owner_user_id = $1 THEN 'owner' ELSE 'co-organizer' END AS access_role,
          (SELECT COUNT(*) FROM tennis_results WHERE event_id = tennis_events.id AND result->>'status' = 'completed') AS completed_matches
         FROM tennis_events
         WHERE owner_user_id = $1 OR EXISTS (SELECT 1 FROM tennis_event_members WHERE event_id = tennis_events.id AND user_id = $1)
         ORDER BY created_at DESC LIMIT 200`,
        [ownerUserId],
      );
      return rows.map((event) => ({
        id: event.id,
        title: event.snapshot.title || "Untitled tennis event",
        createdAt: new Date(event.created_at).toISOString(),
        archivedAt: event.archived_at ? new Date(event.archived_at).toISOString() : null,
        players: event.snapshot.players.length,
        matches: event.snapshot.rounds.reduce((total, round) => total + round.matches.length, 0),
        completedMatches: Number(event.completed_matches),
        role: event.access_role,
      }));
    },
    async setArchived(id, ownerUserId, archived) {
      await initialize();
      const rows = await database.query(
        "UPDATE tennis_events SET archived_at = CASE WHEN $3 THEN now() ELSE NULL END WHERE id = $1 AND owner_user_id = $2 RETURNING archived_at",
        [id, ownerUserId, archived],
      );
      return rows.length ? (rows[0].archived_at ? new Date(rows[0].archived_at).toISOString() : null) : undefined;
    },
    async duplicate(id, newId, ownerUserId) {
      await initialize();
      const [source] = await database.query(
        `SELECT snapshot FROM tennis_events WHERE id = $1 AND
         (owner_user_id = $2 OR EXISTS (SELECT 1 FROM tennis_event_members WHERE event_id = tennis_events.id AND user_id = $2))`,
        [id, ownerUserId],
      );
      if (!source) return null;
      const snapshot = structuredClone(source.snapshot);
      snapshot.title = `${snapshot.title} copy`.slice(0, 120);
      const rows = await database.query(
        "INSERT INTO tennis_events (id, snapshot, owner_user_id) VALUES ($1, $2::jsonb, $3) ON CONFLICT DO NOTHING RETURNING id",
        [newId, JSON.stringify(snapshot), ownerUserId],
      );
      return rows.length ? { id: rows[0].id, snapshot } : false;
    },
    async createInvite(eventId, token, ownerUserId) {
      await initialize();
      const rows = await database.query(
        `INSERT INTO tennis_event_invites (token, event_id, created_by)
         SELECT $1, id, $2 FROM tennis_events WHERE id = $3 AND owner_user_id = $2
         ON CONFLICT DO NOTHING RETURNING token, expires_at`,
        [token, ownerUserId, eventId],
      );
      return rows.length ? { token: rows[0].token, expiresAt: new Date(rows[0].expires_at).toISOString() } : null;
    },
    async claimInvite(token, userId) {
      await initialize();
      const rows = await database.query(
        `WITH claimed AS (
           UPDATE tennis_event_invites SET claimed_at = now(), claimed_by = $2
           WHERE token = $1 AND claimed_at IS NULL AND expires_at > now()
           RETURNING event_id
         )
         INSERT INTO tennis_event_members (event_id, user_id)
         SELECT event_id, $2 FROM claimed
         ON CONFLICT (event_id, user_id) DO UPDATE SET role = tennis_event_members.role
         RETURNING event_id`,
        [token, userId],
      );
      return rows.length ? rows[0].event_id : null;
    },
    async deleteOwned(id, ownerUserId) {
      await initialize();
      const results = await database.transaction([
        ["DELETE FROM tennis_results WHERE event_id = $1 AND EXISTS (SELECT 1 FROM tennis_events WHERE id = $1 AND owner_user_id = $2)", [id, ownerUserId]],
        ["DELETE FROM tennis_events WHERE id = $1 AND owner_user_id = $2 RETURNING id", [id, ownerUserId]],
      ]);
      return Boolean(results[1]?.length);
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
    async listRosters(ownerUserId) {
      await initialize();
      const rows = await database.query(
        "SELECT id, name, players, created_at, updated_at FROM tennis_rosters WHERE owner_user_id = $1 ORDER BY updated_at DESC LIMIT 100",
        [ownerUserId],
      );
      return rows.map((roster) => ({
        id: roster.id,
        name: roster.name,
        players: roster.players,
        createdAt: new Date(roster.created_at).toISOString(),
        updatedAt: new Date(roster.updated_at).toISOString(),
      }));
    },
    async saveRoster(id, ownerUserId, name, players) {
      await initialize();
      const rows = await database.query(
        `INSERT INTO tennis_rosters (id, owner_user_id, name, players) VALUES ($1, $2, $3, $4::jsonb)
         ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, players = EXCLUDED.players, updated_at = now()
         WHERE tennis_rosters.owner_user_id = EXCLUDED.owner_user_id
         RETURNING id, updated_at`,
        [id, ownerUserId, name, JSON.stringify(players)],
      );
      return rows.length ? { id: rows[0].id, updatedAt: new Date(rows[0].updated_at).toISOString() } : null;
    },
    async deleteRoster(id, ownerUserId) {
      await initialize();
      const rows = await database.query("DELETE FROM tennis_rosters WHERE id = $1 AND owner_user_id = $2 RETURNING id", [id, ownerUserId]);
      return Boolean(rows.length);
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
