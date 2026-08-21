const express = require('express');
const cors = require('cors');
const compression = require('compression');
const fs = require('fs').promises;
const path = require('path');
const { LeaderboardStore } = require('./leaderboard-store');

const app = express();
const PORT = Number(process.env.PORT) || 3001;
const ROOT = __dirname;
const LEGACY_LEADERBOARD_FILE = path.join(ROOT, 'leaderboard-data.json');
const leaderboardStore = new LeaderboardStore({
    databaseUrl: process.env.DATABASE_URL,
    sqlitePath: process.env.SQLITE_PATH || path.join(ROOT, 'data', 'bonkler.sqlite')
});
const HELIUS_API_KEY = process.env.HELIUS_API_KEY || '';
const HELIUS_RPC_URL = process.env.HELIUS_RPC_URL || (
    HELIUS_API_KEY ? `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}` : ''
);

app.disable('x-powered-by');
app.use(cors());
app.use(compression());
app.use(express.json({ limit: '32kb' }));
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    next();
});

function boundedNumber(value, max = 100000000) {
    const number = Number(value);
    if (!Number.isFinite(number)) return 0;
    return Math.max(0, Math.min(max, Math.floor(number)));
}

function cleanText(value, maxLength = 64) {
    return String(value || '').replace(/[<>\u0000-\u001f]/g, '').trim().slice(0, maxLength);
}

function validWalletAddress(value) {
    return typeof value === 'string' && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value);
}

function normalizePlayer(payload) {
    const walletAddress = cleanText(payload.walletAddress, 44);
    if (!validWalletAddress(walletAddress)) return null;
    return {
        walletAddress,
        name: cleanText(payload.name, 40) || `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`,
        level: boundedNumber(payload.level, 10000),
        exp: boundedNumber(payload.exp),
        totalExp: boundedNumber(payload.totalExp),
        wins: boundedNumber(payload.wins, 1000000),
        losses: boundedNumber(payload.losses, 1000000),
        battlesWon: boundedNumber(payload.battlesWon, 1000000),
        battlesLost: boundedNumber(payload.battlesLost, 1000000),
        highestLevel: boundedNumber(payload.highestLevel, 10000),
        lastUpdated: Date.now()
    };
}

// Small in-memory guard against hammering the paid NFT provider endpoint.
const nftRequests = new Map();
function nftRateLimited(address) {
    const now = Date.now();
    const recent = (nftRequests.get(address) || []).filter((time) => now - time < 60_000);
    recent.push(now);
    nftRequests.set(address, recent);
    return recent.length > 12;
}

app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        nftProviderConfigured: Boolean(HELIUS_RPC_URL),
        leaderboardStorage: leaderboardStore.backend,
        timestamp: new Date().toISOString()
    });
});

app.get('/api/nfts/:walletAddress', async (req, res) => {
    const { walletAddress } = req.params;
    if (!validWalletAddress(walletAddress)) {
        return res.status(400).json({ error: 'A valid Solana wallet address is required.' });
    }
    if (!HELIUS_RPC_URL) {
        return res.status(503).json({ error: 'NFT provider is not configured. Set HELIUS_API_KEY on the server.' });
    }
    if (nftRateLimited(walletAddress)) {
        return res.status(429).json({ error: 'Too many collection refreshes. Try again in one minute.' });
    }

    try {
        const response = await fetch(HELIUS_RPC_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: 'bonkler-collection',
                method: 'getAssetsByOwner',
                params: {
                    ownerAddress: walletAddress,
                    page: 1,
                    limit: 1000,
                    displayOptions: { showUnverifiedCollections: true }
                }
            }),
            signal: AbortSignal.timeout(15_000)
        });
        if (!response.ok) throw new Error(`Provider returned ${response.status}`);
        const payload = await response.json();
        if (payload.error) throw new Error(payload.error.message || 'NFT provider error');
        res.setHeader('Cache-Control', 'private, max-age=30');
        return res.json({ items: payload.result?.items || [] });
    } catch (error) {
        console.error('NFT provider error:', error.message);
        return res.status(502).json({ error: 'Unable to load the wallet collection right now.' });
    }
});

app.get('/api/leaderboard', async (req, res) => {
    try {
        res.setHeader('Cache-Control', 'no-cache');
        res.json(await leaderboardStore.list(100));
    } catch {
        res.status(500).json({ error: 'Failed to load leaderboard' });
    }
});

app.post('/api/leaderboard/submit', async (req, res) => {
    try {
        const playerData = normalizePlayer(req.body || {});
        if (!playerData) return res.status(400).json({ error: 'A valid wallet address is required.' });

        const result = await leaderboardStore.upsert(playerData);
        res.json({
            success: true,
            message: 'Score submitted successfully',
            rank: result.rank
        });
    } catch (error) {
        console.error('Error submitting score:', error);
        res.status(500).json({ error: 'Failed to submit score' });
    }
});

app.get('/api/leaderboard/rank/:walletAddress', async (req, res) => {
    try {
        if (!validWalletAddress(req.params.walletAddress)) return res.status(400).json({ error: 'Invalid wallet address' });
        const result = await leaderboardStore.getRank(req.params.walletAddress);
        if (!result) return res.json({ rank: null, message: 'Player not found' });
        res.json(result);
    } catch {
        res.status(500).json({ error: 'Failed to get player rank' });
    }
});

app.use(express.static(ROOT, {
    etag: true,
    maxAge: '1h',
    setHeaders: (res, filePath) => {
        if (/\.(png|jpg|jpeg|webp)$/i.test(filePath)) res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
        if (/\.html$/i.test(filePath)) res.setHeader('Cache-Control', 'no-cache');
    }
}));

async function initializeStorage() {
    await leaderboardStore.initialize();

    // Preserve existing local leaderboard data during the first database boot.
    try {
        const legacyPlayers = JSON.parse(await fs.readFile(LEGACY_LEADERBOARD_FILE, 'utf8'));
        const normalizedPlayers = legacyPlayers.map(normalizePlayer).filter(Boolean);
        const imported = await leaderboardStore.importPlayers(normalizedPlayers);
        if (imported > 0) console.log(`Migrated ${imported} legacy leaderboard entries.`);
    } catch (error) {
        if (error.code !== 'ENOENT') console.warn('Legacy leaderboard migration skipped:', error.message);
    }
}

initializeStorage().then(() => {
    app.listen(PORT, () => {
        console.log(`Bonkler Battle server: http://localhost:${PORT}`);
        console.log(`Leaderboard storage: ${leaderboardStore.backend}`);
        console.log(`NFT provider: ${HELIUS_RPC_URL ? 'configured' : 'not configured (set HELIUS_API_KEY)'}`);
    });
}).catch((error) => {
    console.error('Failed to start server:', error);
    process.exitCode = 1;
});

async function shutdown() {
    await leaderboardStore.close();
    process.exit(0);
}
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
