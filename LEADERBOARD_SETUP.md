# Bonkler Global Leaderboard Setup

The leaderboard API supports a zero-config local SQLite database and managed PostgreSQL for production.

## Local Development

Node.js 22+ is required for the built-in SQLite driver.

```bash
npm install
npm start
```

Open `http://localhost:3001`. Scores are written to `data/bonkler.sqlite`, which is ignored by Git.

## Production PostgreSQL

Create a PostgreSQL database with Neon, Supabase, Railway, Render, or another provider, then configure:

```bash
DATABASE_URL="postgresql://user:password@host:5432/bonkler" npm start
```

Set `DATABASE_SSL=require` only when your provider requires TLS without a local CA bundle. The `leaderboard_players` table and ranking index are created automatically at startup.

If an old `leaderboard-data.json` exists and the database is empty, valid entries are imported automatically on the first boot.

## Environment Variables

- `DATABASE_URL` — production PostgreSQL connection string; omit for local SQLite
- `DATABASE_SSL=require` — optional provider-specific TLS setting
- `SQLITE_PATH` — optional local database path override
- `PORT` — server port, default `3001`
- `HELIUS_API_KEY` — server-only NFT provider credential

## API

### `GET /api/health`
Returns server, NFT-provider, and leaderboard-storage status.

### `GET /api/leaderboard`
Returns the top 100 players ordered by total experience, wins, losses, and update time.

### `POST /api/leaderboard/submit`
Upserts a validated player score. Progress fields are monotonic, so stale clients cannot overwrite higher stored totals.

### `GET /api/leaderboard/rank/:walletAddress`
Returns one player and their current global rank.

## Persistence Behavior

Stored fields include wallet address, display name, level, current and total experience, win/loss statistics, highest level, and last update time.

- PostgreSQL supports durable multi-instance deployments.
- SQLite is durable for one server with a persistent disk.
- Browser local storage remains the offline UI fallback.
- Writes use a unique wallet constraint rather than rewriting a shared JSON file.

## Verification

```bash
npm run check
curl http://localhost:3001/api/health
curl http://localhost:3001/api/leaderboard
```

The health response should report `leaderboardStorage` as `postgres` or `sqlite`.

## Remaining Security Upgrade

Database persistence does not prove wallet ownership by itself. Before competitive rewards have monetary value, require a signed wallet challenge for score submissions and add server-authoritative battle verification.
