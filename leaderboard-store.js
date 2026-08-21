const fs = require('fs');
const path = require('path');

const PLAYER_COLUMNS = `
    wallet_address TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    level INTEGER NOT NULL DEFAULT 1,
    exp INTEGER NOT NULL DEFAULT 0,
    total_exp INTEGER NOT NULL DEFAULT 0,
    wins INTEGER NOT NULL DEFAULT 0,
    losses INTEGER NOT NULL DEFAULT 0,
    battles_won INTEGER NOT NULL DEFAULT 0,
    battles_lost INTEGER NOT NULL DEFAULT 0,
    highest_level INTEGER NOT NULL DEFAULT 1,
    last_updated BIGINT NOT NULL
`;

function mapPlayer(row) {
    if (!row) return null;
    return {
        walletAddress: row.walletAddress ?? row.wallet_address,
        name: row.name,
        level: Number(row.level),
        exp: Number(row.exp),
        totalExp: Number(row.totalExp ?? row.total_exp),
        wins: Number(row.wins),
        losses: Number(row.losses),
        battlesWon: Number(row.battlesWon ?? row.battles_won),
        battlesLost: Number(row.battlesLost ?? row.battles_lost),
        highestLevel: Number(row.highestLevel ?? row.highest_level),
        lastUpdated: Number(row.lastUpdated ?? row.last_updated)
    };
}

class LeaderboardStore {
    constructor(options = {}) {
        this.databaseUrl = options.databaseUrl || '';
        this.sqlitePath = options.sqlitePath || path.join(__dirname, 'data', 'bonkler.sqlite');
        this.backend = this.databaseUrl ? 'postgres' : 'sqlite';
        this.pool = null;
        this.sqlite = null;
    }

    async initialize() {
        if (this.backend === 'postgres') {
            const { Pool } = require('pg');
            const ssl = process.env.DATABASE_SSL === 'require'
                ? { rejectUnauthorized: false }
                : undefined;
            this.pool = new Pool({ connectionString: this.databaseUrl, ssl });
            await this.pool.query(`CREATE TABLE IF NOT EXISTS leaderboard_players (${PLAYER_COLUMNS})`);
            await this.pool.query(`
                CREATE INDEX IF NOT EXISTS leaderboard_score_idx
                ON leaderboard_players (total_exp DESC, wins DESC, losses ASC, last_updated ASC)
            `);
            return;
        }

        const { DatabaseSync } = require('node:sqlite');
        fs.mkdirSync(path.dirname(this.sqlitePath), { recursive: true });
        this.sqlite = new DatabaseSync(this.sqlitePath);
        this.sqlite.exec('PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;');
        this.sqlite.exec(`CREATE TABLE IF NOT EXISTS leaderboard_players (${PLAYER_COLUMNS})`);
        this.sqlite.exec(`
            CREATE INDEX IF NOT EXISTS leaderboard_score_idx
            ON leaderboard_players (total_exp DESC, wins DESC, losses ASC, last_updated ASC)
        `);
    }

    async count() {
        if (this.backend === 'postgres') {
            const result = await this.pool.query('SELECT COUNT(*)::int AS count FROM leaderboard_players');
            return Number(result.rows[0].count);
        }
        return Number(this.sqlite.prepare('SELECT COUNT(*) AS count FROM leaderboard_players').get().count);
    }

    async list(limit = 100) {
        const safeLimit = Math.max(1, Math.min(100, Number(limit) || 100));
        const select = `
            SELECT wallet_address AS "walletAddress", name, level, exp,
                   total_exp AS "totalExp", wins, losses,
                   battles_won AS "battlesWon", battles_lost AS "battlesLost",
                   highest_level AS "highestLevel", last_updated AS "lastUpdated"
            FROM leaderboard_players
            ORDER BY total_exp DESC, wins DESC, losses ASC, last_updated ASC
            LIMIT ${safeLimit}
        `;

        if (this.backend === 'postgres') {
            const result = await this.pool.query(select);
            return result.rows.map(mapPlayer);
        }
        return this.sqlite.prepare(select).all().map(mapPlayer);
    }

