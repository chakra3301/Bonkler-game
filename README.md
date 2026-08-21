# Bonkler Battle

A retro browser fighting game for building layered Bonkler units, buying components, and battling AI opponents. The interface keeps its Windows 2000-style shell while supporting modern responsive, keyboard, and reduced-motion behavior.

[View the Bonklers collection on Magic Eden](https://magiceden.io/marketplace/bonklers)

## Features

- Instant **Demo Mode** with 3 playable fighters and 1,200 starter coins
- Optional Solana wallet connection and Bonkler collection loading
- Layered fighter builder with purchased equipment
- Turn-based AI battles with Rookie, Standard, and Elite threat levels
- Defense-aware damage, stackable power-ups, guard/counter/repair skills, and scaled rewards
- Custom geometric symbol set with no platform-dependent emoji rendering
- Canvas combat sequences for slash, overdrive, guard, dodge, repair, counter, and beam attacks
- Viewport-fitted battle console with arena, controls, health, and live log visible together
- Stat-priced component economy and persistent local progression
- Database-backed global leaderboard with PostgreSQL and SQLite support
- Responsive desktop/mobile interface and optional synthesized UI audio

## Run Locally

Node.js 22 or newer is recommended for the zero-config SQLite development database.

```bash
npm install
npm start
```

Open [http://localhost:3001](http://localhost:3001).

Demo Mode works without credentials. To enable wallet NFT loading, copy the environment template and add a server-side Helius key:

```bash
cp .env.example .env
# Add HELIUS_API_KEY to .env, then export it or load it in your host.
HELIUS_API_KEY="your-key" npm start
```

The provider key is used only by `server.js`; it is never exposed in browser code.

## Main Files

- `index.html` — game interface and accessible application shell
- `styles.css` — token-driven Windows 2000 visual system and responsive layouts
- `game.js` — state, inventory, shop, builder, wallet, and battle systems
- `combat-animations.js` — cancellable geometric canvas combat animation engine
- `symbols.svg` — custom interface and skill symbol sprite
- `server.js` — static server, NFT proxy, and leaderboard API
- `leaderboard-store.js` — PostgreSQL/SQLite leaderboard storage adapter
- `design-tokens.json` — color, type, spacing, and motion decisions
- `nft-metadata/output-jsons/` — local Bonkler metadata
- `ACCESSORIES/`, `ARMORS/`, `BODIES/`, `HANDS/`, `HEADS/`, `OFFHAND/`, `PILOT/` — layered fighter art

## API

- `GET /api/health`
- `GET /api/nfts/:walletAddress`
- `GET /api/leaderboard`
- `POST /api/leaderboard/submit`
- `GET /api/leaderboard/rank/:walletAddress`

Without `DATABASE_URL`, scores are stored in `data/bonkler.sqlite`. Existing `leaderboard-data.json` entries are imported automatically on the first database boot.

For production, configure a managed PostgreSQL database:

```bash
DATABASE_URL="postgresql://user:password@host:5432/bonkler" npm start
```

The table and ranking index are created automatically. Set `DATABASE_SSL=require` when required by the provider.

## Production Notes

- Set `HELIUS_API_KEY` in the deployment environment.
- Serve through HTTPS for wallet extensions.
- Set `DATABASE_URL` to persistent PostgreSQL storage; local SQLite is intended for a single durable server.
- Static assets are cached; text responses are compressed.
- The game honors `prefers-reduced-motion` and does not enable sound until requested.