    async upsert(player) {
        const values = [
            player.walletAddress,
            player.name,
            player.level,
            player.exp,
            player.totalExp,
            player.wins,
            player.losses,
            player.battlesWon,
            player.battlesLost,
            player.highestLevel,
            player.lastUpdated
        ];

        if (this.backend === 'postgres') {
            await this.pool.query(`
                INSERT INTO leaderboard_players (
                    wallet_address, name, level, exp, total_exp, wins, losses,
                    battles_won, battles_lost, highest_level, last_updated
                ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
                ON CONFLICT (wallet_address) DO UPDATE SET
                    name = EXCLUDED.name,
                    level = GREATEST(leaderboard_players.level, EXCLUDED.level),
                    exp = CASE WHEN EXCLUDED.total_exp >= leaderboard_players.total_exp THEN EXCLUDED.exp ELSE leaderboard_players.exp END,
                    total_exp = GREATEST(leaderboard_players.total_exp, EXCLUDED.total_exp),
                    wins = GREATEST(leaderboard_players.wins, EXCLUDED.wins),
                    losses = GREATEST(leaderboard_players.losses, EXCLUDED.losses),
                    battles_won = GREATEST(leaderboard_players.battles_won, EXCLUDED.battles_won),
                    battles_lost = GREATEST(leaderboard_players.battles_lost, EXCLUDED.battles_lost),
                    highest_level = GREATEST(leaderboard_players.highest_level, EXCLUDED.highest_level),
                    last_updated = EXCLUDED.last_updated
            `, values);
        } else {
            this.sqlite.prepare(`
                INSERT INTO leaderboard_players (
                    wallet_address, name, level, exp, total_exp, wins, losses,
                    battles_won, battles_lost, highest_level, last_updated
                ) VALUES (?,?,?,?,?,?,?,?,?,?,?)
                ON CONFLICT (wallet_address) DO UPDATE SET
                    name = excluded.name,
                    level = MAX(leaderboard_players.level, excluded.level),
                    exp = CASE WHEN excluded.total_exp >= leaderboard_players.total_exp THEN excluded.exp ELSE leaderboard_players.exp END,
                    total_exp = MAX(leaderboard_players.total_exp, excluded.total_exp),
                    wins = MAX(leaderboard_players.wins, excluded.wins),
                    losses = MAX(leaderboard_players.losses, excluded.losses),
                    battles_won = MAX(leaderboard_players.battles_won, excluded.battles_won),
                    battles_lost = MAX(leaderboard_players.battles_lost, excluded.battles_lost),
                    highest_level = MAX(leaderboard_players.highest_level, excluded.highest_level),
                    last_updated = excluded.last_updated
            `).run(...values);
        }

        return this.getRank(player.walletAddress);
    }

    async getRank(walletAddress) {
        const rankQuery = `
            SELECT rank, wallet_address AS "walletAddress", name, level, exp,
                   total_exp AS "totalExp", wins, losses,
                   battles_won AS "battlesWon", battles_lost AS "battlesLost",
                   highest_level AS "highestLevel", last_updated AS "lastUpdated"
            FROM (
                SELECT ROW_NUMBER() OVER (
                    ORDER BY total_exp DESC, wins DESC, losses ASC, last_updated ASC
                ) AS rank, *
                FROM leaderboard_players
            ) ranked
            WHERE wallet_address = ${this.backend === 'postgres' ? '$1' : '?'}
        `;

        const row = this.backend === 'postgres'
            ? (await this.pool.query(rankQuery, [walletAddress])).rows[0]
            : this.sqlite.prepare(rankQuery).get(walletAddress);
        if (!row) return null;
        return { rank: Number(row.rank), player: mapPlayer(row) };
    }

    async importPlayers(players) {
        if (!Array.isArray(players) || players.length === 0 || await this.count() > 0) return 0;
        let imported = 0;
        for (const player of players) {
            await this.upsert(player);
            imported++;
        }
        return imported;
    }

    async close() {
        if (this.pool) await this.pool.end();
        if (this.sqlite) this.sqlite.close();
    }
}

module.exports = { LeaderboardStore };
