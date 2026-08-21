// Tuned around 5–9 round standard encounters and a meaningful purchase every 4–7 wins.
const BATTLE_BALANCE = Object.freeze({
    defenseScale: 160,
    powerUpPerStack: 0.15,
    maxPowerStacks: 3,
    guardReduction: 0.55,
    dodgeChance: 0.6,
    difficulties: {
        rookie: { label: 'Rookie', health: 0.82, attack: 0.8, defense: 0.85, reward: 0.8, actions: [0.62, 0.16] },
        standard: { label: 'Standard', health: 1, attack: 1.08, defense: 1, reward: 1, actions: [0.55, 0.25] },
        elite: { label: 'Elite', health: 1.1, attack: 1.1, defense: 1.1, reward: 1.4, actions: [0.5, 0.34] }
    }
});

// Game State Management
class GameState {
    constructor() {
        this.coins = 1200;
        this.exp = 0;
        this.level = 1;
        this.isDemoMode = true;
        this.soundEnabled = false;
        this.audioContext = null;
        this.currentShopCategory = 'pilots';
        this.nfts = [];
        this.userNFTs = [];
        this.purchasedItems = [];
        this.selectedNFT = null;
        this.currentFighter = {};
        this.fighterBuilt = false;
        this.battleMode = 'ai';
        this.battleDifficulty = 'standard';
        this.componentAssets = {};
        this.battleBackground = null;
        this.currentBattle = null;
        this.battleTimer = null;
        this.battleInterval = null;
        this.battleAnimation = null;
        this.battleLog = [];
        this.battleState = {
            powerUpActive: false,
            powerUpCount: 0,
            defendActive: false,
            dodgeActive: false,
            dodgeSuccessRate: BATTLE_BALANCE.dodgeChance,
            bonklerBeamUses: 3,
            enemyDefendActive: false,
            counterActive: false,
            healUses: 1
        };
        
        // Skills management
        this.equippedSkills = ['Slash', 'Power-up', 'Defend', 'Dodge'];
        this.availableSkills = [];
        this.maxSkills = 6;
        
        // Solana wallet state
        this.connection = null;
        this.wallet = null;
        this.publicKey = null;
        this.isConnected = false;
        
        // Verified Bonkler collection address used by the wallet filter.
        this.bonklerCollectionMint = 'HCx8AwY9ivtVNVT6rrht2StyMZgDE3yA3vGtmoRuoaeM';
        
        // Leaderboard data
        this.leaderboardData = [];
        this.playerStats = {
            wins: 0,
            losses: 0,
            totalExp: 0,
            highestLevel: 1,
            battlesWon: 0,
            battlesLost: 0
        };
        
        // Initialize shop data
        this.shopData = {
            skills: [
                { name: 'Slash', type: 'skill', cost: 0, description: 'Basic light attack', unlocked: true },
                { name: 'Power-up', type: 'skill', cost: 0, description: 'Add a permanent +15% attack stack', unlocked: true },
                { name: 'Defend', type: 'skill', cost: 0, description: 'Reduce the next damaging hit by 55%', unlocked: true },
                { name: 'Dodge', type: 'skill', cost: 0, description: '60% chance to dodge the next attack', unlocked: true },
                { name: 'Special', type: 'skill', cost: 500, description: 'Heavy attack (requires 3 power-ups)', unlocked: false },
                { name: 'Bonkler Beam', type: 'skill', cost: 1000, description: 'Devastating beam attack (65% hit rate)', unlocked: false },
                { name: 'Double Strike', type: 'skill', cost: 300, description: 'Two 0.72x defense-aware hits', unlocked: false },
                { name: 'Counter Attack', type: 'skill', cost: 400, description: 'Return an 0.85x strike after the next hit', unlocked: false },
                { name: 'Heal', type: 'skill', cost: 200, description: 'Restore 28% health once per battle', unlocked: false },
                { name: 'Critical Strike', type: 'skill', cost: 600, description: '60% chance for a 1.9x critical strike', unlocked: false }
            ]
        };
    }

    escapeHTML(value) {
        return String(value ?? '').replace(/[&<>'"]/g, (character) => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        })[character]);
    }

    symbolMarkup(name, className = '') {
        const symbol = /^[a-z-]+$/.test(name) ? name : 'package';
        const classes = String(className).replace(/[^a-z0-9 _-]/gi, '').trim();
        return `<svg class="ui-symbol${classes ? ` ${classes}` : ''}" aria-hidden="true" viewBox="0 0 24 24" focusable="false"><use href="symbols.svg?v=1.8.1#icon-${symbol}"></use></svg>`;
    }

    getSkillSymbol(skillName) {
        return ({
            Slash: 'slash',
            'Power-up': 'power',
            Defend: 'defend',
            Dodge: 'dodge',
            Special: 'special',
            'Bonkler Beam': 'beam',
            'Double Strike': 'double',
            'Counter Attack': 'counter',
            Heal: 'heal',
            'Critical Strike': 'critical'
        })[skillName] || 'special';
    }

    getItemSymbol(item) {
        if (item?.type === 'skill') return this.getSkillSymbol(item.name);
        return ({
            pilot: 'pilot',
            body: 'body',
            head: 'head',
            armor: 'defend',
            hand: 'hand',
            hands: 'hand',
            offhand: 'offhand',
            accessory: 'accessory'
        })[item?.type] || 'package';
    }

    // Battle Log Methods
    addBattleLogEntry(message, type = 'battle-event') {
        message = String(message).replace(/\.\.\./g, '…');
        const logContent = document.getElementById('battle-log-content');
        if (!logContent) return;

        const logEntry = document.createElement('div');
        logEntry.className = `log-entry ${type}`;
        logEntry.textContent = message;
        
        logContent.appendChild(logEntry);
        
        // Auto-scroll to bottom
        logContent.scrollTop = logContent.scrollHeight;
        
        // Store in battle log array
        this.battleLog.push({ message, type, timestamp: Date.now() });
        
        // Limit log entries to prevent memory issues
        if (this.battleLog.length > 50) {
            this.battleLog.shift();
            if (logContent.children.length > 50) {
                logContent.removeChild(logContent.firstChild);
            }
        }
    }

    clearBattleLog() {
        const logContent = document.getElementById('battle-log-content');
        if (logContent) {
            logContent.innerHTML = '<div class="log-entry battle-event">Battle log cleared.</div>';
        }
        this.battleLog = [];
    }

    initializeBattleLog() {
        const clearBtn = document.getElementById('clear-log-btn');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => this.clearBattleLog());
        }
        
        // Clear any existing log
        this.clearBattleLog();
        this.addBattleLogEntry('Battle arena ready! Select your fighter.', 'battle-event');
    }

    preloadBattleBackground() {
        // Try to get the preloaded image from HTML
        const preloadedImg = document.getElementById('battle-bg-preload');
        if (preloadedImg && preloadedImg.complete && preloadedImg.naturalWidth > 0) {
            console.log('Using preloaded battle background from HTML');
            this.battleBackground = preloadedImg;
            return;
        }
        
        // Fallback: create new image
        this.battleBackground = new Image();
        this.battleBackground.onload = () => {
            console.log('Battle background preloaded successfully');
            console.log('Background dimensions:', this.battleBackground.width, 'x', this.battleBackground.height);
            // Re-render battle if we're in battle mode
            if (this.currentBattle) {
                this.renderBattle();
            }
        };
        this.battleBackground.onerror = (e) => {
            console.log('Battle background failed to preload:', e);
            this.battleBackground = null;
        };
        
        // Set a timeout to ensure we don't wait forever
        setTimeout(() => {
            if (!this.battleBackground || !this.battleBackground.complete) {
                console.log('Battle background loading timed out, using fallback');
                this.battleBackground = null;
            }
        }, 3000);
        
        this.battleBackground.src = 'battle-bg.png';
    }

    async init() {
        // Start loading screen
        this.startLoadingScreen();
        
        // Initialize Solana connection
        this.updateLoadingProgress(5, 'Initializing blockchain connection...');
        this.initializeSolanaConnection();
        
        // Load game data FIRST
        this.updateLoadingProgress(10, 'Loading game data...');
        this.loadGameData();
        
        // Setup event listeners
        this.updateLoadingProgress(20, 'Setting up game controls...');
        this.setupEventListeners();
        
        // Load component assets
        this.updateLoadingProgress(30, 'Loading fighter components...');
        await this.initFighterBuilder();
        
        // The full metadata collection loads only after wallet interaction.
        this.updateLoadingProgress(50, 'Preparing fighter registry...');
        this.nftCount = 1555;
        this.currentNFTIndex = 0;
        
        // Make the game immediately playable when no wallet is connected.
        if (!this.isConnected) {
            this.updateLoadingProgress(62, 'Preparing local demo fighters...');
            await this.loadTestNFTs(null, false);
        }

        // Resolve local paths without blocking boot on every component image.
        this.updateLoadingProgress(70, 'Processing NFT data...');
        this.reprocessNFTsWithAssets();
        
        // Populate UI elements
        this.updateLoadingProgress(85, 'Building user interface...');
        this.populateNFTs();
        this.updateNFTCount();
        this.populateShop('pilots');
        this.populateInventory();
        this.updateLeaderboard();
        this.updateUI();

        // Decode fighter previews after the shell is interactive, then redraw cards.
        this.loadFighterImages(this.userNFTs).then(() => {
            this.populateNFTs();
            this.populateInventoryNFTs();
        });
        
        // Restore last selected NFT if available
        this.restoreSelectedNFT();
        
        // Preload battle background
        this.updateLoadingProgress(95, 'Preparing battle arena...');
        this.preloadBattleBackground();
        
        // Complete loading
        this.updateLoadingProgress(100, 'Game ready!');
        
        // Clear any cached data that might have old paths
        this.clearCachedPaths();
        
        // Wallet connection monitoring
        this.startWalletMonitoring();
        
        // Hide loading screen and show game
        setTimeout(() => {
            this.hideLoadingScreen();
        
        // Check if fighter is already built
        if (this.fighterBuilt) {
            this.switchScreen('battle');
        }
        }, 250);
    }

    restoreSelectedNFT() {
        // Try to restore the last selected NFT from localStorage
        const savedData = localStorage.getItem('bonklerGameData');
        if (savedData) {
            const data = JSON.parse(savedData);
            if (data.userNFTs && data.userNFTs.length > 0) {
                // Find the first NFT that has customized components
                const nftWithComponents = data.userNFTs.find(nft => 
                    nft.components && Object.keys(nft.components).length > 0
                );
                
                if (nftWithComponents) {
                    console.log('Restoring selected NFT:', nftWithComponents.name);
                    this.selectedNFT = nftWithComponents;
                    
                    // Reset to original NFT state - no customized components
                    this.builderComponents = {};
                    
                    // Render the NFT in its original state using its base components
                    this.renderNFTComponents(this.selectedNFT);
                }
            }
        }
    }

    loadGameData() {
        // Load saved data from localStorage
        const savedData = localStorage.getItem('bonklerGameData');
        if (savedData) {
            const data = JSON.parse(savedData);
            
            // Migrate old purchased items to new path format
            if (data.purchasedItems && Array.isArray(data.purchasedItems)) {
                data.purchasedItems.forEach(item => {
                    if (item.path && item.path.includes('/ARMOR/')) {
                        console.log('Migrating old armor path:', item.path);
                        item.path = item.path.replace('/ARMOR/', '/ARMORS/');
                        console.log('New armor path:', item.path);
                    }
                    // Also check for any other old path formats
                    if (item.path && item.path.includes('ARMOR/')) {
                        console.log('Migrating old armor path (no slash):', item.path);
                        item.path = item.path.replace('ARMOR/', 'ARMORS/');
                        console.log('New armor path:', item.path);
                    }
                    
                    // Regenerate path completely for armor items to ensure correct format
                    if (item.type === 'armor') {
                        const oldPath = item.path;
                        // Extract asset name from path if asset property doesn't exist
                        let assetName = item.asset;
                        if (!assetName && item.path) {
                            // Extract filename from path (e.g., "ARMOR/ArmorBlack.png" -> "ArmorBlack.png")
                            const pathParts = item.path.split('/');
                            assetName = pathParts[pathParts.length - 1];
                        }
                        
                        if (assetName) {
                            item.path = `ARMORS/${assetName}`;
                            if (oldPath !== item.path) {
                                console.log('Regenerated armor path from:', oldPath, 'to:', item.path);
                            }
                        } else {
                            console.warn('Could not regenerate armor path - missing asset name for item:', item);
                        }
                    }
                });
            }
            
            // Load connected-wallet progress or the local demo profile.
            if ((data.publicKey && data.isConnected) || data.isDemoMode) {
                console.log('Loading saved progress for wallet:', data.publicKey);
                this.coins = data.coins ?? 1200;
                this.exp = data.exp ?? 0;
                this.level = data.level ?? 1;
                this.battleDifficulty = BATTLE_BALANCE.difficulties[data.battleDifficulty]
                    ? data.battleDifficulty
                    : 'standard';
                this.nfts = data.nfts || [];
                this.fighterBuilt = data.fighterBuilt || false;
                this.currentFighter = data.currentFighter || {
                    pilot: null,
                    body: null,
                    head: null,
                    armor: null,
                    hands: null,
                    offhand: null,
                    accessory: null
                };
                this.userNFTs = data.userNFTs || [];
                this.purchasedItems = data.purchasedItems || [];
                
                // Debug: Check if customized components are loaded
                if (this.userNFTs.length > 0) {
                    console.log('Loaded userNFTs from localStorage:', this.userNFTs.length, 'NFTs');
                    this.userNFTs.forEach((nft, index) => {
                        if (nft.components && Object.keys(nft.components).length > 0) {
                            console.log(`NFT ${index} (${nft.name}) has customized components:`, nft.components);
                        } else {
                            console.log(`NFT ${index} (${nft.name}) has NO customized components`);
                        }
                    });
                } else {
                    console.log('No userNFTs found in saved data');
                }
                
                this.equippedSkills = data.equippedSkills || ['Slash', 'Power-up', 'Defend', 'Dodge'];
                this.availableSkills = data.availableSkills || [];
                this.playerStats = {
                    ...this.playerStats,
                    ...(data.playerStats || {})
                };

                // Load session state
                this.publicKey = data.publicKey || null;
                this.isConnected = Boolean(data.isConnected);
                this.isDemoMode = !this.isConnected;
                console.log('Session state loaded - publicKey:', this.publicKey, 'isConnected:', this.isConnected);
            } else {
                console.log('No connected wallet found, starting fresh');
                this.resetToFreshStart();
            }
        } else {
            console.log('No saved data found, starting fresh');
            this.resetToFreshStart();
        }
    }
    
    resetToFreshStart() {
        // Reset all game state to fresh start
        this.coins = 1200;
        this.exp = 0;
        this.level = 1;
        this.isDemoMode = true;
        this.battleDifficulty = 'standard';
        this.nfts = [];
        this.userNFTs = [];
        this.purchasedItems = [];
        this.fighterBuilt = false;
        this.currentFighter = {
            pilot: null,
            body: null,
            head: null,
            armor: null,
            hands: null,
            offhand: null,
            accessory: null
        };
        this.equippedSkills = ['Slash', 'Power-up', 'Defend', 'Dodge'];
        this.availableSkills = [];
        this.publicKey = null;
        this.isConnected = false;
        
        // Reset player stats
        this.playerStats = {
            wins: 0,
            losses: 0,
            totalExp: 0,
            highestLevel: 1,
            battlesWon: 0,
            battlesLost: 0
        };
        
        console.log('Game reset to fresh start');
    }
    
    clearCachedPaths() {
        console.log('Clearing cached paths with old format');
        // Force browser to reload images by adding a cache-busting parameter
        const images = document.querySelectorAll('img[src*="ARMOR/"]');
        images.forEach(img => {
            if (img.src.includes('ARMOR/')) {
                const newSrc = img.src.replace('ARMOR/', 'ARMORS/');
                img.src = newSrc + '?v=' + Date.now();
                console.log('Updated image src from:', img.src, 'to:', newSrc);
            }
        });
    }
    
    clearAllCachedData() {
        // Clear all localStorage data
        localStorage.removeItem('bonklerGameData');
        localStorage.removeItem('bonkler_player_stats');
        localStorage.removeItem('bonkler_leaderboard');
        
        // Reset game state
        this.resetToFreshStart();
        
        // Update UI
        this.updateUI();
        this.populateInventory();
        this.populateNFTs();
        this.updateLeaderboard();
        
        console.log('All cached data cleared');
        this.showModal('Data Cleared', 'All cached data has been cleared. The game has been reset to a fresh start.');
    }

    saveGameData() {
        const data = {
            coins: this.coins,
            exp: this.exp,
            level: this.level,
            nfts: this.nfts,
            fighterBuilt: this.fighterBuilt,
            currentFighter: this.currentFighter,
            userNFTs: this.userNFTs,
            purchasedItems: this.purchasedItems,
            equippedSkills: this.equippedSkills,
            availableSkills: this.availableSkills,
            publicKey: this.publicKey,
            isConnected: this.isConnected,
            isDemoMode: this.isDemoMode,
            battleDifficulty: this.battleDifficulty,
            playerStats: this.playerStats
        };
        
        // Debug: Check what's being saved
        if (this.userNFTs.length > 0) {
            
        }
        

        
        localStorage.setItem('bonklerGameData', JSON.stringify(data));
    }

    async loadNFTBonklers() {
        try {
            // Load individual NFT JSON files from output-jsons directory
            this.nftCount = 1555; // Total number of NFTs
            this.currentNFTIndex = 0;
            

            
            // Load first 10 NFTs for testing
            await this.loadMoreNFTs(10);
            
        } catch (error) {
            console.warn('Error loading NFT bonklers:', error);
        }
    }

    async loadMoreNFTs(count = 10) {
        if (!this.nftCount) {
            this.nftCount = 1555;
            this.currentNFTIndex = 0;
        }
        
        const endIndex = Math.min(this.currentNFTIndex + count, this.nftCount);
        const newNFTs = [];
        

        
        for (let i = this.currentNFTIndex; i < endIndex; i++) {
            try {
                const response = await fetch(`nft-metadata/output-jsons/${i}.json`);
                if (response.ok) {
                    const nftData = await response.json();
                    const gameBonkler = this.convertNFTToGameFormat(nftData, i);
                    this.nfts.push(gameBonkler);
                    newNFTs.push(gameBonkler);
                }
            } catch (error) {
                console.warn(`Failed to load NFT ${i}:`, error);
            }
        }
        
        this.currentNFTIndex = endIndex;
        

        
        // Update UI
        this.updateNFTCount();
        
        // Disable button if all NFTs are loaded
        const loadMoreBtn = document.getElementById('load-more-nfts-btn');
        if (this.currentNFTIndex >= this.nftCount) {
            loadMoreBtn.disabled = true;
            loadMoreBtn.textContent = 'All NFTs Loaded';
        }
    }

    updateNFTCount() {
        const countElement = document.getElementById('nft-count');
        if (countElement) {
            const count = this.userNFTs ? this.userNFTs.length : 0;
            countElement.textContent = `${count} fighter${count === 1 ? '' : 's'}`;
        }
    }

    convertNFTToGameFormat(nftBonkler, tokenId) {
        // Convert NFT metadata to game fighter format
        const components = {};
        
        // Map NFT attributes to game components
        if (nftBonkler.attributes && Array.isArray(nftBonkler.attributes)) {
            nftBonkler.attributes.forEach(attr => {
                const traitType = attr.trait_type;
                const value = attr.value;
                
                // Map trait types to component categories
                const categoryMap = {
                    'PILOT': 'pilot',
                    'BODIES': 'body', 
                    'HEADS': 'head',
                    'ARMORS': 'armor',
                    'HANDS': 'hands',
                    'OFFHAND': 'offhand',
                    'ACCESSORIES': 'accessory'
                };
                
                const category = categoryMap[traitType];
                if (category) {
                    // Find the corresponding asset in our component assets
                    const assets = this.componentAssets[category] || [];
                    
                    // Try to find asset by name (exact match)
                    let asset = assets.find(a => a.name === value);
                    
                    // If not found, try case-insensitive exact match
                    if (!asset) {
                        asset = assets.find(a => a.name.toLowerCase() === value.toLowerCase());
                    }
                    
                    // If still not found, try partial match
                    if (!asset) {
                        asset = assets.find(a => 
                            a.name.toLowerCase().includes(value.toLowerCase()) ||
                            value.toLowerCase().includes(a.name.toLowerCase())
                        );
                    }
                    
                    // If still not found, try removing common prefixes/suffixes
                    if (!asset) {
                        const cleanValue = value.replace(/^(Armor|Pilot|Body|Head|Hand|Offhand|Accessory)/i, '');
                        asset = assets.find(a => 
                            a.name.toLowerCase().includes(cleanValue.toLowerCase()) ||
                            cleanValue.toLowerCase().includes(a.name.toLowerCase())
                        );
                    }
                    
                    // If still not found, try specific mappings for known mismatches
                    if (!asset) {
                        const specificMappings = {
                            'BONK': 'BONK',
                            'EVIL-BONK': 'EVIL-BONK',
                            'ALIEN-BONK': 'ALIEN-BONK',
                            'HAMTARO': 'HAMTARO',
                            'KASANE-TETO': 'KASANE-TETO',
                            'BINKY': 'BINKY',
                            'ALIEN-MILADY': 'ALIEN-MILADY',
                            'BEAUTY-BEAST-BUNNY': 'BEAUTY-BEAST-BUNNY',
                            'REI': 'REI',
                            'SPRITE-AUTOGRAPH': 'SPRITE-AUTOGRAPH',
                            'YMO-TOUR': 'YMO-TOUR',
                            'RILAKKUMA': 'RILAKKUMA',
                            'TEKKEN-KING': 'TEKKEN-KING',
                            'JADE-CABBAGE': 'JADE-CABBAGE',
                            'VENDING-MACHINE': 'VENDING-MACHINE',
                            'SUIT': 'SUIT',
                            'SONY-TV': 'SONY-TV',
                            'GUAM': 'GUAM',
                            'RED-AND-BLUE-CHAIR': 'RED-AND-BLUE-CHAIR',
                            'ArmorCoal': 'ArmorCoal',
                            'ArmorBronze-Trim': 'ArmorBronze-Trim',
                            'ArmorMithril': 'ArmorMithril',
                            'ArmorPhantom': 'ArmorPhantom',
                            'ArmorBlack': 'ArmorBlack',
                            'ArmorHandycam': 'ArmorHandycam',
                            'ArmorAdamantine': 'ArmorAdamantine',
                            'EVOLVED-ANTENNA': 'EVOLVED-ANTENNA',
                            'PORSCHE-SUSPENSION': 'PORSCHE-SUSPENSION',
                            'GOLDEN-AXE': 'GOLDEN-AXE',
                            'AGHANIM-SCEPTER': 'AGHANIM-SCEPTER',
                            'WATER-PISTOL': 'WATER-PISTOL',
                            'NEWJEANS-HAMMER': 'NEWJEANS-HAMMER',
                            'BLUDGEONING-ANGEL': 'BLUDGEONING-ANGEL',
                            'ARMED-THREAT': 'ARMED-THREAT',
                            'AMERICAN-FLAG': 'AMERICAN-FLAG',
                            'POCKET-PET': 'POCKET-PET',
                            'REMILIA-FILMS': 'REMILIA-FILMS',
                            'YEN': 'YEN',
                            'PALETTE': 'PALETTE',
                            'SUBMARINE-CABLE': 'SUBMARINE-CABLE',
                            'DAIHATSU-MIDGET': 'DAIHATSU-MIDGET',
                            'DWARF-FORTRESS-GREEK-BEDROOM-BLUEPRINT': 'DWARF-FORTRESS-GREEK-BEDROOM-BLUEPRINT',
                            'RAVER-CAP': 'RAVER-CAP',
                            'HALO': 'HALO',
                            'HIKKIKOMORI': 'HIKKIKOMORI'
                        };
                        
                        const mappedValue = specificMappings[value];
                        if (mappedValue) {
                            asset = assets.find(a => a.name === mappedValue);
                        }
                    }
                    
                    if (asset) {
                        components[category] = asset;
                    } else {
                        // Create a fallback component with basic stats
                        components[category] = {
                            name: value,
                            type: category,
                            attack: 5,
                            defense: 5,
                            image: null // Will be handled by renderFighterPreview
                        };
                    }
                }
            });
        }
        
        // Generate stats based on components and rarity
        const baseStats = this.calculateStatsFromComponents(components);
        
        return {
            id: `bonkler_${tokenId}`,
            name: nftBonkler.name || `BONKLER #${tokenId}`,
            level: 1,
            attack: baseStats.attack,
            defense: baseStats.defense,
            health: baseStats.health,
            maxHealth: baseStats.health,
            components: components,
            isNFT: true,
            tokenId: tokenId.toString(),
            rarity: this.calculateRarity(components),
            description: nftBonkler.description || 'Mecha bonks inspired by bonkler'
        };
    }

    calculateStatsFromComponents(components) {
        let attack = 50;
        let defense = 30;
        let health = 400;
        
        // Add stats based on components (you can customize this)
        Object.keys(components).forEach(category => {
            const component = components[category];
            if (component) {
                // Add some base stats for each component type
                switch (category) {
                    case 'pilot':
                        attack += 10;
                        break;
                    case 'body':
                        defense += 15;
                        health += 50;
                        break;
                    case 'head':
                        attack += 5;
                        break;
                    case 'armor':
                        defense += 20;
                        health += 30;
                        break;
                    case 'hands':
                        attack += 15;
                        break;
                    case 'offhand':
                        attack += 8;
                        defense += 8;
                        break;
                    case 'accessory':
                        attack += 3;
                        defense += 3;
                        break;
                }
            }
        });
        
        return { attack, defense, health };
    }

    calculateRarity(components) {
        // Simple rarity calculation based on component count
        const componentCount = Object.keys(components).length;
        
        if (componentCount >= 7) return 'legendary';
        if (componentCount >= 6) return 'epic';
        if (componentCount >= 5) return 'rare';
        return 'common';
    }

    initializeSolanaConnection() {
        // Wallet discovery works without solana-web3. Legacy metadata helpers use the
        // public RPC only when the optional browser library is available. NFT loading
        // itself is proxied by server.js so provider credentials never ship to clients.
        this.connection = null;
        if (!window.solanaWeb3) return;

        try {
            this.connection = new window.solanaWeb3.Connection(
                'https://api.mainnet-beta.solana.com',
                'confirmed'
            );
        } catch (error) {
            console.warn('Optional Solana connection unavailable:', error);
        }
    }

    async tryAlternativeRPC() {
        // Use Helius RPC as primary fallback, then public endpoints
        const rpcEndpoints = [
            'https://api.mainnet-beta.solana.com',
            'https://solana-api.projectserum.com'
        ];

        for (const endpoint of rpcEndpoints) {
            try {
                console.log(`Trying RPC endpoint: ${endpoint}`);
                const testConnection = new solanaWeb3.Connection(endpoint, 'confirmed');
                await testConnection.getSlot(); // Test the connection
                this.connection = testConnection;
                console.log(`Successfully connected to: ${endpoint}`);
                return true;
            } catch (error) {
                console.warn(`Failed to connect to ${endpoint}:`, error.message);
            }
        }
        
        console.error('All RPC endpoints failed');
        return false;
    }

    async connectWallet() {
        try {
            // Try Wallet Standard first (supports all major wallets)
            if (navigator.wallets) {
                try {
                    const wallets = await navigator.wallets.get();
                    if (wallets && wallets.length > 0) {
                        const wallet = wallets[0];
                        const accounts = await wallet.features['standard:connect'].connect();
                        
                        if (accounts && accounts.length > 0) {
                            this.publicKey = accounts[0].address;
                            this.wallet = wallet;
                            this.isConnected = true;
                            this.isDemoMode = false;
        
        // Update wallet button
                            this.updateWalletButton();
                            
                            // Check if we already have saved NFTs for this wallet
                            const savedData = localStorage.getItem('bonklerGameData');
                            console.log('Checking saved data for wallet:', this.publicKey);
                            if (savedData) {
                                const data = JSON.parse(savedData);
                                console.log('Saved data publicKey:', data.publicKey);
                                console.log('Current publicKey:', this.publicKey);
                                console.log('Saved userNFTs count:', data.userNFTs ? data.userNFTs.length : 0);
                                
                                if (data.publicKey === this.publicKey && data.userNFTs && data.userNFTs.length > 0) {
                                    console.log('Using saved NFTs from localStorage');
                                    this.userNFTs = data.userNFTs;
                                    
                                    // Debug: Check customized components
                                    this.userNFTs.forEach((nft, index) => {
                                        if (nft.components && Object.keys(nft.components).length > 0) {
                                            console.log(`NFT ${index} has customized components:`, nft.components);
                                        }
                                    });
                                    
                                    this.populateInventory();
                                    this.populateNFTs();
                                } else {
                                    // Try to load NFTs from blockchain, but don't fail if RPC is down
                                    try {
                                        await this.loadUserNFTs(this.publicKey);
                                    } catch (nftError) {
                                        console.log('NFT loading failed, using demo mode:', nftError);
                                        await this.loadTestNFTs(this.publicKey);
                                    }
                                }
                            } else {
                                // Try to load NFTs from blockchain, but don't fail if RPC is down
                                try {
                                    await this.loadUserNFTs(this.publicKey);
                                } catch (nftError) {
                                    console.log('NFT loading failed, using demo mode:', nftError);
                                    await this.loadTestNFTs(this.publicKey);
                                }
                            }
                            
                            // Save wallet state
                            this.saveGameData();
                            
                            this.showModal('Wallet Connected', `Successfully connected to wallet: ${this.publicKey}`);
                            return;
                        }
                    }
                } catch (walletStandardError) {
                    console.log('Wallet Standard failed, trying fallback:', walletStandardError);
                }
            }

            // Fallback to Phantom wallet
            if (window.solana && window.solana.isPhantom) {
                const response = await window.solana.connect();
                this.publicKey = response.publicKey.toString();
                this.wallet = window.solana;
                this.isConnected = true;
                this.isDemoMode = false;

                // Update wallet button
                this.updateWalletButton();

                // Check if we already have saved NFTs for this wallet
                const savedData = localStorage.getItem('bonklerGameData');
                console.log('Checking saved data for Phantom wallet:', this.publicKey);
                if (savedData) {
                    const data = JSON.parse(savedData);
                    console.log('Saved data publicKey:', data.publicKey);
                    console.log('Current publicKey:', this.publicKey);
                    console.log('Saved userNFTs count:', data.userNFTs ? data.userNFTs.length : 0);
                    
                    if (data.publicKey === this.publicKey && data.userNFTs && data.userNFTs.length > 0) {
                        console.log('Using saved NFTs from localStorage (Phantom)');
                        this.userNFTs = data.userNFTs;
                        
                        // Debug: Check customized components
                        this.userNFTs.forEach((nft, index) => {
                            if (nft.components && Object.keys(nft.components).length > 0) {
                                console.log(`NFT ${index} has customized components:`, nft.components);
                            }
                        });
                        
                        this.populateInventory();
                        this.populateNFTs();
                    } else {
                        // Try to load NFTs from blockchain, but don't fail if RPC is down
                        try {
                            await this.loadUserNFTs(this.publicKey);
                        } catch (nftError) {
                            console.log('NFT loading failed, using demo mode:', nftError);
                            await this.loadTestNFTs(this.publicKey);
                        }
                    }
                } else {
                    // Try to load NFTs from blockchain, but don't fail if RPC is down
                    try {
                        await this.loadUserNFTs(this.publicKey);
                    } catch (nftError) {
                        console.log('NFT loading failed, using demo mode:', nftError);
                        await this.loadTestNFTs(this.publicKey);
                    }
                }

                // Save wallet state
                this.saveGameData();

                this.showModal('Wallet Connected', `Successfully connected to Phantom wallet: ${this.publicKey}`);
            } else {
                this.showModal('Wallet Required', 
                    'Please install a Solana wallet extension (like Phantom, Solflare, or Backpack) to connect.');
            }
                
            } catch (error) {
                console.error('Error connecting wallet:', error);
                this.showModal('Connection Failed', 'Failed to connect wallet. Please try again.');
            }
    }

        async loadUserNFTs(publicKey) {
        console.log('Loading Bonkler NFTs for wallet:', publicKey);
        
        if (!publicKey) {
            console.error('No public key provided');
            return;
        }

        try {
            console.log('Fetching NFTs through the same-origin collection API...');

            const res = await fetch(`/api/nfts/${encodeURIComponent(publicKey)}`);
            if (!res.ok) {
                const details = await res.json().catch(() => ({}));
                throw new Error(details.error || `NFT service returned ${res.status}`);
            }

            const data = await res.json();
            const items = Array.isArray(data.items) ? data.items : [];

            if (items.length === 0) {
                console.warn('No NFTs found for wallet:', publicKey);
                await this.loadTestNFTs(publicKey);
                this.showModal('Test Mode', 'No NFTs found in your wallet. Loaded test NFTs for demonstration.');
                return;
            }

            const allNFTs = items;
            console.log(`Found ${allNFTs.length} total NFTs`);

            // Filter for Bonkler NFTs by name or collection address
            const bonklerNFTs = allNFTs.filter(nft => {
                const name = nft.content?.metadata?.name?.toLowerCase() || '';
                const symbol = nft.content?.metadata?.symbol?.toLowerCase() || '';
                
                // Check for Bonkler collection address
                const isBonklerCollection = nft.grouping?.some((group) =>
                    group.group_value === this.bonklerCollectionMint
                );
                
                // Check for Bonkler terms in name/symbol
                const hasBonklerTerms = name.includes('bonkler') || symbol.includes('bonkler');
                
                console.log(`Checking NFT: ${name} (${symbol}) - Collection: ${isBonklerCollection}, Terms: ${hasBonklerTerms}`);
                
                return isBonklerCollection || hasBonklerTerms;
            });

            console.log(`Found ${bonklerNFTs.length} Bonkler NFTs`);

            // Convert to game format
            // Store existing user NFTs to preserve customized components
            const existingUserNFTs = this.userNFTs || [];
        this.userNFTs = []; // Clear existing user NFTs
            let loadedCount = 0;

            for (const nft of bonklerNFTs) {
                try {
                    console.log(`Converting NFT: ${nft.content?.metadata?.name}`);
                    
                    // Extract NFT number from the name (e.g., "BONKLER #581" -> "581")
                    const nftName = nft.content?.metadata?.name || '';
                    const nftNumberMatch = nftName.match(/#(\d+)/);
                    const nftNumber = nftNumberMatch ? nftNumberMatch[1] : null;
                    
                    console.log(`Extracted NFT number: ${nftNumber}`);
                    
                    // Load metadata from JSON file
                    let metadata = null;
                    if (nftNumber) {
                        try {
                            const response = await fetch(`nft-metadata/output-jsons/${nftNumber}.json`);
                if (response.ok) {
                                metadata = await response.json();
                                console.log(`Loaded metadata for NFT #${nftNumber}:`, metadata);
                            } else {
                                console.log(`No metadata file found for NFT #${nftNumber}`);
                            }
                        } catch (error) {
                            console.log(`Failed to load metadata for NFT #${nftNumber}:`, error);
                        }
                    }
                    
                    // Convert to game format with proper attributes
                    const gameBonkler = {
                        id: nft.id,
                        name: nft.content?.metadata?.name || 'Unknown Bonkler',
                        level: 1,
                        attack: 50,
                        defense: 30,
                        exp: 0,
                        rarity: 'Common',
                        components: {},
                        attributes: metadata?.attributes || [],
                        isUserNFT: true,
                        owner: publicKey,
                        mint: nft.id
                    };
                    
                    // Check if this NFT had customized components in the previous session
                    const existingNFT = existingUserNFTs.find(existing => existing.id === nft.id);
                    if (existingNFT && existingNFT.components && Object.keys(existingNFT.components).length > 0) {
                        console.log(`Preserving customized components for ${gameBonkler.name}:`, existingNFT.components);
                        gameBonkler.components = { ...existingNFT.components };
                        
                        // Ensure component images are loaded
                        Object.entries(gameBonkler.components).forEach(([layer, component]) => {
                            if (component && component.path && !component.image) {
                                console.log(`Loading preserved image for ${layer} component:`, component.name);
                                const image = new Image();
                                image.onload = () => {
                                    console.log(`Preserved image loaded for ${layer} component:`, component.name);
                                    component.image = image;
                                };
                                image.onerror = (error) => {
                                    console.error(`Failed to load preserved image for ${layer} component:`, component.name, error);
                                };
                                image.src = component.path;
                            }
                        });
                    }
                    
                    // Build components from metadata attributes only if no customized components exist
                    if (!gameBonkler.components || Object.keys(gameBonkler.components).length === 0) {
                        if (metadata && metadata.attributes) {
                            console.log(`Building components from metadata for NFT #${nftNumber}`);
                            this.buildComponentsFromAttributes(gameBonkler, metadata.attributes);
                        } else {
                            console.log('No metadata found, creating fallback components');
                            gameBonkler.components = {
                                head: { name: 'BONK', path: 'HEADS/BONK.png', image: null },
                                body: { name: 'RILAKKUMA', path: 'BODIES/RILAKKUMA.png', image: null },
                                armor: { name: 'ArmorBronze', path: 'ARMORS/ArmorBronze.png', image: null },
                                hands: { name: 'GOLDEN-AXE', path: 'HANDS/GOLDEN-AXE.png', image: null },
                                offhand: { name: 'REMILIA-FILMS', path: 'OFFHAND/REMILIA-FILMS.png', image: null },
                                pilot: { name: 'KASANE-TETO', path: 'PILOT/KASANE-TETO.png', image: null }
                            };
                            
                            // Try to load the fallback component images
                            this.loadFallbackComponentImages(gameBonkler.components);
                        }
                    } else {
                        console.log(`Using preserved customized components for ${gameBonkler.name}`);
                    }
                    
                    this.userNFTs.push(gameBonkler);
                    loadedCount++;
                } catch (error) {
                    console.warn(`Failed to convert NFT ${nft.id}:`, error);
                }
            }

            console.log(`Loaded ${loadedCount} Bonkler NFTs for wallet ${publicKey}`);

            // Save the updated userNFTs immediately after loading
            this.saveGameData();
            console.log('Saved updated userNFTs to localStorage');

            // Process and decode the connected collection's visible previews.
            this.reprocessNFTsWithAssets();
            await this.loadFighterImages(this.userNFTs);
            
            // Refresh displays
            this.populateInventory();
            this.populateNFTs();
            this.updateNFTCount();
            this.updateWalletButton();

            if (loadedCount > 0) {
                this.showModal('NFTs Loaded', `Successfully loaded ${loadedCount} of your Bonkler NFTs!`);
            } else {
                console.log('No Bonkler NFTs found, loading test NFTs for demonstration');
                await this.loadTestNFTs(publicKey);
                this.showModal('Test Mode', 'No Bonkler NFTs found in your wallet. Loaded test NFTs for demonstration.');
            }

            } catch (error) {
            console.error('Error loading user NFTs:', error);
            
            // Fall back to demo NFTs
            console.log('Falling back to demo NFTs');
            await this.loadTestNFTs(publicKey);
            
            const isProduction = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
            const message = isProduction 
                ? 'RPC connection issues detected. Using demo NFTs for testing. Your real NFTs will be available when RPC access is restored.'
                : 'Connection issues detected. Using demo NFTs for testing. In production with proper hosting, you would see your actual NFTs.';
            
            this.showModal('Demo Mode', message);
        }
    }

    async getNFTMetadata(mint) {
        try {
            // Get the metadata account for the NFT
            const metadataPDA = await solanaWeb3.PublicKey.findProgramAddress(
                [
                    Buffer.from('metadata'),
                    new solanaWeb3.PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s').toBuffer(),
                    new solanaWeb3.PublicKey(mint).toBuffer(),
                ],
                new solanaWeb3.PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s')
            );

            const accountInfo = await this.connection.getAccountInfo(metadataPDA[0]);
            
            if (accountInfo) {
                // Parse metadata (this is a simplified version)
                const metadata = this.parseMetadata(accountInfo.data);
                if (metadata) {
                    // Add the mint to the metadata for collection checking
                    metadata.mint = mint;
                }
                return metadata;
            }
        } catch (error) {
            console.warn(`Failed to get metadata for ${mint}:`, error);
        }
        return null;
    }

    parseMetadata(data) {
        // Simplified metadata parsing for browser environment
        try {
            // Ensure Buffer is available
            if (typeof Buffer === 'undefined') {
                console.warn('Buffer not available, skipping metadata parsing');
                return null;
            }
            
            // Convert Uint8Array to Buffer if needed
            const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
            
            // Basic metadata structure parsing
            let offset = 1; // Skip version byte
            
            // Read name length and name
            const nameLength = buffer.readUInt32LE(offset);
            offset += 4;
            const name = buffer.toString('utf8', offset, offset + nameLength);
            offset += nameLength;
            
            // Read symbol length and symbol
            const symbolLength = buffer.readUInt32LE(offset);
            offset += 4;
            const symbol = buffer.toString('utf8', offset, offset + symbolLength);
            offset += symbolLength;
            
            // Read URI length and URI
            const uriLength = buffer.readUInt32LE(offset);
            offset += 4;
            const uri = buffer.toString('utf8', offset, offset + uriLength);
            
            return {
                name,
                symbol,
                uri,
                mint: buffer.slice(0, 32).toString('hex'),
                collection: null // Will be populated if found in metadata
            };
        } catch (error) {
            console.warn('Failed to parse metadata:', error);
            return null;
        }
    }

    extractString(data, offset) {
        const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
        const length = buffer.readUInt32LE(offset);
        return buffer.toString('utf8', offset + 4, offset + 4 + length);
    }

    isBonklerNFT(metadata) {
        // Check if this is a Bonkler NFT based on collection or name
        if (!metadata) return false;
        
        const name = metadata.name?.toLowerCase() || '';
        const symbol = metadata.symbol?.toLowerCase() || '';
        const collection = metadata.collection?.toLowerCase() || '';
        
        console.log(`Checking if Bonkler NFT: name="${name}", symbol="${symbol}", collection="${collection}"`);
        
        // Check for Bonkler collection mint
        const bonklerCollectionMint = 'HCx8AwY9ivtVNVT6rrht2StyMZgDE3yA3vGtmoRuoaeM';
        
        // More flexible detection - check for various Bonkler-related terms
        const bonklerTerms = ['bonkler', 'bonk', 'bonkler battle', 'bonkler game'];
        
        for (const term of bonklerTerms) {
            if (name.includes(term) || symbol.includes(term) || collection.includes(term)) {
                console.log(`Found Bonkler term: "${term}"`);
                return true;
            }
        }
        
        // Check if the mint matches the Bonkler collection
        if (metadata.mint && metadata.mint.toLowerCase() === bonklerCollectionMint.toLowerCase()) {
            console.log('Found Bonkler NFT by collection mint');
            return true;
        }
        
        // For now, accept any NFT with valid metadata as potential Bonkler
        // This is more permissive for testing
        if (name && symbol && name.length > 0 && symbol.length > 0) {
            console.log('Treating as potential Bonkler NFT based on metadata structure');
            return true;
        }
        
        return false;
    }

    async loadTestNFTs(publicKey, loadImages = true) {
        console.log('Loading demo NFTs for testing');
        this.isDemoMode = true;
        this.userNFTs = [];
        
        // Create demo NFTs with different configurations
        const demoNFTs = [
            {
                id: 'demo-1',
                name: 'Demo Bonkler #1',
                level: 5,
                attack: 85,
                defense: 72,
                health: 520,
                maxHealth: 520,
                description: 'Balanced local test unit with a mithril chassis.',
                components: {
                    head: { name: 'BONK', path: 'HEADS/BONK.png' },
                    body: { name: 'TEKKEN-KING', path: 'BODIES/TEKKEN-KING.png' },
                    armor: { name: 'ArmorMithril', path: 'ARMORS/ArmorMithril.png' },
                    hands: { name: 'GOLDEN-AXE', path: 'HANDS/GOLDEN-AXE.png' },
                    offhand: { name: 'SUPER-LOVER-WATCH', path: 'OFFHAND/SUPER-LOVER-WATCH.png' },
                    pilot: { name: 'KASANE-TETO', path: 'PILOT/KASANE-TETO.png' },
                    accessory: { name: 'HALO', path: 'ACCESSORIES/HALO.png' }
                }
            },
            {
                id: 'demo-2',
                name: 'Demo Bonkler #2',
                level: 3,
                attack: 78,
                defense: 65,
                health: 460,
                maxHealth: 460,
                description: 'Fast utility build tuned for evasive combat.',
                components: {
                    head: { name: 'SPIRIT', path: 'HEADS/SPIRIT.png' },
                    body: { name: 'RILAKKUMA', path: 'BODIES/RILAKKUMA.png' },
                    armor: { name: 'ArmorBronze', path: 'ARMORS/ArmorBronze.png' },
                    hands: { name: 'PORSCHE-SUSPENSION', path: 'HANDS/PORSCHE-SUSPENSION.png' },
                    offhand: { name: 'REMILIA-FILMS', path: 'OFFHAND/REMILIA-FILMS.png' },
                    pilot: { name: 'REI', path: 'PILOT/REI.png' }
                }
            },
            {
                id: 'demo-3',
                name: 'Demo Bonkler #3',
                level: 7,
                attack: 92,
                defense: 88,
                health: 590,
                maxHealth: 590,
                description: 'Heavy alien configuration with high defense.',
                components: {
                    head: { name: 'ALIEN-BONK', path: 'HEADS/ALIEN-BONK.png' },
                    body: { name: 'BURGER-BONK-LASER', path: 'BODIES/BURGER-BONK-LASER.png' },
                    armor: { name: 'ArmorDragon', path: 'ARMORS/ArmorDragon.png' },
                    hands: { name: 'ANCIENT-GODSWORD', path: 'HANDS/ANCIENT-GODSWORD.png' },
                    offhand: { name: 'GUTENBERG-BIBLE', path: 'OFFHAND/GUTENBERG-BIBLE.png' },
                    pilot: { name: 'MILADY', path: 'PILOT/MILADY.png' },
                    accessory: { name: 'DROID', path: 'ACCESSORIES/DROID.png' }
                }
            }
        ];
        
        // Convert demo NFTs to game format
        for (const demoNFT of demoNFTs) {
            const gameBonkler = {
                ...demoNFT,
                isUserNFT: true,
                isDemo: true,
                owner: publicKey || 'LOCAL-DEMO',
                mint: demoNFT.id,
                rarity: 'Rare',
                exp: demoNFT.level * 100
            };
            this.userNFTs.push(gameBonkler);
        }
        
        console.log(`Loaded ${this.userNFTs.length} demo NFTs`);
        if (loadImages && Object.keys(this.componentAssets || {}).length > 0) {
            await this.loadFighterImages(this.userNFTs);
        }
        
        // Refresh displays
        this.populateInventory();
        this.populateNFTs();
        this.updateNFTCount();
        this.updateWalletButton();
    }

    async disconnectWallet() {
        try {
            if (this.wallet && this.isConnected) {
                await this.wallet.disconnect();
            }
            
            // Return to a ready-to-play local profile when disconnecting.
            this.resetToFreshStart();
            await this.loadTestNFTs(null);
            this.reprocessNFTsWithAssets();
            await this.loadFighterImages(this.userNFTs);
            
            // Update wallet button
            this.updateWalletButton();
            
            // Refresh displays
            this.populateInventory();
            this.populateNFTs();
            
            // Save the cleared state
            this.saveGameData();
            
            this.showModal('Wallet Disconnected', 'Successfully disconnected from wallet. All progress has been cleared.');
            
        } catch (error) {
            console.error('Error disconnecting wallet:', error);
            this.showModal('Disconnect Failed', 'Failed to disconnect wallet. Please try again.');
        }
    }

    updateWalletButton() {
        const walletBtn = document.getElementById('wallet-connect-btn');
        const mode = document.getElementById('session-mode');
        const copy = document.getElementById('session-copy');
        const collectionBtn = document.getElementById('load-more-nfts-btn');
        if (!walletBtn) return;
        
        if (this.isConnected && this.publicKey) {
            walletBtn.innerHTML = `${this.symbolMarkup('wallet')}<span>${this.publicKey.slice(0, 4)}…${this.publicKey.slice(-4)}</span>`;
            walletBtn.title = 'Disconnect wallet';
            if (mode) mode.textContent = 'WALLET MODE';
            if (copy) copy.textContent = `${this.userNFTs.length} collection fighter${this.userNFTs.length === 1 ? '' : 's'} ready`;
            if (collectionBtn) collectionBtn.textContent = 'Refresh Collection';
        } else {
            walletBtn.innerHTML = `${this.symbolMarkup('wallet')}<span>Connect Wallet</span>`;
            walletBtn.title = 'Connect a Solana wallet';
            if (mode) mode.textContent = 'DEMO MODE';
            if (copy) copy.textContent = `${this.userNFTs.length || 3} local fighters ready`;
            if (collectionBtn) collectionBtn.textContent = 'Connect Collection';
        }
        walletBtn.disabled = false;
    }

    updateUI() {
        document.getElementById('coins').textContent = this.coins;
        document.getElementById('exp').textContent = this.exp;
        document.getElementById('level').textContent = this.level;
        
        // Update wallet button state
        this.updateWalletButton();
    }

    toggleSound() {
        this.soundEnabled = !this.soundEnabled;
        const button = document.getElementById('sound-toggle-btn');
        if (button) {
            button.setAttribute('aria-pressed', String(this.soundEnabled));
            const label = button.querySelector('.sound-label');
            if (label) label.textContent = this.soundEnabled ? 'SOUND ON' : 'SOUND OFF';
            button.title = this.soundEnabled ? 'Disable interface sounds' : 'Enable interface sounds';
        }
        if (this.soundEnabled) this.playTone(620, 0.06, 'square', 0.025);
    }

    playTone(frequency = 440, duration = 0.04, type = 'square', volume = 0.018) {
        if (!this.soundEnabled) return;
        try {
            this.audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
            const now = this.audioContext.currentTime;
            const oscillator = this.audioContext.createOscillator();
            const gain = this.audioContext.createGain();
            oscillator.type = type;
            oscillator.frequency.setValueAtTime(frequency, now);
            gain.gain.setValueAtTime(volume, now);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
            oscillator.connect(gain).connect(this.audioContext.destination);
            oscillator.start(now);
            oscillator.stop(now + duration);
        } catch (error) {
            console.warn('Audio feedback unavailable:', error);
            this.soundEnabled = false;
        }
    }

    pulseArena(className = 'impact') {
        const arena = document.querySelector('.battle-canvas-container');
        if (!arena || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        arena.classList.remove(className);
        void arena.offsetWidth;
        arena.classList.add(className);
        arena.addEventListener('animationend', () => arena.classList.remove(className), { once: true });
    }

    addExp(amount) {
        this.exp += amount;
        const expNeeded = this.level * 100;
        
        if (this.exp >= expNeeded) {
            this.levelUp();
        }
        
        this.updateUI();
        this.saveGameData();
    }

    levelUp() {
        this.level++;
        this.exp -= (this.level - 1) * 100;
        this.coins += this.level * 50;
        
        this.showModal('Level Up!', `Congratulations! You reached level ${this.level}! You earned ${this.level * 50} coins!`);
        this.updateUI();
        this.saveGameData();
    }

    addCoins(amount) {
        this.coins += amount;
        this.updateUI();
        this.saveGameData();
    }

    setupEventListeners() {
        console.log('Setting up event listeners...');
        
        document.querySelectorAll('.nav-btn').forEach((button) => {
            button.addEventListener('click', (event) => {
                this.switchScreen(event.currentTarget.dataset.screen);
            });
        });

        document.querySelectorAll('.battle-mode-btn').forEach((button) => {
            button.addEventListener('click', (event) => this.setBattleMode(event.currentTarget.dataset.mode));
        });

        const difficultySelect = document.getElementById('battle-difficulty');
        if (difficultySelect) {
            difficultySelect.value = this.battleDifficulty;
            difficultySelect.addEventListener('change', (event) => {
                this.battleDifficulty = BATTLE_BALANCE.difficulties[event.currentTarget.value]
                    ? event.currentTarget.value
                    : 'standard';
                this.saveGameData();
                this.playTone(260, 0.045, 'square', 0.012);
            });
        }

        document.getElementById('slash-btn').addEventListener('click', () => this.performSlash());
        document.getElementById('power-up-btn').addEventListener('click', () => this.performPowerUp());
        document.getElementById('defend-btn').addEventListener('click', () => this.performDefend());
        document.getElementById('dodge-btn').addEventListener('click', () => this.performDodge());
        document.getElementById('special-btn').addEventListener('click', () => this.performSpecial());
        document.getElementById('bonkler-beam-btn').addEventListener('click', () => this.performBonklerBeam());

        document.getElementById('modal-close').addEventListener('click', () => this.closeModal());
        document.getElementById('modal-ok').addEventListener('click', () => this.closeModal());
        document.getElementById('modal-overlay').addEventListener('click', (event) => {
            if (event.target === event.currentTarget) this.closeModal();
        });

        const resultModal = document.getElementById('battle-result-modal');
        const closeResult = () => resultModal.classList.remove('active');
        document.getElementById('result-modal-close').addEventListener('click', closeResult);
        resultModal.addEventListener('click', (event) => {
            if (event.target === event.currentTarget) closeResult();
        });

        document.querySelectorAll('.category-btn').forEach((button) => {
            button.addEventListener('click', (event) => this.setShopCategory(event.currentTarget.dataset.category));
        });

        document.querySelectorAll('.inventory-tab-btn').forEach((button) => {
            button.addEventListener('click', (event) => this.setInventoryTab(event.currentTarget.dataset.tab));
        });

        document.querySelectorAll('.tab-btn').forEach((button) => {
            button.addEventListener('click', (event) => this.setLeaderboardTab(event.currentTarget.dataset.tab));
        });

        document.getElementById('refresh-leaderboard-btn')?.addEventListener('click', () => this.updateLeaderboard());
        document.getElementById('confirm-fighter-btn')?.addEventListener('click', () => this.confirmFighter());
        document.getElementById('save-equipment-btn')?.addEventListener('click', () => {
            this.saveGameData();
            this.showModal('Loadout Saved', 'This fighter configuration has been saved locally.');
        });
        document.getElementById('sound-toggle-btn')?.addEventListener('click', () => this.toggleSound());

        document.getElementById('wallet-connect-btn')?.addEventListener('click', () => {
            if (this.isConnected) this.disconnectWallet();
            else this.connectWallet();
        });

        document.getElementById('load-more-nfts-btn')?.addEventListener('click', () => {
            if (this.isConnected) this.loadUserNFTs(this.publicKey);
            else this.connectWallet();
        });

        // One low-volume click cue for the whole native-button interface.
        document.addEventListener('click', (event) => {
            if (event.target.closest('button')) this.playTone(260, 0.025, 'square', 0.012);
        });

        document.addEventListener('keydown', (event) => {
            const activeDialog = document.querySelector('.modal-overlay.active');
            if (event.key === 'Escape') {
                this.closeModal();
                resultModal.classList.remove('active');
                return;
            }
            if (event.key !== 'Tab' || !activeDialog) return;
            const focusable = [...activeDialog.querySelectorAll('button:not(:disabled), [href], [tabindex]:not([tabindex="-1"])')];
            if (!focusable.length) return;
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        });

        const clock = document.getElementById('status-clock');
        const updateClock = () => {
            if (clock) clock.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        };
        updateClock();
        this.clockInterval = setInterval(updateClock, 30000);
    }

    // Fighter Builder System
    async initFighterBuilder() {
        this.canvas = document.getElementById('fighter-canvas');
        this.ctx = this.canvas.getContext('2d');
        
        this.componentIndices = {
            pilot: 0,
            body: 0,
            head: 0,
            armor: 0,
            hands: 0,
            offhand: 0,
            accessory: 0
        };
        
        this.selectedNFT = null;
        this.builderComponents = {
            pilot: null,
            body: null,
            head: null,
            armor: null,
            hands: null,
            offhand: null,
            accessory: null
        };
        
        await this.loadComponentAssets();
        this.setupBuilderNFTSelection();
    }

    async loadComponentAssets() {
        const [pilot, body, head, armor, hands, offhand, accessory] = await Promise.all([
            this.loadAssetsFromFolder('PILOT'),
            this.loadAssetsFromFolder('BODIES'),
            this.loadAssetsFromFolder('HEADS'),
            this.loadAssetsFromFolder('ARMORS'),
            this.loadAssetsFromFolder('HANDS'),
            this.loadAssetsFromFolder('OFFHAND'),
            this.loadAssetsFromFolder('ACCESSORIES')
        ]);
        this.componentAssets = { pilot, body, head, armor, hands, offhand, accessory };
        this.drawEmptyBuilder();
    }

    async loadAssetsFromFolder(folderName) {
        const assets = [];
        
        // Map folder names to actual folder paths
        const folderMap = {
            'PILOT': 'PILOT',
            'BODIES': 'BODIES',
            'HEADS': 'HEADS',
            'ARMORS': 'ARMORS',
            'HANDS': 'HANDS',
            'OFFHAND': 'OFFHAND',
            'ACCESSORIES': 'ACCESSORIES'
        };
        
        const folderPath = folderMap[folderName];
        if (!folderPath) {
            console.error(`Unknown folder: ${folderName}`);
            return assets;
        }
        
        try {
            // Load actual image files from the folders
            const imageFiles = {
                'PILOT': ['WOLFIE.png', 'ZATSUNE-MIKU.png', 'TIVO.png', 'SPRITE-AUTOGRAPH.png', 'STUART.png', 'SHAKOKI-DOGU.png', 'SNOOPY-PLUSH.png', 'ROVER.png', 'REI.png', 'OKSHIA-MIKAN-UWASA-FRUIT-JUICER.png', 'PIKMIN.png', 'NEKO.png', 'MINIFIG.png', 'MILADY.png', 'MEW.png', 'MAPLE-STORY.png', 'KASANE-TETO.png', 'GUITAR-BEAR.png', 'HAMTARO.png', 'DANCING-MAN-EMOJI.png', 'DR-KAWASHIMA.png', 'CHARLIE\'S-DOG.png', 'BONK-BAT.png', 'BINKY.png', 'BLACK-FROST.png', 'ALIEN-MILADY.png', 'BEAUTY-BEAST-BUNNY.png'],
                'BODIES': ['YMO-TOUR.png', 'VENDING-MACHINE.png', 'VALET-CHAIR.png', 'TEKKEN-KING.png', 'SONY-TV.png', 'SUIT.png', 'SONY-TABLET.png', 'SONY-POCKET-STATION.png', 'RUMMIKUB.png', 'SONY-CD-PLAYER.png', 'RUG-PULL.png', 'RILAKKUMA.png', 'REI-LIGHTER.png', 'RED-AND-BLUE-CHAIR.png', 'ORION-CAN.png', 'PELICAN-TERMINAL.png', 'NOCTUA-HEATSINK.png', 'LEGO-SKELETON.png', 'JUDD-CHAIR.png', 'JADE-CABBAGE.png', 'HARAJUKU-MOTOROLA.png', 'JACOB-JENSEN.png', 'GUAM.png', 'FRAGILE-HEARTS.png', 'FIRE-BONKER-LASER.png', 'DARK-MAGICIAN-GIRL.png', 'COSMIC-RAY-DETECTORS.png', 'CHINESE-SPRITE.png', 'BURNER-PHONE.png', 'BURGER-BONK-LASER.png', 'BRG-VOL1.png', 'BEETLE.png', 'ANOTHER-FREAKING-MACHINE.png'],
                'HEADS': ['WHITE.png', 'SPIRIT.png', 'EVIL-BONK.png', 'BONK.png', 'ALIEN-BONK.png'],
                'ARMORS': ['ArmorWhite.png', 'ArmorWhite-Trim.png', 'ArmorTerminator.png', 'ArmorTerminator-Recolor.png', 'ArmorSteel.png', 'ArmorSteel-Trim.png', 'ArmorMithril.png', 'ArmorPhantom.png', 'ArmorMithril-Trim.png', 'ArmorJade.png', 'ArmorHarajuku-Sticker.png', 'ArmorHandycam.png', 'ArmorGlory.png', 'ArmorDragon.png', 'ArmorComme-Des-Garcons-Homme-Plus-FW18-Dover-Street-Market-Installation-Dinosaur-Bones.png', 'ArmorCoal.png', 'ArmorBronze.png', 'ArmorBronze-Trim.png', 'ArmorBlack.png', 'ArmorBlack-Trim.png', 'ArmorAdamantine.png'],
                'HANDS': ['WATER-PISTOL.png', 'WINGED-STAFF-GOLD.png', 'VELVET-CROWE.png', 'STYGIAN-REAVER.png', 'SLY-COOPER-CANE.png', 'SKYLANDER-SWORD.png', 'RIBBON-STAFF.png', 'SIR-FETCH\'D.png', 'PORSCHE-SUSPENSION.png', 'NEWJEANS-HAMMER.png', 'PHONE-FLAIL.png', 'K\'NEX.png', 'JORDAN.png', 'INSANITY-CATALYST.png', 'IKEBANA.png', 'GOLDEN-AXE.png', 'EVOLVED-ANTENNA.png', 'ENERGY-SWORD.png', 'DREAMCAST-FISHING-CONTROLLER.png', 'CATTLE-GUN.png', 'BOOM-MIC.png', 'BLUDGEONING-ANGEL.png', 'BLADE-OF-THE-IMMORTAL.png', 'BIONICLE-AXE.png', 'BALLOON.png', 'ATARASHIKI-MURA.png', 'ARMED-THREAT.png', 'APE-ESCAPE-NET.png', 'ANCIENT-GODSWORD.png', 'AMERICAN-FLAG.png', 'AGHANIM-SCEPTER.png'],
                'OFFHAND': ['YEN.png', 'TORNADO-2.png', 'VAX-PASS.png', 'TOKYO-MANHOLE-COVER.png', 'TEDDY-BEAR-ANNIVERSARY.png', 'SUPER-LOVER-WATCH.png', 'SUBMARINE-CABLE.png', 'SHOOTING-STAR.png', 'RX-78.png', 'REMILIA-ENGINEERING.png', 'REMILIA-FILMS.png', 'REMILIA-CREST.png', 'RAYMAN-M-STEAL-SHIELD.png', 'QUAD-DAMAGE.png', 'POCKET-PET.png', 'POKEWALKER.png', 'PALETTE.png', 'KETAMINE.png', 'NAUTILUS.png', 'HAUCHIWA.png', 'HAND-CLOCK.png', 'GAME-AND-WATCH.png', 'GUTENBERG-BIBLE.png', 'G-SHOCK.png', 'FOOBAR.png', 'FINAL-FANTASY.png', 'DWARF-FORTRESS-GREEK-BEDROOM-BLUEPRINT.png', 'FBI-BADGE.png', 'DAIHATSU-MIDGET.png', 'COOKIE.png', 'CARLO-BUGATTI-CHAIR.png', 'CLOVER.png', 'BREIFCASE.png', 'BEYBLADE.png', 'BEETLE-GAME.png', 'BEAT-HAPPENING.png', 'AMEX-PLATINUM.png', 'ADVENTURE-OF-COOKIE-AND-CREAM.png', '48-LAWS-OF-POWER.png'],
                'ACCESSORIES': ['RAVER-CAP.png', 'HIKKIKOMORI.png', 'HALO.png', 'DROID.png', 'BK.png']
            };
            
            const files = imageFiles[folderName] || [];
            
            // Build a lightweight manifest. Images decode only for visible fighters,
            // purchased shop parts, and the active enemy instead of blocking boot.
            assets.push(...files.map((fileName) => ({
                name: fileName.replace('.png', ''),
                path: `${folderPath}/${fileName}`,
                image: null
            })));
        } catch (error) {
            console.error(`Error loading assets from ${folderName}:`, error);
        }
        
        return assets;
    }

    async ensureComponentImage(component) {
        if (!component?.path) return null;
        if (component.image?.complete && component.image.naturalWidth > 0) return component.image;

        const image = new Image();
        image.decoding = 'async';
        image.src = component.path;
        try {
            if (image.decode) await image.decode();
            else await new Promise((resolve, reject) => {
                image.onload = resolve;
                image.onerror = reject;
            });
            component.image = image;
            return image;
        } catch (error) {
            console.warn(`Could not decode fighter component: ${component.path}`, error);
            component.image = null;
            return null;
        }
    }

    async loadFighterImages(fighters) {
        const list = Array.isArray(fighters) ? fighters : [fighters];
        const components = list.flatMap((fighter) => Object.values(fighter?.components || {}));
        await Promise.all(components.map((component) => this.ensureComponentImage(component)));
    }

    setupComponentNavigation() {
        const categories = ['pilot', 'body', 'head', 'armor', 'hands', 'offhand', 'accessory'];
        
        categories.forEach(category => {
            this.updateComponentDisplay(category);
            
            // Setup navigation arrows
            const prevBtn = document.querySelector(`[data-category="${category}"].prev`);
            const nextBtn = document.querySelector(`[data-category="${category}"].next`);
            
            prevBtn.addEventListener('click', () => this.navigateComponent(category, -1));
            nextBtn.addEventListener('click', () => this.navigateComponent(category, 1));
        });
    }

    navigateComponent(category, direction) {
        const assets = this.componentAssets[category] || [];
        if (assets.length === 0) return;
        
        this.componentIndices[category] += direction;
        
        // Wrap around
        if (this.componentIndices[category] < 0) {
            this.componentIndices[category] = assets.length - 1;
        } else if (this.componentIndices[category] >= assets.length) {
            this.componentIndices[category] = 0;
        }
        
        this.updateComponentDisplay(category);
        this.selectComponent(category, this.componentIndices[category]);
        this.renderFighter(); // Add this line to update the canvas
    }

    updateComponentDisplay(category) {
        const assets = this.componentAssets[category] || [];
        const display = document.getElementById(`${category}-display`);
        const info = document.getElementById(`${category}-info`);
        const prevBtn = document.querySelector(`[data-category="${category}"].prev`);
        const nextBtn = document.querySelector(`[data-category="${category}"].next`);
        
        if (assets.length === 0) {
            display.innerHTML = `<div class="component-item"><span class="component-icon">${this.symbolMarkup('error')}</span></div>`;
            info.innerHTML = '<span class="component-name">No items available</span><span class="component-stats"></span>';
            prevBtn.disabled = true;
            nextBtn.disabled = true;
            return;
        }
        
        const currentIndex = this.componentIndices[category];
        const currentAsset = assets[currentIndex];
        
        // Update display
        const iconName = this.getItemSymbol({ type: category });

        display.innerHTML = `
            <div class="component-item selected">
                <span class="component-icon">${this.symbolMarkup(iconName)}</span>
            </div>
        `;
        
        // Update info
        let stats = '';
        if (currentAsset.attack) stats += `Attack: +${currentAsset.attack} `;
        if (currentAsset.defense) stats += `Defense: +${currentAsset.defense}`;
        
        info.innerHTML = `
            <span class="component-name">${currentAsset.name}</span>
            <span class="component-stats">${stats}</span>
        `;
        
        // Update navigation buttons
        prevBtn.disabled = assets.length <= 1;
        nextBtn.disabled = assets.length <= 1;
    }

    selectComponent(category, index) {
        if (!this.selectedNFT) {
            this.showModal('No NFT Selected', 'Please select an NFT from your inventory first.');
            return;
        }
        
        const availableItems = this.getPurchasedItemsByType(category);
        if (index >= 0 && index < availableItems.length) {
            this.componentIndices[category] = index;
            this.builderComponents[category] = availableItems[index];
            this.updateComponentDisplayForBuilder(category, availableItems);
            this.renderCustomizedFighter();
        }
    }

    renderCustomizedFighter() {
        if (!this.ctx || !this.selectedNFT) return;
        
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw base NFT
        this.ctx.fillStyle = '#f0f0f0';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw NFT info
        this.ctx.fillStyle = '#000000';
        this.ctx.font = '16px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(this.selectedNFT.name, this.canvas.width / 2, 30);
        this.ctx.font = '12px Arial';
        this.ctx.fillText(`Base Attack: ${this.selectedNFT.attack} | Base Defense: ${this.selectedNFT.defense}`, this.canvas.width / 2, 50);
        
        // Draw selected components
        let yOffset = 80;
        Object.entries(this.builderComponents).forEach(([category, component]) => {
            if (component) {
                this.ctx.fillText(`${category}: ${component.name}`, this.canvas.width / 2, yOffset);
                yOffset += 20;
            }
        });
        
        if (yOffset === 80) {
            this.ctx.fillText('No components selected yet', this.canvas.width / 2, yOffset);
        }
    }

    renderFighter() {
        if (!this.ctx) return;
        
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Render layers in order: body → armor → hands → offhand → head → pilot → accessories (last drawn = top layer)
        const layerOrder = ['body', 'armor', 'hands', 'offhand', 'head', 'pilot', 'accessory'];
        
        layerOrder.forEach(layer => {
            const component = this.currentFighter[layer];
            if (component && component.image && component.image.complete && component.image.naturalWidth > 0) {
                // Scale and center the image on canvas
                const scale = 0.6; // Make images bigger
                const scaledWidth = component.image.width * scale;
                const scaledHeight = component.image.height * scale;
                const x = (this.canvas.width - scaledWidth) / 2;
                const y = (this.canvas.height - scaledHeight) / 2;
                
                this.ctx.drawImage(component.image, x, y, scaledWidth, scaledHeight);
            }
        });
    }

    renderFighterPreview(ctx, components) {
        if (!ctx) return;
        
        // Clear canvas
        ctx.clearRect(0, 0, 120, 180);
        
        // Render layers in order: body → armor → hands → offhand → head → pilot → accessories (last drawn = top layer)
        const layerOrder = ['body', 'armor', 'hands', 'offhand', 'head', 'pilot', 'accessory'];
        
        let hasValidComponents = false;
        
        layerOrder.forEach(layer => {
            const component = components[layer];
            if (component && component.image && component.image.complete && component.image.naturalWidth > 0) {
                // Scale and center the image for preview (make smaller)
                const scale = Math.min(120 / component.image.width, 180 / component.image.height) * 0.5; // 50% smaller
                const scaledWidth = component.image.width * scale;
                const scaledHeight = component.image.height * scale;
                const x = (120 - scaledWidth) / 2;
                const y = (180 - scaledHeight) / 2;
                
                ctx.drawImage(component.image, x, y, scaledWidth, scaledHeight);
                hasValidComponents = true;
            }
        });
        
        // If no valid components found, draw a placeholder
        if (!hasValidComponents) {
            this.drawPlaceholderPreview(ctx);
        }
    }
    
    drawPlaceholderPreview(ctx) {
        // Draw a simple placeholder character
        ctx.fillStyle = '#cccccc';
        ctx.fillRect(40, 60, 40, 60); // Body
        
        ctx.fillStyle = '#999999';
        ctx.fillRect(45, 40, 30, 25); // Head
        
        ctx.fillStyle = '#666666';
        ctx.fillRect(35, 70, 10, 20); // Left arm
        ctx.fillRect(75, 70, 10, 20); // Right arm
        
        ctx.fillStyle = '#444444';
        ctx.fillRect(50, 120, 8, 15); // Left leg
        ctx.fillRect(62, 120, 8, 15); // Right leg
        
        // Add some basic features
        ctx.fillStyle = '#000000';
        ctx.fillRect(50, 50, 4, 4); // Left eye
        ctx.fillRect(66, 50, 4, 4); // Right eye
        ctx.fillRect(58, 60, 4, 2); // Mouth
    }

    setupBuilderNFTSelection() {
        // Add click handlers to NFT items in inventory
        const nftGrid = document.getElementById('inventory-nfts-grid');
        if (nftGrid) {
            nftGrid.addEventListener('click', (e) => {
                const shopItem = e.target.closest('.shop-item');
                if (shopItem && shopItem.dataset.index !== undefined) {
                    const index = parseInt(shopItem.dataset.index);
                    const nft = this.userNFTs[index];
                    if (nft) {
                        this.selectNFTForBuilder(nft);
                    }
                }
            });
        }
    }

    selectNFTForBuilder(nft) {

        this.selectedNFT = nft;
        
        // Update builder display
        const builderHeader = document.querySelector('.builder-header h2');
        if (builderHeader) {
            builderHeader.textContent = `Customize: ${nft.name}`;
        }
        
        // Check if NFT has customized components first
        if (nft.components && Object.keys(nft.components).length > 0) {

            this.builderComponents = { ...nft.components };
            
            // Ensure all component images are loaded
            Object.entries(this.builderComponents).forEach(([layer, component]) => {
                if (component && component.path && !component.image) {
                    console.log(`Loading image for ${layer} component in builder:`, component.name);
                    const image = new Image();
                    image.onload = () => {
                        console.log(`Image loaded for ${layer} component in builder:`, component.name);
                        component.image = image;
                        // Re-render after image loads
                        this.renderNFTAsBase(nft);
                    };
                    image.onerror = (error) => {
                        console.error(`Failed to load image for ${layer} component in builder:`, component.name, error);
                    };
                    image.src = component.path;
                }
            });
        } else {
            // Build components from NFT metadata if no customized components exist
            const nftComponents = this.buildComponentsFromNFTMetadata(nft);
            this.builderComponents = nftComponents;
            console.log('Built components from metadata:', nftComponents);
        }
        
        // Update component display to show NFT's components
        this.updateBuilderComponentDisplayForNFT(nft);
        
        // Render the NFT as base. The builder itself confirms the selection,
        // so no blocking dialog is needed here.
        this.renderNFTAsBase(nft);
    }

    buildComponentsFromNFTMetadata(nft) {
        const components = {};
        
        console.log('NFT structure:', nft);
        console.log('NFT attributes:', nft.attributes);
        console.log('NFT components:', nft.components);
        
        // Map NFT attributes to game components
        if (nft.attributes && Array.isArray(nft.attributes)) {
            nft.attributes.forEach(attr => {
                const traitType = attr.trait_type;
                const value = attr.value;
                
                // Map trait types to component categories
                const categoryMap = {
                    'PILOT': 'pilot',
                    'BODIES': 'body', 
                    'HEADS': 'head',
                    'ARMORS': 'armor',
                    'HANDS': 'hands',
                    'OFFHAND': 'offhand',
                    'ACCESSORIES': 'accessory'
                };
                
                const category = categoryMap[traitType];
                if (category) {
                    // Find the corresponding asset in our component assets
            const assets = this.componentAssets[category] || [];
            
                    // Try to find asset by name (exact match)
                    let asset = assets.find(a => a.name === value);
                    
                    // If not found, try case-insensitive exact match
                    if (!asset) {
                        asset = assets.find(a => a.name.toLowerCase() === value.toLowerCase());
                    }
                    
                    // If still not found, try partial match
                    if (!asset) {
                        asset = assets.find(a => 
                            a.name.toLowerCase().includes(value.toLowerCase()) ||
                            value.toLowerCase().includes(a.name.toLowerCase())
                        );
                    }
                    
                    // If still not found, try removing common prefixes/suffixes
                    if (!asset) {
                        const cleanValue = value.replace(/^(Armor|Pilot|Body|Head|Hand|Offhand|Accessory)/i, '');
                        asset = assets.find(a => 
                            a.name.toLowerCase().includes(cleanValue.toLowerCase()) ||
                            cleanValue.toLowerCase().includes(a.name.toLowerCase())
                        );
                    }
                    
                    // If still not found, try specific mappings for known mismatches
                    if (!asset) {
                        const specificMappings = {
                            'BONK': 'BONK',
                            'EVIL-BONK': 'EVIL-BONK',
                            'ALIEN-BONK': 'ALIEN-BONK',
                            'HAMTARO': 'HAMTARO',
                            'KASANE-TETO': 'KASANE-TETO',
                            'BINKY': 'BINKY',
                            'ALIEN-MILADY': 'ALIEN-MILADY',
                            'BEAUTY-BEAST-BUNNY': 'BEAUTY-BEAST-BUNNY',
                            'REI': 'REI',
                            'SPRITE-AUTOGRAPH': 'SPRITE-AUTOGRAPH',
                            'YMO-TOUR': 'YMO-TOUR',
                            'RILAKKUMA': 'RILAKKUMA',
                            'TEKKEN-KING': 'TEKKEN-KING',
                            'JADE-CABBAGE': 'JADE-CABBAGE',
                            'VENDING-MACHINE': 'VENDING-MACHINE',
                            'SUIT': 'SUIT',
                            'SONY-TV': 'SONY-TV',
                            'GUAM': 'GUAM',
                            'RED-AND-BLUE-CHAIR': 'RED-AND-BLUE-CHAIR',
                            'ArmorCoal': 'ArmorCoal',
                            'ArmorBronze-Trim': 'ArmorBronze-Trim',
                            'ArmorMithril': 'ArmorMithril',
                            'ArmorPhantom': 'ArmorPhantom',
                            'ArmorBlack': 'ArmorBlack',
                            'ArmorHandycam': 'ArmorHandycam',
                            'ArmorAdamantine': 'ArmorAdamantine',
                            'EVOLVED-ANTENNA': 'EVOLVED-ANTENNA',
                            'PORSCHE-SUSPENSION': 'PORSCHE-SUSPENSION',
                            'GOLDEN-AXE': 'GOLDEN-AXE',
                            'AGHANIM-SCEPTER': 'AGHANIM-SCEPTER',
                            'WATER-PISTOL': 'WATER-PISTOL',
                            'NEWJEANS-HAMMER': 'NEWJEANS-HAMMER',
                            'BLUDGEONING-ANGEL': 'BLUDGEONING-ANGEL',
                            'ARMED-THREAT': 'ARMED-THREAT',
                            'AMERICAN-FLAG': 'AMERICAN-FLAG',
                            'POCKET-PET': 'POCKET-PET',
                            'REMILIA-FILMS': 'REMILIA-FILMS',
                            'YEN': 'YEN',
                            'PALETTE': 'PALETTE',
                            'SUBMARINE-CABLE': 'SUBMARINE-CABLE',
                            'DAIHATSU-MIDGET': 'DAIHATSU-MIDGET',
                            'DWARF-FORTRESS-GREEK-BEDROOM-BLUEPRINT': 'DWARF-FORTRESS-GREEK-BEDROOM-BLUEPRINT',
                            'RAVER-CAP': 'RAVER-CAP',
                            'HALO': 'HALO',
                            'HIKKIKOMORI': 'HIKKIKOMORI'
                        };
                        
                        const mappedValue = specificMappings[value];
                        if (mappedValue) {
                            asset = assets.find(a => a.name === mappedValue);
                        }
                    }
                    
                    if (asset) {
                        components[category] = asset;
                        console.log(`Found asset for ${category}:`, asset.name);
                    } else {
                        console.log(`No asset found for ${category}: ${value}`);
                        // Create a fallback component with basic stats
                        components[category] = {
                            name: value,
                            type: category,
                            attack: 5,
                            defense: 5,
                            image: null
                        };
                    }
                }
            });
        }
        
        // If no attributes found, try to use existing components
        if (Object.keys(components).length === 0 && nft.components) {
            console.log('No attributes found, using existing components');
            return nft.components;
        }
        
        return components;
    }

    buildComponentsFromAttributes(gameBonkler, attributes) {
        // Build components from NFT attributes
        const components = {};
        
        if (attributes && Array.isArray(attributes)) {
            console.log('Building components from attributes:', attributes);
            
            attributes.forEach(attr => {
                const traitType = attr.trait_type;
                const value = attr.value;
                
                console.log(`Processing attribute: ${traitType} = ${value}`);
                
                // Map trait types to component categories
                const categoryMap = {
                    'PILOT': 'pilot',
                    'BODIES': 'body', 
                    'HEADS': 'head',
                    'ARMORS': 'armor',
                    'HANDS': 'hands',
                    'OFFHAND': 'offhand',
                    'ACCESSORIES': 'accessory'
                };
                
                const category = categoryMap[traitType];
                if (category) {
                    console.log(`Mapping ${traitType} to ${category}`);
                    
                    // Find the corresponding asset in our component assets
                    const assets = this.componentAssets[category] || [];
                    console.log(`Available assets for ${category}:`, assets.map(a => a.name));
                    console.log(`Component assets loaded:`, this.componentAssets ? Object.keys(this.componentAssets) : 'Not loaded');
                    
                    // Try to find asset by name (exact match)
                    let asset = assets.find(a => a.name === value);
                    
                    // If not found, try case-insensitive exact match
                    if (!asset) {
                        asset = assets.find(a => a.name.toLowerCase() === value.toLowerCase());
                    }
                    
                    // If still not found, try partial match
                    if (!asset) {
                        asset = assets.find(a => 
                            a.name.toLowerCase().includes(value.toLowerCase()) ||
                            value.toLowerCase().includes(a.name.toLowerCase())
                        );
                    }
                    
                    // If still not found, try removing common prefixes/suffixes
                    if (!asset) {
                        const cleanValue = value.replace(/^(Armor|Pilot|Body|Head|Hand|Offhand|Accessory)/i, '');
                        asset = assets.find(a => 
                            a.name.toLowerCase().includes(cleanValue.toLowerCase()) ||
                            cleanValue.toLowerCase().includes(a.name.toLowerCase())
                        );
                    }
                    
                    // If still not found, try specific mappings for known mismatches
                    if (!asset) {
                        const specificMappings = {
                            'BONK': 'BONK',
                            'EVIL-BONK': 'EVIL-BONK',
                            'ALIEN-BONK': 'ALIEN-BONK',
                            'HAMTARO': 'HAMTARO',
                            'KASANE-TETO': 'KASANE-TETO',
                            'BINKY': 'BINKY',
                            'ALIEN-MILADY': 'ALIEN-MILADY',
                            'BEAUTY-BEAST-BUNNY': 'BEAUTY-BEAST-BUNNY',
                            'REI': 'REI',
                            'SPRITE-AUTOGRAPH': 'SPRITE-AUTOGRAPH',
                            'YMO-TOUR': 'YMO-TOUR',
                            'RILAKKUMA': 'RILAKKUMA',
                            'TEKKEN-KING': 'TEKKEN-KING',
                            'JADE-CABBAGE': 'JADE-CABBAGE',
                            'VENDING-MACHINE': 'VENDING-MACHINE',
                            'SUIT': 'SUIT',
                            'SONY-TV': 'SONY-TV',
                            'GUAM': 'GUAM',
                            'RED-AND-BLUE-CHAIR': 'RED-AND-BLUE-CHAIR',
                            'ArmorCoal': 'ArmorCoal',
                            'ArmorBronze-Trim': 'ArmorBronze-Trim',
                            'ArmorMithril': 'ArmorMithril',
                            'ArmorPhantom': 'ArmorPhantom',
                            'ArmorBlack': 'ArmorBlack',
                            'ArmorHandycam': 'ArmorHandycam',
                            'ArmorAdamantine': 'ArmorAdamantine',
                            'EVOLVED-ANTENNA': 'EVOLVED-ANTENNA',
                            'PORSCHE-SUSPENSION': 'PORSCHE-SUSPENSION',
                            'GOLDEN-AXE': 'GOLDEN-AXE',
                            'AGHANIM-SCEPTER': 'AGHANIM-SCEPTER',
                            'WATER-PISTOL': 'WATER-PISTOL',
                            'NEWJEANS-HAMMER': 'NEWJEANS-HAMMER',
                            'BLUDGEONING-ANGEL': 'BLUDGEONING-ANGEL',
                            'ARMED-THREAT': 'ARMED-THREAT',
                            'AMERICAN-FLAG': 'AMERICAN-FLAG',
                            'POCKET-PET': 'POCKET-PET',
                            'REMILIA-FILMS': 'REMILIA-FILMS',
                            'YEN': 'YEN',
                            'PALETTE': 'PALETTE',
                            'SUBMARINE-CABLE': 'SUBMARINE-CABLE',
                            'DAIHATSU-MIDGET': 'DAIHATSU-MIDGET',
                            'DWARF-FORTRESS-GREEK-BEDROOM-BLUEPRINT': 'DWARF-FORTRESS-GREEK-BEDROOM-BLUEPRINT',
                            'RAVER-CAP': 'RAVER-CAP',
                            'HALO': 'HALO',
                            'HIKKIKOMORI': 'HIKKIKOMORI'
                        };
                        
                        const mappedValue = specificMappings[value];
                        if (mappedValue) {
                            asset = assets.find(a => a.name === mappedValue);
                        }
                    }
                    
                    if (asset) {
                        console.log(`Found asset for ${traitType}: ${asset.name}`);
                        components[category] = {
                            name: asset.name,
                            path: asset.path,
                            image: asset.image
                        };
                    } else {
                        console.log(`No asset found for ${traitType}: ${value}`);
                        // Create a placeholder component
                        components[category] = {
                            name: value,
                            path: `${category.toUpperCase()}/${value}.png`,
                            image: null
                        };
                    }
                } else {
                    console.log(`Unknown trait type: ${traitType}`);
                }
            });
        } else {
            console.log('No attributes found, using existing components');
        }
        
        console.log('Built components from attributes:', components);
        gameBonkler.components = components;
    }

    loadFallbackComponentImages(components) {
        // Load images for fallback components
        Object.entries(components).forEach(([category, component]) => {
            if (component.path && !component.image) {
                const img = new Image();
                img.onload = () => {
                    component.image = img;
                    console.log(`Loaded fallback image for ${category}: ${component.name}`);
                };
                img.onerror = () => {
                    console.log(`Failed to load fallback image for ${category}: ${component.path}`);
                };
                img.src = component.path;
            }
        });
    }

    renderNFTAsBase(nft) {
        if (!this.ctx) {
            console.error('Canvas context not available');
            return;
        }
        
        console.log('renderNFTAsBase called for:', nft.name);
        console.log('Canvas dimensions:', this.canvas.width, 'x', this.canvas.height);
        
        // Keep the artboard clean; fighter metadata lives in the adjacent UI panel.
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.imageSmoothingEnabled = false;
        this.renderNFTComponentsFromBuilder();
        
        console.log('renderNFTAsBase completed');
    }

    renderNFTComponents(nft) {
        if (!this.ctx || !nft || !nft.components) {
            console.log('renderNFTComponents: Missing ctx, nft, or components');
            return;
        }

        console.log('Rendering NFT components:', nft.name, nft.components);

        // Render layers in order: body → armor → hands → offhand → head → pilot → accessories
        const layerOrder = ['body', 'armor', 'hands', 'offhand', 'head', 'pilot', 'accessory'];
        const scale = 0.4; // Larger scale for builder preview
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        
        let renderedComponents = 0;
        
        layerOrder.forEach(layer => {
            const component = nft.components[layer];
            console.log(`Checking ${layer}:`, component);
            
            if (component && component.image && component.image.complete && component.image.naturalWidth > 0) {
                console.log(`Rendering ${layer} image:`, component.name);
                const scaledWidth = component.image.width * scale;
                const scaledHeight = component.image.height * scale;
                const drawX = centerX - scaledWidth / 2;
                const drawY = centerY - scaledHeight / 2;
                
                this.ctx.drawImage(component.image, drawX, drawY, scaledWidth, scaledHeight);
                renderedComponents++;
            } else if (component && component.name) {
                console.log(`Drawing placeholder for ${layer}:`, component.name);
                // Draw a placeholder for components without images
                this.drawComponentPlaceholder(this.ctx, component.name, this.canvas.width, this.canvas.height, scale);
                renderedComponents++;
            }
        });
        
        console.log(`Rendered ${renderedComponents} components for ${nft.name}`);
    }

    renderNFTComponentsFromBuilder() {
        if (!this.ctx || !this.builderComponents) {
            console.log('renderNFTComponentsFromBuilder: Missing ctx or builderComponents');
            return;
        }

        console.log('Rendering builder components:', this.builderComponents);
        console.log('Builder components keys:', Object.keys(this.builderComponents));
        console.log('Canvas dimensions:', this.canvas.width, 'x', this.canvas.height);

        // Render layers in order: body → armor → hands → offhand → head → pilot → accessories
        const layerOrder = ['body', 'armor', 'hands', 'offhand', 'head', 'pilot', 'accessory'];
        const scale = 0.4; // Larger scale for builder preview
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        
        let renderedComponents = 0;
        
        layerOrder.forEach(layer => {
            const component = this.builderComponents[layer];
            console.log(`Checking ${layer}:`, component);
            
            if (component && component.image && component.image.complete && component.image.naturalWidth > 0) {
                console.log(`Rendering ${layer} image:`, component.name, 'at', component.image.width, 'x', component.image.height);
                const scaledWidth = component.image.width * scale;
                const scaledHeight = component.image.height * scale;
                const drawX = centerX - scaledWidth / 2;
                const drawY = centerY - scaledHeight / 2;
                
                console.log(`Drawing at position:`, drawX, drawY, 'with size:', scaledWidth, 'x', scaledHeight);
                this.ctx.drawImage(component.image, drawX, drawY, scaledWidth, scaledHeight);
                renderedComponents++;
            } else if (component && component.name) {
                console.log(`Drawing placeholder for ${layer}:`, component.name);
                // Draw a placeholder for components without images
                this.drawComponentPlaceholder(this.ctx, component.name, this.canvas.width, this.canvas.height, scale);
                renderedComponents++;
            } else if (component) {
                console.log(`Component ${layer} exists but has no image or name:`, component);
            }
        });
        
        // If no components were rendered, draw a message
        if (renderedComponents === 0) {
            this.ctx.fillStyle = '#666666';
            this.ctx.font = '16px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('No components equipped', centerX, centerY);
        }
        
        console.log(`Rendered ${renderedComponents} components from builder`);
    }

    drawNFTPreview(nft) {
        // Create a simple NFT preview based on the token ID
        const tokenId = nft.tokenId || 0;
        
        // Draw a robot head based on the token ID
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        
        // Head
        this.ctx.fillStyle = '#4A90E2';
        this.ctx.fillRect(centerX - 40, centerY - 60, 80, 80);
        
        // Eyes
        this.ctx.fillStyle = '#FF4444';
        this.ctx.fillRect(centerX - 25, centerY - 45, 15, 15);
        this.ctx.fillRect(centerX + 10, centerY - 45, 15, 15);
        
        // Antenna
        this.ctx.fillStyle = '#FFD700';
        this.ctx.fillRect(centerX - 5, centerY - 80, 10, 20);
        this.ctx.fillStyle = '#FF4444';
        this.ctx.fillRect(centerX - 3, centerY - 85, 6, 6);
        
        // Mouth
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.fillRect(centerX - 20, centerY - 15, 40, 8);
        this.ctx.fillStyle = '#000000';
        for (let i = 0; i < 4; i++) {
            this.ctx.fillRect(centerX - 15 + (i * 8), centerY - 12, 4, 2);
        }
        
        // Add some variation based on token ID
        if (tokenId % 2 === 0) {
            // Add horns
            this.ctx.fillStyle = '#8B4513';
            this.ctx.fillRect(centerX - 35, centerY - 70, 8, 15);
            this.ctx.fillRect(centerX + 27, centerY - 70, 8, 15);
        }
        
        if (tokenId % 3 === 0) {
            // Add visor
            this.ctx.fillStyle = '#000000';
            this.ctx.fillRect(centerX - 30, centerY - 50, 60, 8);
        }
    }

    drawNFTPreviewOnCanvas(canvasId, nft) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        const tokenId = nft.tokenId || 0;
        
        // Clear canvas
        ctx.clearRect(0, 0, 60, 60);
        
        // Draw a smaller robot head for inventory
        const centerX = 30;
        const centerY = 30;
        
        // Head
        ctx.fillStyle = '#4A90E2';
        ctx.fillRect(centerX - 20, centerY - 25, 40, 40);
        
        // Eyes
        ctx.fillStyle = '#FF4444';
        ctx.fillRect(centerX - 12, centerY - 18, 8, 8);
        ctx.fillRect(centerX + 4, centerY - 18, 8, 8);
        
        // Antenna
        ctx.fillStyle = '#FFD700';
        ctx.fillRect(centerX - 3, centerY - 35, 6, 10);
        ctx.fillStyle = '#FF4444';
        ctx.fillRect(centerX - 2, centerY - 38, 4, 3);
        
        // Mouth
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(centerX - 10, centerY - 5, 20, 4);
        ctx.fillStyle = '#000000';
        for (let i = 0; i < 2; i++) {
            ctx.fillRect(centerX - 8 + (i * 4), centerY - 4, 2, 1);
        }
        
        // Add some variation based on token ID
        if (tokenId % 2 === 0) {
            // Add horns
            ctx.fillStyle = '#8B4513';
            ctx.fillRect(centerX - 18, centerY - 30, 4, 8);
            ctx.fillRect(centerX + 14, centerY - 30, 4, 8);
        }
        
        if (tokenId % 3 === 0) {
            // Add visor
            ctx.fillStyle = '#000000';
            ctx.fillRect(centerX - 15, centerY - 20, 30, 4);
        }
    }

    updateBuilderComponentDisplay() {
        // Update each component category to show only purchased items
        const categories = ['pilot', 'body', 'armor', 'hands', 'offhand', 'accessory'];
        
        categories.forEach(category => {
            const availableItems = this.getPurchasedItemsByType(category);
            this.updateComponentDisplayForBuilder(category, availableItems);
        });
    }

    updateBuilderComponentDisplayForNFT(nft) {
        console.log('updateBuilderComponentDisplayForNFT called');
        console.log('builderComponents:', this.builderComponents);
        
        // Update each component category to show NFT's actual components
        const categories = ['pilot', 'body', 'armor', 'hands', 'offhand', 'accessory'];
        
        categories.forEach(category => {
            const nftComponent = this.builderComponents[category];
            console.log(`Processing ${category}:`, nftComponent);
            
            if (nftComponent) {
                this.updateComponentDisplayForNFT(category, nftComponent);
            } else {
                console.log(`No component found for ${category}`);
                // Show empty state for missing components
                this.updateComponentDisplayForBuilder(category, []);
            }
        });
    }

    normalizeComponentType(type) {
        const aliases = {
            pilots: 'pilot',
            bodies: 'body',
            heads: 'head',
            armors: 'armor',
            hand: 'hands',
            offhands: 'offhand',
            accessories: 'accessory'
        };
        return aliases[type] || type;
    }

    getPurchasedItemsByType(type) {
        if (!this.purchasedItems) return [];
        const normalized = this.normalizeComponentType(type);
        return this.purchasedItems.filter((item) => this.normalizeComponentType(item.type) === normalized);
    }

    updateComponentDisplayForBuilder(category, availableItems) {
        const displayElement = document.querySelector(`#${category}-display`);
        if (!displayElement) return;
        
        if (availableItems.length === 0) {
            displayElement.innerHTML = '<div class="component-item">No items purchased</div>';
            return;
        }
        
        // Show first item by default
        const currentItem = availableItems[this.componentIndices[category] || 0];
        if (currentItem) {
            displayElement.innerHTML = `
                <div class="component-item" data-index="${this.componentIndices[category] || 0}">
                    <img src="${this.getComponentImagePath(currentItem)}" alt="${currentItem.name}">
                    <div class="component-info">
                        <div class="component-name">${currentItem.name}</div>
                        <div class="component-stats">
                            ${currentItem.attack ? `Attack: +${currentItem.attack}` : ''}
                            ${currentItem.defense ? `Defense: +${currentItem.defense}` : ''}
                        </div>
                    </div>
                </div>
            `;
        }
        
        // Update navigation arrows
        const prevArrow = document.querySelector(`.nav-arrow[data-category="${category}"][data-direction="prev"]`);
        const nextArrow = document.querySelector(`.nav-arrow[data-category="${category}"][data-direction="next"]`);
        
        if (prevArrow) prevArrow.disabled = this.componentIndices[category] <= 0;
        if (nextArrow) nextArrow.disabled = this.componentIndices[category] >= availableItems.length - 1;
    }

    updateComponentDisplayForNFT(category, nftComponent) {
        const displayElement = document.querySelector(`#${category}-display`);
        console.log(`Looking for display element for ${category}:`, displayElement);
        if (!displayElement) {
            console.log(`No display element found for ${category}`);
            return;
        }
        
        console.log(`Updating display for ${category}:`, nftComponent);
        
        // Display the NFT's component
        displayElement.innerHTML = `
            <div class="component-item selected" data-index="0">
                <img src="${nftComponent.path}" alt="${nftComponent.name}">
                <div class="component-info">
                    <div class="component-name">${nftComponent.name}</div>
                    <div class="component-stats">
                        ${nftComponent.attack ? `Attack: +${nftComponent.attack}` : ''}
                        ${nftComponent.defense ? `Defense: +${nftComponent.defense}` : ''}
                    </div>
                </div>
            </div>
        `;
        
        // Disable navigation arrows since this is the NFT's component
        const prevArrow = document.querySelector(`.nav-arrow[data-category="${category}"][data-direction="prev"]`);
        const nextArrow = document.querySelector(`.nav-arrow[data-category="${category}"][data-direction="next"]`);
        
        if (prevArrow) prevArrow.disabled = true;
        if (nextArrow) nextArrow.disabled = true;
    }

    getComponentImagePath(item) {
        if (item.path) return item.path;
        const type = this.normalizeComponentType(item.type);
        const folderMap = {
            pilot: 'PILOT',
            body: 'BODIES',
            armor: 'ARMORS',
            head: 'HEADS',
            hands: 'HANDS',
            offhand: 'OFFHAND',
            accessory: 'ACCESSORIES'
        };
        return `${folderMap[type] || type.toUpperCase()}/${item.asset || ''}`;
    }

    drawEmptyBuilder() {
        if (!this.ctx) return;
        
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw empty state
        this.ctx.fillStyle = '#f0f0f0';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw instructions
        this.ctx.fillStyle = '#000000';
        this.ctx.font = '18px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('Fighter Builder', this.canvas.width / 2, 100);
        this.ctx.font = '14px Arial';
        this.ctx.fillText('Select an NFT from your inventory to customize', this.canvas.width / 2, 130);
        this.ctx.fillText('You can only use items you have purchased', this.canvas.width / 2, 150);
    }



    confirmFighter() {
        if (!this.selectedNFT) {
            this.showModal('No NFT Selected', 'Please select an NFT from your inventory to customize.');
            return;
        }
        
        // Save the customized components directly to the selected NFT
        this.selectedNFT.customized = true;
        this.selectedNFT.customComponents = { ...this.builderComponents };
        this.selectedNFT.customName = `${this.selectedNFT.name} (Customized)`;
        
        // Update the NFT's components for battle
        this.selectedNFT.components = { ...this.builderComponents };
        
        // Update the NFT in the userNFTs array
        const nftIndex = this.userNFTs.findIndex(nft => nft.id === this.selectedNFT.id);
        if (nftIndex !== -1) {
            this.userNFTs[nftIndex] = { ...this.selectedNFT };
        }
        
        // Save and update inventory
        this.saveGameData();
        this.populateInventory();
        
        // Switch to battle screen and start battle
        this.switchScreen('battle');
        this.startBattle();
        
        // Reset builder
        this.selectedNFT = null;
        this.builderComponents = {
            pilot: null,
            body: null,
            head: null,
            armor: null,
            hands: null,
            offhand: null,
            accessory: null
        };
        
        // Update builder header
        const builderHeader = document.querySelector('.builder-header h2');
        if (builderHeader) {
            builderHeader.textContent = 'Fighter Builder';
        }
        
        // Draw empty builder
        this.drawEmptyBuilder();
    }

    setBattleSessionLayout(active) {
        document.getElementById('game-container')?.classList.toggle('battle-session', Boolean(active));
        document.getElementById('battle-screen')?.classList.toggle('combat-active', Boolean(active));
    }

    switchScreen(screenName) {
        if (!screenName) return;
        if (screenName !== 'battle' && this.battleAnimation) {
            cancelAnimationFrame(this.battleAnimation);
            this.battleAnimation = null;
        }
        console.log('Switching to screen:', screenName);
        
        const applyScreen = () => {
            document.querySelectorAll('.nav-btn').forEach((button) => {
                const isActive = button.dataset.screen === screenName;
                button.classList.toggle('active', isActive);
                if (isActive) button.setAttribute('aria-current', 'page');
                else button.removeAttribute('aria-current');
            });

            document.querySelectorAll('.screen').forEach((screen) => {
                const isActive = screen.id === `${screenName}-screen`;
                screen.classList.toggle('active', isActive);
                screen.setAttribute('aria-hidden', String(!isActive));
            });
        };
        
        applyScreen();
        
        this.setBattleSessionLayout(screenName === 'battle' && Boolean(this.currentBattle));
        if (screenName === 'shop') this.populateShop(this.currentShopCategory);
        if (screenName === 'leaderboard') this.updateLeaderboard();
        this.playTone(330, 0.035, 'square', 0.014);
        window.scrollTo({ top: 0, behavior: 'instant' });
    }

    setBattleMode(mode) {
        this.battleMode = mode;
        document.querySelectorAll('.battle-mode-btn').forEach((button) => {
            const isActive = button.dataset.mode === mode;
            button.classList.toggle('active', isActive);
            button.setAttribute('aria-pressed', String(isActive));
        });
        if (mode === 'pvp') this.showModal('PvP In Development', 'Local and wallet AI battles are ready. Network PvP is not yet available.');
    }

    setShopCategory(category) {
        this.currentShopCategory = category;
        document.querySelectorAll('.category-btn').forEach((button) => {
            const isActive = button.dataset.category === category;
            button.classList.toggle('active', isActive);
            button.setAttribute('aria-selected', String(isActive));
        });
        this.populateShop(category);
    }

    setInventoryTab(tab) {
        // Update tab buttons
        document.querySelectorAll('.inventory-tab-btn').forEach((button) => {
            const isActive = button.dataset.tab === tab;
            button.classList.toggle('active', isActive);
            button.setAttribute('aria-selected', String(isActive));
        });
        
        // Show/hide sections based on tab
        const nftSection = document.querySelector('.nft-carousel-section');
        const skillsSection = document.querySelector('.skills-section');
        
        // Hide all sections first
        nftSection.style.display = 'none';
        skillsSection.style.display = 'none';
        
        if (tab === 'nfts') {
            nftSection.style.display = 'block';
            this.populateInventoryNFTs();
        } else if (tab === 'skills') {
            skillsSection.style.display = 'block';
            this.populateInventorySkills();
        }
    }

    setLeaderboardTab(tab) {
        document.querySelectorAll('.tab-btn').forEach((button) => {
            const isActive = button.dataset.tab === tab;
            button.classList.toggle('active', isActive);
            button.setAttribute('aria-selected', String(isActive));
        });
        this.currentLeaderboardTab = tab;
        this.populateLeaderboard(tab);
    }

    // NFT Management
    reprocessNFTsWithAssets() {
        console.log('Re-processing NFTs with loaded assets...');
        
        // Process all NFTs with the now-loaded component assets
        const processNFT = (nft) => {
            if (nft.components) {
                // Re-process each component to get proper images
                Object.keys(nft.components).forEach(category => {
                    const component = nft.components[category];
                    if (component && component.name) {
                        const assets = this.componentAssets[category] || [];
                        const asset = assets.find(a => a.name === component.name);
                        if (asset) {
                            component.image = asset.image || component.image || null;
                            component.path = asset.path;
                        }
                    }
                });
            }
        };
        
        // Process main NFTs
        this.nfts.forEach(processNFT);
        
        // Process user NFTs
        this.userNFTs.forEach(processNFT);
        
        // Re-populate the NFT display
        this.populateNFTs();
    }

    populateNFTs() {
        if (!this.userNFTs || this.userNFTs.length === 0) {
            const nftGrid = document.getElementById('nft-grid');
            nftGrid.innerHTML = '<div class="no-nfts-message">No fighters found in your wallet. Connect your wallet to see your NFTs.</div>';
            return;
        }

        const nftGrid = document.getElementById('nft-grid');
        nftGrid.innerHTML = '';

        this.userNFTs.forEach(nft => {
            const nftCard = document.createElement('button');
            nftCard.type = 'button';
            nftCard.className = 'nft-card';
            nftCard.dataset.nftId = nft.id;
            
            // Add NFT indicator if it's an NFT
            const nftBadge = nft.isNFT ? '<div class="nft-badge">NFT</div>' : '';
            const safeName = this.escapeHTML(nft.name);
            const safeDescription = this.escapeHTML(nft.description || '');
            const safeTokenId = this.escapeHTML(nft.tokenId || '');
            
            // Always create a fighter preview canvas
            nftCard.innerHTML = `
                <div class="nft-avatar custom-fighter">
                    <canvas class="fighter-preview" width="120" height="180"></canvas>
                    ${nftBadge}
                </div>
                <div class="nft-name">${safeName}</div>
                <div class="nft-description">${safeDescription}</div>
                <div class="nft-stats">
                    <div>Level: ${nft.level}</div>
                    <div>Attack: ${nft.attack}</div>
                    <div>Defense: ${nft.defense}</div>
                    <div>Health: ${nft.health}/${nft.maxHealth}</div>
                    ${nft.tokenId ? `<div>Token ID: ${safeTokenId}</div>` : ''}
                </div>
            `;
            
            // Render fighter preview
            const previewCanvas = nftCard.querySelector('.fighter-preview');
            const previewCtx = previewCanvas.getContext('2d');
            this.renderFighterPreview(previewCtx, nft.components || {});

            nftCard.addEventListener('click', () => this.selectNFT(nft));
            nftGrid.appendChild(nftCard);
        });
    }

    selectNFT(nft) {
        console.log('NFT selected:', nft);
        this.selectedNFT = nft;
        
        // Update visual selection
        document.querySelectorAll('.nft-card').forEach(card => {
            card.classList.remove('selected');
        });
        document.querySelector(`[data-nft-id="${nft.id}"]`).classList.add('selected');

        // Load customized components if they exist
        if (nft.components) {
            console.log('Loading customized components for battle:', nft.components);
            
            // Ensure all component images are loaded
            Object.entries(nft.components).forEach(([layer, component]) => {
                if (component && component.path && !component.image) {
                    console.log(`Loading image for ${layer} component:`, component.name);
                    const image = new Image();
                    image.onload = () => {
                        console.log(`Image loaded for ${layer} component:`, component.name);
                        component.image = image;
                    };
                    image.onerror = (error) => {
                        console.error(`Failed to load image for ${layer} component:`, component.name, error);
                    };
                    image.src = component.path;
                }
            });
        }

        // Start battle if NFT is selected
        this.startBattle();
    }

    async startBattle() {
        if (!this.selectedNFT) {
            console.log('No NFT selected for battle');
            return;
        }

        // Switch to battle screen and collapse fighter selection during combat.
        this.switchScreen('battle');
        document.querySelector('.nft-selection')?.classList.add('battle-running');
        
        // Initialize battle canvas
        this.initBattleCanvas();
        
        // Initialize battle log
        this.initializeBattleLog();
        
        // Create enemy fighter
        this.enemyFighter = this.createRandomEnemy();
        
        // Create player fighter from selected NFT
        console.log('Selected NFT for battle:', this.selectedNFT);
        console.log('Selected NFT health:', this.selectedNFT.health);
        console.log('Selected NFT maxHealth:', this.selectedNFT.maxHealth);
        
        // Set default health if not defined
        const defaultHealth = 400;
        const defaultMaxHealth = 400;
        
        this.playerFighter = {
            name: this.selectedNFT.name,
            level: Math.max(1, Number(this.selectedNFT.level) || 1),
            attack: Math.max(35, Math.min(200, Number(this.selectedNFT.attack) || 70)),
            defense: Math.max(20, Math.min(220, Number(this.selectedNFT.defense) || 50)),
            health: Math.max(1, Number(this.selectedNFT.health) || defaultHealth),
            maxHealth: Math.max(1, Number(this.selectedNFT.maxHealth) || defaultMaxHealth),
            components: this.selectedNFT.components || {}
        };
        
        console.log('Player fighter created with health:', this.playerFighter.health, '/', this.playerFighter.maxHealth);
        
        // Apply customized components if they exist
        if (this.selectedNFT.components) {
            console.log('Using customized components for battle:', this.selectedNFT.components);
            
            // Calculate additional stats from components
            let additionalAttack = 0;
            let additionalDefense = 0;
            
            Object.values(this.selectedNFT.components).forEach(component => {
                if (component && component.attack) {
                    additionalAttack += component.attack;
                }
                if (component && component.defense) {
                    additionalDefense += component.defense;
                }
            });
            
            // Apply component bonuses
            this.playerFighter.attack = Math.min(200, this.playerFighter.attack + additionalAttack);
            this.playerFighter.defense = Math.min(220, this.playerFighter.defense + additionalDefense);
            
            console.log(`Applied component bonuses: +${additionalAttack} ATK, +${additionalDefense} DEF`);
            console.log('Final player fighter stats:', this.playerFighter);
            
            // Copy components to player fighter for rendering
            this.playerFighter.components = { ...this.selectedNFT.components };
            console.log('Copied components to player fighter:', this.playerFighter.components);
        }
        
        console.log('Player fighter created:', this.playerFighter);
        console.log('Player fighter components:', this.playerFighter.components);
        
        // Decode only the 2 active units before the arena becomes visible.
        await this.loadFighterImages([this.playerFighter, this.enemyFighter]);

        // Set up battle state
        this.currentBattle = {
            player: { ...this.playerFighter },
            enemy: { ...this.enemyFighter },
            turn: 'player',
            timer: 30
        };
        this.setBattleSessionLayout(true);

        // Reset battle state
        this.battleState.powerUpCount = 0;
        this.battleState.powerUpActive = false;
        this.battleState.defendActive = false;
        this.battleState.dodgeActive = false;
        this.battleState.enemyDefendActive = false;
        this.battleState.counterActive = false;
        this.battleState.healUses = 1;
        this.battleState.bonklerBeamUses = 3;

        // Show battle arena
        document.getElementById('battle-arena').style.display = 'block';
        
        // Add battle start log entry
        this.addBattleLogEntry(`Battle started! ${this.playerFighter.name} vs ${this.enemyFighter.name}`, 'battle-event');
        this.addBattleLogEntry(`Your fighter: ${this.playerFighter.attack} ATK, ${this.playerFighter.defense} DEF`, 'player-action');
        this.addBattleLogEntry(`Enemy fighter: ${this.enemyFighter.attack} ATK, ${this.enemyFighter.defense} DEF`, 'enemy-action');
        
        // Initial render
        this.renderBattle();
        
        // Update health bar displays immediately
        console.log('Updating player health bar:', this.playerFighter);
        this.updateCharacterDisplay('player', this.playerFighter);
        console.log('Updating enemy health bar:', this.enemyFighter);
        this.updateCharacterDisplay('enemy', this.enemyFighter);
        
        // Force a second update after a short delay to ensure it sticks
        setTimeout(() => {
            console.log('Forcing second health bar update...');
            this.updateCharacterDisplay('player', this.playerFighter);
            this.updateCharacterDisplay('enemy', this.enemyFighter);
        }, 100);
        
        // Timer removed - battles are now unlimited
        
        // Enable battle controls
        this.enableBattleControls();
    }



    // Battle Animation Methods
    initBattleCanvas() {
        this.battleCanvas = document.getElementById('battle-canvas');
        this.battleCtx = this.battleCanvas.getContext('2d');
        this.battleCtx.imageSmoothingEnabled = false;
    }

    getDifficultySettings() {
        return BATTLE_BALANCE.difficulties[this.battleDifficulty]
            || BATTLE_BALANCE.difficulties.standard;
    }

    calculateCombatDamage(attack, defense, power = 1) {
        const safeAttack = Math.max(1, Number(attack) || 1);
        const safeDefense = Math.max(0, Number(defense) || 0);
        const mitigation = BATTLE_BALANCE.defenseScale / (BATTLE_BALANCE.defenseScale + safeDefense);
        const variance = 0.9 + Math.random() * 0.2;
        return Math.max(1, Math.round(safeAttack * power * mitigation * variance));
    }

    getPowerUpMultiplier() {
        return 1 + Math.min(this.battleState.powerUpCount, BATTLE_BALANCE.maxPowerStacks)
            * BATTLE_BALANCE.powerUpPerStack;
    }

    applyEnemyGuard(damage) {
        if (!this.battleState.enemyDefendActive) return damage;
        this.battleState.enemyDefendActive = false;
        this.addBattleLogEntry('Enemy guard absorbs part of the hit!', 'enemy-action');
        return Math.max(1, Math.round(damage * (1 - BATTLE_BALANCE.guardReduction)));
    }

    createRandomEnemy() {
        const categories = ['pilot', 'body', 'head', 'armor', 'hands', 'offhand', 'accessory'];
        const enemyComponents = {};

        categories.forEach(category => {
            const assets = this.componentAssets[category] || [];
            if (assets.length > 0) {
                const randomIndex = Math.floor(Math.random() * assets.length);
                enemyComponents[category] = assets[randomIndex];
            }
        });

        const settings = this.getDifficultySettings();
        const selected = this.selectedNFT || {};
        const componentBonuses = Object.values(selected.components || {}).reduce((totals, component) => ({
            attack: totals.attack + (Number(component?.attack) || 0),
            defense: totals.defense + (Number(component?.defense) || 0)
        }), { attack: 0, defense: 0 });
        const playerAttack = Math.max(40, (Number(selected.attack) || 70) + componentBonuses.attack);
        const playerDefense = Math.max(25, (Number(selected.defense) || 50) + componentBonuses.defense);
        const playerHealth = Math.max(320, Number(selected.maxHealth) || Number(selected.health) || 400);
        const combatLevel = Math.max(1, this.level, Number(selected.level) || 1);
        const enemyLevel = Math.max(1, combatLevel + Math.floor(Math.random() * 3) - 1);
        const maxHealth = Math.round(playerHealth * (0.88 + Math.random() * 0.12) * settings.health);

        return {
            name: `${settings.label} Enemy Bonkler`,
            level: enemyLevel,
            attack: Math.round((playerAttack * 0.88 + enemyLevel * 2) * settings.attack),
            defense: Math.round((playerDefense * 0.72 + enemyLevel * 2) * settings.defense),
            health: maxHealth,
            maxHealth,
            components: enemyComponents
        };
    }

    renderFighterOnBattleCanvas(fighter, x, y, scale = 0.3, isEnemy = false) {
        if (!this.battleCtx || !fighter || !fighter.components) return;

        this.battleCtx.imageSmoothingEnabled = false;

        // Render layers in order: body → armor → hands → offhand → head → pilot → accessories
        const layerOrder = ['body', 'armor', 'hands', 'offhand', 'head', 'pilot', 'accessory'];

        layerOrder.forEach(layer => {
            const component = fighter.components[layer];

            if (component && component.image && component.image.complete && component.image.naturalWidth > 0) {
                // Keep full-height source layers inside the 800×400 logical arena.
                const arenaScale = scale * 0.82;
                const scaledWidth = component.image.width * arenaScale;
                const scaledHeight = component.image.height * arenaScale;
                const drawX = x - scaledWidth / 2;
                const drawY = y - scaledHeight / 2;
                
                if (!isEnemy) {
                    // Mirror the player's fighter by flipping horizontally
                    this.battleCtx.save();
                    this.battleCtx.scale(-1, 1);
                    this.battleCtx.drawImage(component.image, -drawX - scaledWidth, drawY, scaledWidth, scaledHeight);
                    this.battleCtx.restore();
                } else {
                    // Enemy fighter stays as is
                    this.battleCtx.drawImage(component.image, drawX, drawY, scaledWidth, scaledHeight);
                }
            }
        });
    }

    // Safe fallbacks are replaced by combat-animations.js before game initialization.
    animateAttack() { this.renderBattle(); }
    animateSpecialAttack() { this.renderBattle(); }
    animateDefend() { this.renderBattle(); }
    animatePowerUp() { this.renderBattle(); }
    animateBonklerBeam() { this.renderBattle(); }
    animateDodge() { this.renderBattle(); }
    animateRepair() { this.renderBattle(); }
    animateCounter() { this.renderBattle(); }

    renderBattle() {
        if (!this.battleCtx) return;
        
        // Clear canvas
        this.battleCtx.clearRect(0, 0, this.battleCanvas.width, this.battleCanvas.height);
        this.battleCtx.imageSmoothingEnabled = false;
        
        // Transparent background - no background image
        // Canvas is already transparent, no need to draw anything
        
        // Draw fighters
        this.renderFighterOnBattleCanvas(this.playerFighter, 150, 200, 0.3, false);
        this.renderFighterOnBattleCanvas(this.enemyFighter, 650, 200, 0.3, true);
        
        // If background still isn't loaded, try to reload it
        if (!this.battleBackground || !this.battleBackground.complete) {
            setTimeout(() => {
                this.preloadBattleBackground();
                this.renderBattle();
            }, 100);
        }
    }

    updateCharacterDisplay(side, character) {
        console.log(`Updating ${side} character display:`, character);
        
        const healthBar = document.getElementById(`${side}-health`);
        console.log(`Looking for health bar element: ${side}-health`);
        console.log(`Health bar element found:`, healthBar);
        
        if (healthBar) {
            const healthPercentage = Math.max(0, Math.min(100, (character.health / character.maxHealth) * 100));
            console.log(`Calculated health percentage: ${healthPercentage}%`);
            healthBar.style.width = `${healthPercentage}%`;
            console.log(`Updated ${side} health bar to ${healthPercentage}% (${character.health}/${character.maxHealth})`);
            
            // Also update the health text if it exists
            const healthText = document.getElementById(`${side}-health-text`);
            if (healthText) {
                healthText.textContent = `${character.health}/${character.maxHealth}`;
            }
        } else {
            console.warn(`Health bar element not found: ${side}-health`);
            // Let's check what health bar elements actually exist
            const allHealthElements = document.querySelectorAll('[id*="health"]');
            console.log('All health-related elements:', allHealthElements);
        }
    }



    enableBattleControls() {
        document.querySelectorAll('.battle-btn').forEach(btn => {
            btn.disabled = false;
        });
        
        // Advanced actions require both progression and an equipped shop unlock.
        const specialBtn = document.getElementById('special-btn');
        if (specialBtn) {
            specialBtn.style.display = this.level >= 5 && this.equippedSkills.includes('Special')
                ? 'grid'
                : 'none';
        }

        const beamBtn = document.getElementById('bonkler-beam-btn');
        if (beamBtn) {
            beamBtn.style.display = this.level >= 10 && this.equippedSkills.includes('Bonkler Beam')
                ? 'grid'
                : 'none';
        }
        
        // Show equipped skills dynamically
        this.showEquippedSkills();
    }

    disableBattleControls() {
        document.querySelectorAll('.battle-btn').forEach(btn => {
            btn.disabled = true;
        });
    }

    performSlash() {
        if (!this.currentBattle || this.currentBattle.turn !== 'player') return;

        const damageMultiplier = this.getPowerUpMultiplier();
        if (this.battleState.powerUpCount > 0) {
            this.addBattleLogEntry(`Power-up bonus: +${Math.round((damageMultiplier - 1) * 100)}%`, 'power-up');
        }

        const damage = this.applyEnemyGuard(this.calculateCombatDamage(
            this.currentBattle.player.attack,
            this.currentBattle.enemy.defense,
            damageMultiplier
        ));
        this.currentBattle.enemy.health = Math.max(0, this.currentBattle.enemy.health - damage);
        
        this.addBattleLogEntry(`You slash the enemy!`, 'player-action');
        this.addBattleLogEntry(`Dealt ${damage} damage!`, 'damage');
        
        // Animate the attack
        this.animateAttack(this.currentBattle.player, this.currentBattle.enemy, true);
        
        this.updateCharacterDisplay('enemy', this.currentBattle.enemy);
        this.showBattleEffect('attack', damage);
        
        if (this.currentBattle.enemy.health <= 0) {
            // Enemy dies
            this.currentBattle.enemy.health = 0;
            this.updateCharacterDisplay('enemy', this.currentBattle.enemy);
            this.showBattleEffect('enemy-death', 0);
            this.addBattleLogEntry(`Enemy defeated!`, 'battle-event');
            setTimeout(() => this.endBattle('victory'), 2000);
        } else {
            this.currentBattle.turn = 'enemy';
            this.addBattleLogEntry(`Enemy's turn...`, 'enemy-action');
            setTimeout(() => this.enemyTurn(), 1500);
        }
    }

    performPowerUp() {
        if (!this.currentBattle || this.currentBattle.turn !== 'player') return;

        if (this.battleState.powerUpCount >= BATTLE_BALANCE.maxPowerStacks) {
            this.addBattleLogEntry('Power-up is already at maximum charge!', 'power-up');
            return;
        }

        this.battleState.powerUpCount++;
        this.addBattleLogEntry(`You power up! (${this.battleState.powerUpCount}/${BATTLE_BALANCE.maxPowerStacks})`, 'player-action');
        this.addBattleLogEntry(`Attack increased by ${Math.round(BATTLE_BALANCE.powerUpPerStack * 100)}%.`, 'power-up');
        this.battleState.powerUpActive = true;
        this.showBattleEffect('power-up', 0);
        
        // Animate the power-up action with sword emoji
        this.animatePowerUp();
        
        this.currentBattle.turn = 'enemy';
        this.addBattleLogEntry(`Enemy's turn...`, 'enemy-action');
        setTimeout(() => this.enemyTurn(), 1000);
    }

    performDefend() {
        if (!this.currentBattle || this.currentBattle.turn !== 'player') return;

        this.addBattleLogEntry(`You take a defensive stance!`, 'player-action');
        this.addBattleLogEntry(`The next damaging hit is reduced by ${Math.round(BATTLE_BALANCE.guardReduction * 100)}%.`, 'defend');

        // Guard lasts until the next damaging enemy action.
        this.battleState.defendActive = true;
        this.showBattleEffect('defend', 0);
        
        // Animate the defend action with shield emoji
        this.animateDefend();
        
        this.currentBattle.turn = 'enemy';
        this.addBattleLogEntry(`Enemy's turn...`, 'enemy-action');
        setTimeout(() => this.enemyTurn(), 1000);
    }

    performDodge() {
        if (!this.currentBattle || this.currentBattle.turn !== 'player') return;

        this.addBattleLogEntry(`You prepare to dodge!`, 'player-action');
        this.addBattleLogEntry(`${Math.round(this.battleState.dodgeSuccessRate * 100)}% chance to dodge the next attack!`, 'dodge');
        
        // Activate dodge for next enemy attack
        this.battleState.dodgeActive = true;
        this.showBattleEffect('dodge', 0);
        this.animateDodge?.();

        this.currentBattle.turn = 'enemy';
        this.addBattleLogEntry(`Enemy's turn...`, 'enemy-action');
        setTimeout(() => this.enemyTurn(), 1000);
    }

    performSpecial() {
        if (!this.currentBattle || this.currentBattle.turn !== 'player') return;

        if (this.level < 5 || !this.equippedSkills.includes('Special')) {
            this.addBattleLogEntry(`Special requires level 5 and an equipped unlock!`, 'battle-event');
            return;
        }
        
        // Check if player has powered up 3 times
        if (this.battleState.powerUpCount < 3) {
            this.addBattleLogEntry(`Special attack requires 3 power-ups! (${this.battleState.powerUpCount}/3)`, 'battle-event');
            return;
        }
        
        // Special trades three setup turns for one defense-aware heavy hit.
        const damage = this.applyEnemyGuard(this.calculateCombatDamage(
            this.currentBattle.player.attack,
            this.currentBattle.enemy.defense,
            2.25
        ));
        this.currentBattle.enemy.health = Math.max(0, this.currentBattle.enemy.health - damage);
        
        this.addBattleLogEntry(`You unleash a devastating special attack!`, 'player-action');
        this.addBattleLogEntry(`Dealt ${damage} damage!`, 'damage');
        
        // Reset power-up count after using special
        this.battleState.powerUpCount = 0;
        this.battleState.powerUpActive = false;

        // Animate the special attack
        this.animateSpecialAttack(this.currentBattle.player, this.currentBattle.enemy, true);
        
        this.updateCharacterDisplay('enemy', this.currentBattle.enemy);
        this.showBattleEffect('special', damage);
        
        if (this.currentBattle.enemy.health <= 0) {
            // Enemy dies
            this.currentBattle.enemy.health = 0;
            this.updateCharacterDisplay('enemy', this.currentBattle.enemy);
            this.showBattleEffect('enemy-death', 0);
            this.addBattleLogEntry(`Enemy defeated!`, 'battle-event');
            setTimeout(() => this.endBattle('victory'), 2000);
        } else {
            this.currentBattle.turn = 'enemy';
            this.addBattleLogEntry(`Enemy's turn...`, 'enemy-action');
            setTimeout(() => this.enemyTurn(), 1500);
        }
    }

    performBonklerBeam() {
        if (!this.currentBattle || this.currentBattle.turn !== 'player') return;

        if (this.level < 10 || !this.equippedSkills.includes('Bonkler Beam')) {
            this.addBattleLogEntry(`Bonkler Beam requires level 10 and an equipped unlock!`, 'battle-event');
            return;
        }
        
        // Check if player has beam uses remaining
        if (this.battleState.bonklerBeamUses <= 0) {
            this.addBattleLogEntry(`No beam uses remaining!`, 'battle-event');
            return;
        }
        
        // Calculate hit chance (65%)
        const hitRoll = Math.random();
        if (hitRoll > 0.65) {
            this.addBattleLogEntry(`Bonkler Beam missed!`, 'battle-event');
            this.battleState.bonklerBeamUses--;
        this.currentBattle.turn = 'enemy';
        this.addBattleLogEntry(`Enemy's turn...`, 'enemy-action');
        setTimeout(() => this.enemyTurn(), 1000);
            return;
        }
        
        // Beam is powerful but remains defense-aware and cannot remove over half a health bar.
        const damageCap = Math.floor(this.currentBattle.enemy.maxHealth * 0.48);
        const finalDamage = this.applyEnemyGuard(Math.min(
            damageCap,
            this.calculateCombatDamage(
                this.currentBattle.player.attack,
                this.currentBattle.enemy.defense,
                2.8
            )
        ));

        this.currentBattle.enemy.health = Math.max(0, this.currentBattle.enemy.health - finalDamage);
        
        this.addBattleLogEntry(`BONKLER BEAM!`, 'special');
        this.addBattleLogEntry(`Dealt ${finalDamage} damage!`, 'damage');
        
        // Decrease beam uses
        this.battleState.bonklerBeamUses--;
        
        // Animate the beam attack
        this.animateBonklerBeam();
        
        this.updateCharacterDisplay('enemy', this.currentBattle.enemy);
        this.showBattleEffect('beam', finalDamage);
        
        if (this.currentBattle.enemy.health <= 0) {
            // Enemy dies
            this.currentBattle.enemy.health = 0;
            this.updateCharacterDisplay('enemy', this.currentBattle.enemy);
            this.showBattleEffect('enemy-death', 0);
            this.addBattleLogEntry(`Enemy defeated!`, 'battle-event');
            setTimeout(() => this.endBattle('victory'), 2000);
        } else {
            this.currentBattle.turn = 'enemy';
            this.addBattleLogEntry(`Enemy's turn...`, 'enemy-action');
            setTimeout(() => this.enemyTurn(), 1500);
        }
    }

    performDoubleStrike() {
        if (!this.currentBattle || this.currentBattle.turn !== 'player') return;

        // Check if player has Double Strike equipped
        if (!this.equippedSkills || !this.equippedSkills.includes('Double Strike')) {
            this.addBattleLogEntry(`Double Strike not equipped!`, 'battle-event');
            return;
        }
        
        this.addBattleLogEntry(`DOUBLE STRIKE!`, 'special');
        
        const damageMultiplier = this.getPowerUpMultiplier();
        if (this.battleState.powerUpCount > 0) {
            this.addBattleLogEntry(`Power-up bonus: +${Math.round((damageMultiplier - 1) * 100)}%`, 'power-up');
        }

        // Two lighter hits total roughly 45% more damage than Slash.
        const firstDamage = this.applyEnemyGuard(this.calculateCombatDamage(
            this.currentBattle.player.attack,
            this.currentBattle.enemy.defense,
            0.72 * damageMultiplier
        ));
        this.currentBattle.enemy.health = Math.max(0, this.currentBattle.enemy.health - firstDamage);
        this.addBattleLogEntry(`First strike deals ${firstDamage} damage!`, 'damage');
        
        // Animate first attack
        this.animateAttack(this.currentBattle.player, this.currentBattle.enemy, true);
        this.showBattleEffect('attack', firstDamage);
        
        // Check if enemy died from first strike
        if (this.currentBattle.enemy.health <= 0) {
            this.currentBattle.enemy.health = 0;
            this.updateCharacterDisplay('enemy', this.currentBattle.enemy);
            this.showBattleEffect('enemy-death', 0);
            this.addBattleLogEntry(`Enemy defeated!`, 'battle-event');
            setTimeout(() => this.endBattle('victory'), 2000);
            return;
        }
        
        // Second strike after a short delay
        setTimeout(() => {
            const secondDamage = this.calculateCombatDamage(
                this.currentBattle.player.attack,
                this.currentBattle.enemy.defense,
                0.72 * damageMultiplier
            );
            this.currentBattle.enemy.health = Math.max(0, this.currentBattle.enemy.health - secondDamage);
            this.addBattleLogEntry(`Second strike deals ${secondDamage} damage!`, 'damage');
            
            // Animate second attack
            this.animateAttack(this.currentBattle.player, this.currentBattle.enemy, true);
            this.showBattleEffect('attack', secondDamage);
            
            this.updateCharacterDisplay('enemy', this.currentBattle.enemy);
            
            if (this.currentBattle.enemy.health <= 0) {
                // Enemy dies
                this.currentBattle.enemy.health = 0;
                this.updateCharacterDisplay('enemy', this.currentBattle.enemy);
                this.showBattleEffect('enemy-death', 0);
                this.addBattleLogEntry(`Enemy defeated!`, 'battle-event');
                setTimeout(() => this.endBattle('victory'), 2000);
            } else {
                this.currentBattle.turn = 'enemy';
                this.addBattleLogEntry(`Enemy's turn...`, 'enemy-action');
                setTimeout(() => this.enemyTurn(), 1500);
            }
        }, 1000);
    }

    performCounterAttack() {
        if (!this.currentBattle || this.currentBattle.turn !== 'player') return;
        if (!this.equippedSkills.includes('Counter Attack')) return;
        if (this.battleState.counterActive) {
            this.addBattleLogEntry('Counter stance is already armed!', 'battle-event');
            return;
        }

        this.battleState.counterActive = true;
        this.addBattleLogEntry('Counter stance armed for the next damaging attack!', 'defend');
        this.animateCounter?.();
        this.currentBattle.turn = 'enemy';
        setTimeout(() => this.enemyTurn(), 900);
    }

    performHeal() {
        if (!this.currentBattle || this.currentBattle.turn !== 'player') return;
        if (!this.equippedSkills.includes('Heal')) return;
        if (this.battleState.healUses <= 0) {
            this.addBattleLogEntry('Repair charge already spent!', 'battle-event');
            return;
        }
        if (this.currentBattle.player.health >= this.currentBattle.player.maxHealth) {
            this.addBattleLogEntry('Your fighter is already at full health.', 'battle-event');
            return;
        }

        const healing = Math.min(
            this.currentBattle.player.maxHealth - this.currentBattle.player.health,
            Math.round(this.currentBattle.player.maxHealth * 0.28)
        );
        this.currentBattle.player.health += healing;
        this.battleState.healUses--;
        this.updateCharacterDisplay('player', this.currentBattle.player);
        this.addBattleLogEntry(`Field repair restores ${healing} health!`, 'heal');
        this.playTone(520, 0.12, 'sine', 0.025);
        this.animateRepair?.();
        this.currentBattle.turn = 'enemy';
        setTimeout(() => this.enemyTurn(), 900);
    }

    performCriticalStrike() {
        if (!this.currentBattle || this.currentBattle.turn !== 'player') return;
        if (!this.equippedSkills.includes('Critical Strike')) return;

        const critical = Math.random() < 0.6;
        const power = critical ? 1.9 : 0.8;
        const damage = this.applyEnemyGuard(this.calculateCombatDamage(
            this.currentBattle.player.attack,
            this.currentBattle.enemy.defense,
            power * this.getPowerUpMultiplier()
        ));
        this.currentBattle.enemy.health = Math.max(0, this.currentBattle.enemy.health - damage);
        this.addBattleLogEntry(critical ? 'CRITICAL STRIKE!' : 'Critical timing missed — glancing hit.', critical ? 'special' : 'player-action');
        this.addBattleLogEntry(`Dealt ${damage} damage!`, 'damage');
        this.animateAttack(this.currentBattle.player, this.currentBattle.enemy, true);
        this.updateCharacterDisplay('enemy', this.currentBattle.enemy);
        this.showBattleEffect(critical ? 'special' : 'attack', damage);

        if (this.currentBattle.enemy.health <= 0) {
            this.addBattleLogEntry('Enemy defeated!', 'battle-event');
            setTimeout(() => this.endBattle('victory'), 2000);
        } else {
            this.currentBattle.turn = 'enemy';
            setTimeout(() => this.enemyTurn(), 1200);
        }
    }

    showEquippedSkills() {
        const battleControls = document.querySelector('.battle-controls');
        if (!battleControls) return;
        
        // Remove any existing dynamic skill buttons
        const existingDynamicButtons = battleControls.querySelectorAll('.dynamic-skill-btn');
        existingDynamicButtons.forEach(btn => btn.remove());
        
        // Show equipped skills as buttons
        if (this.equippedSkills && this.equippedSkills.length > 0) {
            this.equippedSkills.forEach(skillName => {
                // Skip skills that already have hardcoded buttons
                if (['Slash', 'Power-up', 'Defend', 'Dodge', 'Special', 'Bonkler Beam'].includes(skillName)) {
                    return;
                }
                
                const skillButton = document.createElement('button');
                skillButton.className = 'battle-btn dynamic-skill-btn';
                skillButton.id = `${skillName.toLowerCase().replace(/\s+/g, '-')}-btn`;
                skillButton.innerHTML = `${this.symbolMarkup(this.getSkillSymbol(skillName))}<span>${this.escapeHTML(skillName)}</span><small>SKILL</small>`;

                // Add click event listener
                skillButton.addEventListener('click', () => {
                    const handlers = {
                        'Double Strike': () => this.performDoubleStrike(),
                        'Counter Attack': () => this.performCounterAttack(),
                        Heal: () => this.performHeal(),
                        'Critical Strike': () => this.performCriticalStrike()
                    };
                    handlers[skillName]?.();
                });
                
                battleControls.appendChild(skillButton);
            });
        }
    }

    enemyTurn() {
        if (!this.currentBattle) return;

        console.log('Enemy turn started');
        console.log('Current battle state:', this.currentBattle);
        
        const settings = this.getDifficultySettings();
        const actionRoll = Math.random();
        const action = actionRoll < settings.actions[0]
            ? 'attack'
            : actionRoll < settings.actions[0] + settings.actions[1] ? 'special' : 'defend';

        console.log('Enemy turn - Action:', action, 'Enemy attack:', this.currentBattle.enemy.attack);

        let damage = 0;
        if (action === 'attack') {
            damage = this.calculateCombatDamage(
                this.currentBattle.enemy.attack,
                this.currentBattle.player.defense,
                1
            );
            this.addBattleLogEntry(`Enemy attacks!`, 'enemy-action');
        } else if (action === 'special') {
            damage = this.calculateCombatDamage(
                this.currentBattle.enemy.attack,
                this.currentBattle.player.defense,
                1.35
            );
            this.addBattleLogEntry(`Enemy uses a special attack!`, 'enemy-action');
        }
        
        // Handle dodge mechanic
        if (this.battleState.dodgeActive && damage > 0) {
            const dodgeRoll = Math.random();
            if (dodgeRoll < this.battleState.dodgeSuccessRate) {
                this.addBattleLogEntry(`You successfully dodged the attack!`, 'dodge');
                this.showBattleEffect('dodge-success', 0);
                damage = 0;
            } else {
                this.addBattleLogEntry(`Dodge failed!`, 'dodge');
            }
            this.battleState.dodgeActive = false; // Reset dodge after use
        }
        
        // Apply defense bonus if active
        if (this.battleState.defendActive && damage > 0) {
            damage = Math.max(1, Math.round(damage * (1 - BATTLE_BALANCE.guardReduction)));
            this.battleState.defendActive = false;
            this.addBattleLogEntry(`Guard reduced the hit by ${Math.round(BATTLE_BALANCE.guardReduction * 100)}%!`, 'defend');
        }
        
        // Always show some effect for enemy actions
        if (action === 'defend') {
            // Enemy defends - no damage but show effect
            console.log('Enemy defends');
            this.battleState.enemyDefendActive = true;
            this.addBattleLogEntry(`Enemy guards against your next hit!`, 'enemy-action');
            this.showBattleEffect('enemy-defend', 0);
        } else if (damage > 0) {
            // Enemy attacks
            console.log('Enemy attacks for', damage, 'damage');
            console.log('Player health before damage:', this.currentBattle.player.health);
            this.currentBattle.player.health = Math.max(0, this.currentBattle.player.health - damage);
            console.log('Player health after damage:', this.currentBattle.player.health);
            this.addBattleLogEntry(`You take ${damage} damage!`, 'damage');
            
            // Animate enemy attack based on action type
            if (action === 'special') {
                this.animateSpecialAttack(this.currentBattle.enemy, this.currentBattle.player, false);
            } else {
                this.animateAttack(this.currentBattle.enemy, this.currentBattle.player, false);
            }
            
            this.updateCharacterDisplay('player', this.currentBattle.player);
            this.showBattleEffect('enemy-attack', damage);
        } else {
            console.log('Enemy action but no damage dealt');
        }

        if (this.battleState.counterActive && damage > 0 && this.currentBattle.player.health > 0) {
            this.battleState.counterActive = false;
            const counterDamage = this.applyEnemyGuard(this.calculateCombatDamage(
                this.currentBattle.player.attack,
                this.currentBattle.enemy.defense,
                0.85
            ));
            this.currentBattle.enemy.health = Math.max(0, this.currentBattle.enemy.health - counterDamage);
            this.addBattleLogEntry(`Counter attack returns ${counterDamage} damage!`, 'special');
            this.updateCharacterDisplay('enemy', this.currentBattle.enemy);
            this.animateAttack(this.currentBattle.player, this.currentBattle.enemy, true);
            if (this.currentBattle.enemy.health <= 0) {
                this.addBattleLogEntry('Enemy defeated by the counter!', 'battle-event');
                setTimeout(() => this.endBattle('victory'), 2000);
                return;
            }
        }

        // Check for player death
        console.log('Player health after enemy action:', this.currentBattle.player.health);
        console.log('Player maxHealth:', this.currentBattle.player.maxHealth);
        console.log('Player health type:', typeof this.currentBattle.player.health);
        console.log('Player maxHealth type:', typeof this.currentBattle.player.maxHealth);
        
        if (this.currentBattle.player.health <= 0) {
            // Player dies
            console.log('Player dies!');
            this.currentBattle.player.health = 0;
            this.updateCharacterDisplay('player', this.currentBattle.player);
            this.showBattleEffect('player-death', 0);
            setTimeout(() => this.endBattle('defeat'), 2000);
        } else {
            console.log('Switching back to player turn');
            this.currentBattle.turn = 'player';
            this.enableBattleControls();
        }
    }

    showBattleEffect(type, damage) {
        console.log(`Battle effect: ${type}, damage: ${damage}`);
        
        // Since character elements don't exist in the HTML, we'll just log the effects
        // In a full implementation, you'd want to add character elements to the HTML
        
        if (type === 'attack' || type === 'special') {
            console.log('Enemy takes damage - shake effect would be applied');
        } else if (type === 'enemy-attack') {
            console.log('Player takes damage - shake effect would be applied');
        } else if (type === 'enemy-death') {
            console.log('Enemy dies - death effect would be applied');
        } else if (type === 'player-death') {
            console.log('Player dies - death effect would be applied');
        } else if (type === 'enemy-defend') {
            console.log('Enemy defends');
        }
        
        // Show damage number on the battle canvas instead
        if (damage > 0) {
            console.log(`Damage dealt: ${damage}`);
            // In a full implementation, you'd draw the damage number on the canvas
        }
    }

    endBattle(result) {
        this.disableBattleControls();
        
        // Add battle end log entry
        if (result === 'victory') {
            this.addBattleLogEntry(`Victory! You defeated the enemy!`, 'battle-event');
        } else if (result === 'defeat') {
            this.addBattleLogEntry(`Defeat! You were defeated by the enemy!`, 'battle-event');
        } else {
            this.addBattleLogEntry(`Battle ended in a draw!`, 'battle-event');
        }
        
        // Hide battle arena and restore fighter selection.
        document.getElementById('battle-arena').style.display = 'none';
        document.querySelector('.nft-selection')?.classList.remove('battle-running');
        
        // Calculate rewards
        let expReward = 0;
        let coinReward = 0;
        
        const rewardMultiplier = this.getDifficultySettings().reward;
        if (result === 'victory') {
            expReward = Math.round((35 + this.currentBattle.enemy.level * 10) * rewardMultiplier);
            coinReward = Math.round((45 + this.currentBattle.enemy.level * 10) * rewardMultiplier);
            this.addExp(expReward);
            this.addCoins(coinReward);
            
            // Update player stats
            this.playerStats.wins++;
            this.playerStats.battlesWon++;
            this.playerStats.totalExp += expReward;
            if (this.level > this.playerStats.highestLevel) {
                this.playerStats.highestLevel = this.level;
            }
        } else if (result === 'defeat') {
            expReward = Math.round((10 + this.currentBattle.enemy.level * 2) * rewardMultiplier);
            coinReward = Math.round((8 + this.currentBattle.enemy.level * 2) * rewardMultiplier);
            this.addExp(expReward);
            this.addCoins(coinReward);
            
            // Update player stats
            this.playerStats.losses++;
            this.playerStats.battlesLost++;
            this.playerStats.totalExp += expReward;
        }
        
        // Persist demo and wallet progression before updating the global leaderboard.
        this.saveGameData();
        this.savePlayerStats();
        this.updateLeaderboard();
        
        // Show battle result
        this.showBattleResult(result, expReward, coinReward);
        
        this.currentBattle = null;
        this.setBattleSessionLayout(false);
    }

    showBattleResult(result, expReward, coinReward) {
        const modal = document.getElementById('battle-result-modal');
        const resultTitle = document.getElementById('result-title');
        const resultContent = document.getElementById('result-content');
        
        if (result === 'victory') {
            resultTitle.textContent = 'Victory!';
            resultContent.innerHTML = `
                <div class="result-icon victory">${this.symbolMarkup('victory')}</div>
                <div class="result-title">You Won!</div>
                <div class="rewards">
                    <div class="reward-item">
                        <span class="reward-label">Experience:</span>
                        <span class="reward-value">+${expReward}</span>
                    </div>
                    <div class="reward-item">
                        <span class="reward-label">Coins:</span>
                        <span class="reward-value">+${coinReward}</span>
                    </div>
                </div>
            `;
        } else if (result === 'defeat') {
            resultTitle.textContent = 'Defeat';
            resultContent.innerHTML = `
                <div class="result-icon defeat">${this.symbolMarkup('defeat')}</div>
                <div class="result-title">You Lost!</div>
                <div class="rewards">
                    <div class="reward-item">
                        <span class="reward-label">Experience:</span>
                        <span class="reward-value">+${expReward}</span>
                    </div>
                    <div class="reward-item">
                        <span class="reward-label">Recovery Coins:</span>
                        <span class="reward-value">+${coinReward}</span>
                    </div>
                </div>
            `;
        } else {
            resultTitle.textContent = 'Time Out';
            resultContent.innerHTML = `
                <div class="result-icon defeat">${this.symbolMarkup('time')}</div>
                <div class="result-title">Time's Up!</div>
                <div class="rewards">
                    <div class="reward-item">
                        <span class="reward-label">Experience:</span>
                        <span class="reward-value">+${expReward}</span>
                    </div>
                </div>
            `;
        }
        
        modal.classList.add('active');
        requestAnimationFrame(() => document.getElementById('result-modal-close')?.focus());
    }

    // Shop System
    getBalancedShopCost(item) {
        if (!item || item.cost === 0) return 0;

        const skillCosts = {
            Special: 450,
            'Bonkler Beam': 900,
            'Double Strike': 350,
            'Counter Attack': 450,
            Heal: 300,
            'Critical Strike': 650
        };
        if (item.type === 'skill') return skillCosts[item.name] ?? item.cost;

        const attack = Math.max(0, Number(item.attack) || 0);
        const defense = Math.max(0, Number(item.defense) || 0);
        const rawCost = {
            pilot: 150 + attack * 65,
            body: 100 + defense * 32,
            armor: 100 + defense * 36,
            hand: 120 + attack * 62,
            offhand: 90 + attack * 60 + defense * 38,
            accessory: 100 + attack * 60 + defense * 45,
            head: 120 + attack * 62
        }[item.type] ?? item.cost;

        return Math.max(100, Math.round(rawCost / 25) * 25);
    }

    prepareShopPreview(image) {
        if (!image || image.dataset.previewPrepared === 'true') return;

        const cropTransparentPadding = () => {
            try {
                const sampleWidth = 100;
                const sampleHeight = Math.max(1, Math.round((image.naturalHeight / image.naturalWidth) * sampleWidth));
                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d', { willReadFrequently: true });
                canvas.width = sampleWidth;
                canvas.height = sampleHeight;
                context.imageSmoothingEnabled = false;
                context.drawImage(image, 0, 0, sampleWidth, sampleHeight);

                const pixels = context.getImageData(0, 0, sampleWidth, sampleHeight).data;
                let minX = sampleWidth;
                let minY = sampleHeight;
                let maxX = -1;
                let maxY = -1;

                for (let y = 0; y < sampleHeight; y++) {
                    for (let x = 0; x < sampleWidth; x++) {
                        if (pixels[(y * sampleWidth + x) * 4 + 3] > 12) {
                            minX = Math.min(minX, x);
                            minY = Math.min(minY, y);
                            maxX = Math.max(maxX, x);
                            maxY = Math.max(maxY, y);
                        }
                    }
                }

                if (maxX < minX || maxY < minY) return;

                const contentWidth = maxX - minX + 1;
                const contentHeight = maxY - minY + 1;
                const contentCenterX = ((minX + maxX + 1) / 2 / sampleWidth) * 100;
                const contentCenterY = ((minY + maxY + 1) / 2 / sampleHeight) * 100;
                const previewFrame = image.closest('.item-icon');
                const frameAspect = previewFrame?.clientWidth > 0
                    ? previewFrame.clientHeight / previewFrame.clientWidth
                    : 1;
                const previewWidth = Math.min(
                    380,
                    Math.max(72, Math.min(
                        86 * sampleWidth / contentWidth,
                        86 * frameAspect * sampleWidth / contentHeight
                    ))
                );

                image.style.setProperty('--preview-width', `${previewWidth}%`);
                image.style.setProperty('--preview-shift-x', `${-contentCenterX}%`);
                image.style.setProperty('--preview-shift-y', `${-contentCenterY}%`);
                image.dataset.previewPrepared = 'true';
                image.classList.add('is-ready');
                image.closest('.item-icon')?.classList.add('has-preview');
            } catch (error) {
                console.warn('Unable to crop shop preview:', image.currentSrc, error);
                image.classList.add('is-ready');
                image.closest('.item-icon')?.classList.add('has-preview');
            }
        };

        if (image.complete && image.naturalWidth > 0) {
            cropTransparentPadding();
        } else {
            image.addEventListener('load', cropTransparentPadding, { once: true });
        }
    }

    populateShop(category = this.currentShopCategory || 'pilots') {
        this.currentShopCategory = category;
        const shopItems = document.getElementById('shop-items');
        shopItems.innerHTML = '';

        const shopData = {
            pilots: [
                { name: 'Alien Milady', type: 'pilot', attack: 6, cost: 600, asset: 'ALIEN-MILADY.png' },
                { name: 'Binky', type: 'pilot', attack: 4, cost: 400, asset: 'BINKY.png' },
                { name: 'Beauty Beast Bunny', type: 'pilot', attack: 7, cost: 700, asset: 'BEAUTY-BEAST-BUNNY.png' },
                { name: 'Black Frost', type: 'pilot', attack: 8, cost: 800, asset: 'BLACK-FROST.png' },
                { name: 'Bonk Bat', type: 'pilot', attack: 9, cost: 900, asset: 'BONK-BAT.png' },
                { name: 'Charlie\'s Dog', type: 'pilot', attack: 5, cost: 500, asset: 'CHARLIE\'S-DOG.png' },
                { name: 'Dancing Man Emoji', type: 'pilot', attack: 3, cost: 300, asset: 'DANCING-MAN-EMOJI.png' },
                { name: 'Dr Kawashima', type: 'pilot', attack: 6, cost: 600, asset: 'DR-KAWASHIMA.png' },
                { name: 'Guitar Bear', type: 'pilot', attack: 7, cost: 700, asset: 'GUITAR-BEAR.png' },
                { name: 'Hamtaro', type: 'pilot', attack: 5, cost: 500, asset: 'HAMTARO.png' },
                { name: 'Kasane Teto', type: 'pilot', attack: 8, cost: 800, asset: 'KASANE-TETO.png' },
                { name: 'Maple Story', type: 'pilot', attack: 10, cost: 1000, asset: 'MAPLE-STORY.png' },
                { name: 'Mew', type: 'pilot', attack: 9, cost: 900, asset: 'MEW.png' },
                { name: 'Milady', type: 'pilot', attack: 6, cost: 600, asset: 'MILADY.png' },
                { name: 'Minifig', type: 'pilot', attack: 4, cost: 400, asset: 'MINIFIG.png' },
                { name: 'Neko', type: 'pilot', attack: 5, cost: 500, asset: 'NEKO.png' },
                { name: 'Okshia Mikan', type: 'pilot', attack: 7, cost: 700, asset: 'OKSHIA-MIKAN-UWASA-FRUIT-JUICER.png' },
                { name: 'Pikmin', type: 'pilot', attack: 6, cost: 600, asset: 'PIKMIN.png' },
                { name: 'Rei', type: 'pilot', attack: 5, cost: 500, asset: 'REI.png' },
                { name: 'Rover', type: 'pilot', attack: 7, cost: 700, asset: 'ROVER.png' },
                { name: 'Shakoki Dogu', type: 'pilot', attack: 8, cost: 800, asset: 'SHAKOKI-DOGU.png' },
                { name: 'Snoopy Plush', type: 'pilot', attack: 4, cost: 400, asset: 'SNOOPY-PLUSH.png' },
                { name: 'Sprite Autograph', type: 'pilot', attack: 3, cost: 300, asset: 'SPRITE-AUTOGRAPH.png' },
                { name: 'Stuart', type: 'pilot', attack: 6, cost: 600, asset: 'STUART.png' },
                { name: 'Tivo', type: 'pilot', attack: 8, cost: 800, asset: 'TIVO.png' },
                { name: 'Wolfie', type: 'pilot', attack: 5, cost: 500, asset: 'WOLFIE.png' },
                { name: 'Zatsune Miku', type: 'pilot', attack: 9, cost: 900, asset: 'ZATSUNE-MIKU.png' }
            ],
            bodies: [
                { name: 'Another Freaking Machine', type: 'body', defense: 12, cost: 500, asset: 'ANOTHER-FREAKING-MACHINE.png' },
                { name: 'Beetle', type: 'body', defense: 8, cost: 300, asset: 'BEETLE.png' },
                { name: 'BRG Vol1', type: 'body', defense: 10, cost: 400, asset: 'BRG-VOL1.png' },
                { name: 'Burger Bonk Laser', type: 'body', defense: 15, cost: 600, asset: 'BURGER-BONK-LASER.png' },
                { name: 'Burner Phone', type: 'body', defense: 6, cost: 250, asset: 'BURNER-PHONE.png' },
                { name: 'Chinese Sprite', type: 'body', defense: 11, cost: 450, asset: 'CHINESE-SPRITE.png' },
                { name: 'Cosmic Ray Detectors', type: 'body', defense: 18, cost: 700, asset: 'COSMIC-RAY-DETECTORS.png' },
                { name: 'Dark Magician Girl', type: 'body', defense: 14, cost: 550, asset: 'DARK-MAGICIAN-GIRL.png' },
                { name: 'Fire Bonk Laser', type: 'body', defense: 16, cost: 650, asset: 'FIRE-BONKER-LASER.png' },
                { name: 'Fragile Hearts', type: 'body', defense: 9, cost: 350, asset: 'FRAGILE-HEARTS.png' },
                { name: 'Guam', type: 'body', defense: 7, cost: 280, asset: 'GUAM.png' },
                { name: 'Harajuku Motorola', type: 'body', defense: 8, cost: 320, asset: 'HARAJUKU-MOTOROLA.png' },
                { name: 'Jacob Jensen', type: 'body', defense: 9, cost: 360, asset: 'JACOB-JENSEN.png' },
                { name: 'Jade Cabbage', type: 'body', defense: 13, cost: 520, asset: 'JADE-CABBAGE.png' },
                { name: 'Judd Chair', type: 'body', defense: 5, cost: 200, asset: 'JUDD-CHAIR.png' },
                { name: 'Lego Skeleton', type: 'body', defense: 7, cost: 290, asset: 'LEGO-SKELETON.png' },
                { name: 'Noctua Heatsink', type: 'body', defense: 10, cost: 410, asset: 'NOCTUA-HEATSINK.png' },
                { name: 'Orion Can', type: 'body', defense: 17, cost: 680, asset: 'ORION-CAN.png' },
                { name: 'Pelican Terminal', type: 'body', defense: 15, cost: 580, asset: 'PELICAN-TERMINAL.png' },
                { name: 'Red and Blue Chair', type: 'body', defense: 6, cost: 240, asset: 'RED-AND-BLUE-CHAIR.png' },
                { name: 'Rei Lighter', type: 'body', defense: 8, cost: 330, asset: 'REI-LIGHTER.png' },
                { name: 'Rilakkuma', type: 'body', defense: 8, cost: 300, asset: 'RILAKKUMA.png' },
                { name: 'Rug Pull', type: 'body', defense: 19, cost: 750, asset: 'RUG-PULL.png' },
                { name: 'Rummikub', type: 'body', defense: 9, cost: 340, asset: 'RUMMIKUB.png' },
                { name: 'Sony CD Player', type: 'body', defense: 6, cost: 260, asset: 'SONY-CD-PLAYER.png' },
                { name: 'Sony Pocket Station', type: 'body', defense: 7, cost: 270, asset: 'SONY-POCKET-STATION.png' },
                { name: 'Sony Tablet', type: 'body', defense: 8, cost: 310, asset: 'SONY-TABLET.png' },
                { name: 'Sony TV', type: 'body', defense: 12, cost: 500, asset: 'SONY-TV.png' },
                { name: 'Suit', type: 'body', defense: 10, cost: 400, asset: 'SUIT.png' },
                { name: 'Tekken King', type: 'body', defense: 15, cost: 600, asset: 'TEKKEN-KING.png' },
                { name: 'Valet Chair', type: 'body', defense: 5, cost: 220, asset: 'VALET-CHAIR.png' },
                { name: 'Vending Machine', type: 'body', defense: 11, cost: 460, asset: 'VENDING-MACHINE.png' },
                { name: 'YMO Tour', type: 'body', defense: 14, cost: 560, asset: 'YMO-TOUR.png' }
            ],

            armors: [
                { name: 'Adamantine Armor', type: 'armor', defense: 25, cost: 1000, asset: 'ArmorAdamantine.png' },
                { name: 'Black Armor', type: 'armor', defense: 18, cost: 400, asset: 'ArmorBlack.png' },
                { name: 'Black Trim Armor', type: 'armor', defense: 20, cost: 500, asset: 'ArmorBlack-Trim.png' },
                { name: 'Bronze Armor', type: 'armor', defense: 12, cost: 300, asset: 'ArmorBronze.png' },
                { name: 'Bronze Trim Armor', type: 'armor', defense: 14, cost: 350, asset: 'ArmorBronze-Trim.png' },
                { name: 'Coal Armor', type: 'armor', defense: 10, cost: 250, asset: 'ArmorCoal.png' },
                { name: 'Comme Des Garcons Armor', type: 'armor', defense: 30, cost: 1200, asset: 'ArmorComme-Des-Garcons-Homme-Plus-FW18-Dover-Street-Market-Installation-Dinosaur-Bones.png' },
                { name: 'Dragon Armor', type: 'armor', defense: 28, cost: 1100, asset: 'ArmorDragon.png' },
                { name: 'Glory Armor', type: 'armor', defense: 35, cost: 1500, asset: 'ArmorGlory.png' },
                { name: 'Handycam Armor', type: 'armor', defense: 22, cost: 600, asset: 'ArmorHandycam.png' },
                { name: 'Harajuku Sticker Armor', type: 'armor', defense: 16, cost: 450, asset: 'ArmorHarajuku-Sticker.png' },
                { name: 'Jade Armor', type: 'armor', defense: 25, cost: 800, asset: 'ArmorJade.png' },
                { name: 'Mithril Armor', type: 'armor', defense: 26, cost: 900, asset: 'ArmorMithril.png' },
                { name: 'Mithril Trim Armor', type: 'armor', defense: 28, cost: 950, asset: 'ArmorMithril-Trim.png' },
                { name: 'Phantom Armor', type: 'armor', defense: 15, cost: 380, asset: 'ArmorPhantom.png' },
                { name: 'Steel Armor', type: 'armor', defense: 20, cost: 500, asset: 'ArmorSteel.png' },
                { name: 'Steel Trim Armor', type: 'armor', defense: 22, cost: 550, asset: 'ArmorSteel-Trim.png' },
                { name: 'Terminator Armor', type: 'armor', defense: 32, cost: 1300, asset: 'ArmorTerminator.png' },
                { name: 'Terminator Recolor Armor', type: 'armor', defense: 30, cost: 1250, asset: 'ArmorTerminator-Recolor.png' },
                { name: 'White Armor', type: 'armor', defense: 15, cost: 300, asset: 'ArmorWhite.png' },
                { name: 'White Trim Armor', type: 'armor', defense: 17, cost: 350, asset: 'ArmorWhite-Trim.png' }
            ],
            hands: [
                { name: 'Aghanim Scepter', type: 'hand', attack: 8, cost: 600, asset: 'AGHANIM-SCEPTER.png' },
                { name: 'American Flag', type: 'hand', attack: 3, cost: 200, asset: 'AMERICAN-FLAG.png' },
                { name: 'Ancient Godsword', type: 'hand', attack: 12, cost: 800, asset: 'ANCIENT-GODSWORD.png' },
                { name: 'Ape Escape Net', type: 'hand', attack: 6, cost: 400, asset: 'APE-ESCAPE-NET.png' },
                { name: 'Armed Threat', type: 'hand', attack: 7, cost: 500, asset: 'ARMED-THREAT.png' },
                { name: 'Atarashiki Mura', type: 'hand', attack: 5, cost: 350, asset: 'ATARASHIKI-MURA.png' },
                { name: 'Balloon', type: 'hand', attack: 2, cost: 150, asset: 'BALLOON.png' },
                { name: 'Bionicle Axe', type: 'hand', attack: 4, cost: 300, asset: 'BIONICLE-AXE.png' },
                { name: 'Blade of the Immortal', type: 'hand', attack: 9, cost: 650, asset: 'BLADE-OF-THE-IMMORTAL.png' },
                { name: 'Bludgeoning Angel', type: 'hand', attack: 6, cost: 420, asset: 'BLUDGEONING-ANGEL.png' },
                { name: 'Boom Mic', type: 'hand', attack: 3, cost: 220, asset: 'BOOM-MIC.png' },
                { name: 'Cattle Gun', type: 'hand', attack: 8, cost: 580, asset: 'CATTLE-GUN.png' },
                { name: 'Dreamcast Fishing Controller', type: 'hand', attack: 4, cost: 280, asset: 'DREAMCAST-FISHING-CONTROLLER.png' },
                { name: 'Energy Sword', type: 'hand', attack: 7, cost: 480, asset: 'ENERGY-SWORD.png' },
                { name: 'Evolved Antenna', type: 'hand', attack: 5, cost: 320, asset: 'EVOLVED-ANTENNA.png' },
                { name: 'Golden Axe', type: 'hand', attack: 6, cost: 400, asset: 'GOLDEN-AXE.png' },
                { name: 'Ikebana', type: 'hand', attack: 10, cost: 700, asset: 'IKEBANA.png' },
                { name: 'Insanity Catalyst', type: 'hand', attack: 5, cost: 340, asset: 'INSANITY-CATALYST.png' },
                { name: 'Jordan', type: 'hand', attack: 8, cost: 550, asset: 'JORDAN.png' },
                { name: 'K\'NEX', type: 'hand', attack: 6, cost: 420, asset: 'K\'NEX.png' },
                { name: 'Newjeans Hammer', type: 'hand', attack: 11, cost: 750, asset: 'NEWJEANS-HAMMER.png' },
                { name: 'Phone Flail', type: 'hand', attack: 7, cost: 480, asset: 'PHONE-FLAIL.png' },
                { name: 'Porsche Suspension', type: 'hand', attack: 6, cost: 400, asset: 'PORSCHE-SUSPENSION.png' },
                { name: 'Ribbon Staff', type: 'hand', attack: 8, cost: 520, asset: 'RIBBON-STAFF.png' },
                { name: 'Sir Fetch\'d', type: 'hand', attack: 5, cost: 320, asset: 'SIR-FETCH\'D.png' },
                { name: 'Skylander Sword', type: 'hand', attack: 7, cost: 450, asset: 'SKYLANDER-SWORD.png' },
                { name: 'Sly Cooper Cane', type: 'hand', attack: 4, cost: 280, asset: 'SLY-COOPER-CANE.png' },
                { name: 'Stygian Reaver', type: 'hand', attack: 12, cost: 850, asset: 'STYGIAN-REAVER.png' },
                { name: 'Velvet Crowe', type: 'hand', attack: 13, cost: 900, asset: 'VELVET-CROWE.png' },
                { name: 'Water Pistol', type: 'hand', attack: 3, cost: 200, asset: 'WATER-PISTOL.png' },
                { name: 'Winged Staff Gold', type: 'hand', attack: 9, cost: 650, asset: 'WINGED-STAFF-GOLD.png' }
            ],
                         offhands: [
                 { name: 'Yen', type: 'offhand', attack: 2, cost: 150, asset: 'YEN-store.png' },
                 { name: 'VAX Pass', type: 'offhand', attack: 3, cost: 200, asset: 'VAX-PASS-store.png' },
                 { name: 'Tornado', type: 'offhand', attack: 8, cost: 600, asset: 'TORNADO-2-store.png' },
                 { name: 'Tokyo Manhole Cover', type: 'offhand', defense: 10, cost: 800, asset: 'TOKYO-MANHOLE-COVER-store.png' },
                 { name: 'Teddy Bear Anniversary', type: 'offhand', defense: 5, cost: 200, asset: 'TEDDY-BEAR-ANNIVERSARY-store.png' },
                 { name: 'Super Lover Watch', type: 'offhand', attack: 4, cost: 300, asset: 'SUPER-LOVER-WATCH-store.png' },
                 { name: 'Submarine Cable', type: 'offhand', defense: 7, cost: 500, asset: 'SUBMARINE-CABLE-store.png' },
                 { name: 'Shooting Star', type: 'offhand', attack: 6, cost: 400, asset: 'SHOOTING-STAR-store.png' },
                 { name: 'RX-78', type: 'offhand', attack: 5, cost: 350, asset: 'RX-78-store.png' },
                 { name: 'Remilia Films', type: 'offhand', attack: 3, cost: 250, asset: 'REMILIA-FILMS-store.png' },
                 { name: 'Remilia Engineering', type: 'offhand', defense: 6, cost: 450, asset: 'REMILIA-ENGINEERING-store.png' },
                 { name: 'Remilia Crest', type: 'offhand', defense: 4, cost: 300, asset: 'REMILIA-CREST-store.png' },
                 { name: 'Quad Damage', type: 'offhand', attack: 9, cost: 700, asset: 'QUAD-DAMAGE-store.png' },
                 { name: 'Rayman Shield', type: 'offhand', defense: 8, cost: 600, asset: 'RAYMAN-M-STEAL-SHIELD-store.png' },
                 { name: 'Pokewalker', type: 'offhand', attack: 2, cost: 150, asset: 'POKEWALKER-store.png' },
                 { name: 'Pocket Pet', type: 'offhand', attack: 1, cost: 100, asset: 'POCKET-PET-store.png' },
                 { name: 'Palette', type: 'offhand', attack: 3, cost: 200, asset: 'PALETTE-store.png' },
                 { name: 'Nautilus', type: 'offhand', defense: 5, cost: 350, asset: 'NAUTILUS-store.png' },
                 { name: 'Ketamine', type: 'offhand', attack: 7, cost: 550, asset: 'KETAMINE-store.png' },
                 { name: 'Hauchiwa', type: 'offhand', defense: 9, cost: 750, asset: 'HAUCHIWA-store.png' },
                 { name: 'Hand Clock', type: 'offhand', defense: 2, cost: 120, asset: 'HAND-CLOCK-store.png' },
                 { name: 'Gutenberg Bible', type: 'offhand', defense: 6, cost: 400, asset: 'GUTENBERG-BIBLE-store.png' },
                 { name: 'Game & Watch', type: 'offhand', attack: 4, cost: 280, asset: 'GAME-AND-WATCH-store.png' },
                 { name: 'Foobar', type: 'offhand', attack: 3, cost: 220, asset: 'FOOBAR-store.png' },
                 { name: 'G-Shock', type: 'offhand', defense: 3, cost: 100, asset: 'G-SHOCK-store.png' },
                 { name: 'FBI Badge', type: 'offhand', defense: 7, cost: 500, asset: 'FBI-BADGE-store.png' },
                 { name: 'Final Fantasy', type: 'offhand', attack: 8, cost: 650, asset: 'FINAL-FANTASY-store.png' },
                 { name: 'Daihatsu Midget', type: 'offhand', defense: 4, cost: 320, asset: 'DAIHATSU-MIDGET-store.png' },
                 { name: 'Dwarf Fortress Blueprint', type: 'offhand', defense: 3, cost: 180, asset: 'DWARF-FORTRESS-GREEK-BEDROOM-BLUEPRINT-store.png' },
                 { name: 'Carlo Bugatti Chair', type: 'offhand', defense: 5, cost: 380, asset: 'CARLO-BUGATTI-CHAIR-store.png' },
                 { name: 'Clover', type: 'offhand', attack: 2, cost: 160, asset: 'CLOVER-store.png' },
                 { name: 'Cookie', type: 'offhand', attack: 1, cost: 80, asset: 'COOKIE-store.png' },
                 { name: 'Beetle Game', type: 'offhand', attack: 5, cost: 360, asset: 'BEETLE-GAME-store.png' },
                 { name: 'Beyblade', type: 'offhand', attack: 6, cost: 420, asset: 'BEYBLADE-store.png' },
                 { name: 'Briefcase', type: 'offhand', defense: 2, cost: 110, asset: 'BREIFCASE-store.png' },
                 { name: 'Adventure of Cookie and Cream', type: 'offhand', attack: 4, cost: 290, asset: 'ADVENTURE-OF-COOKIE-AND-CREAM-store.png' },
                 { name: 'Amex Platinum', type: 'offhand', defense: 8, cost: 600, asset: 'AMEX-PLATINUM-store.png' },
                 { name: 'Beat Happening', type: 'offhand', attack: 3, cost: 240, asset: 'BEAT-HAPPENING-store.png' },
                 { name: '48 Laws of Power', type: 'offhand', defense: 6, cost: 450, asset: '48-LAWS-OF-POWER-store.png' }
             ],
            heads: [
                { name: 'Bonk', type: 'head', attack: 5, cost: 300, asset: 'BONK.png' },
                { name: 'Evil Bonk', type: 'head', attack: 7, cost: 500, asset: 'EVIL-BONK.png' },
                { name: 'Alien Bonk', type: 'head', attack: 8, cost: 600, asset: 'ALIEN-BONK.png' },
                { name: 'Spirit', type: 'head', attack: 6, cost: 400, asset: 'SPIRIT.png' },
                { name: 'White', type: 'head', attack: 4, cost: 250, asset: 'WHITE.png' }
            ],
            accessories: [
                { name: 'Raver Cap', type: 'accessory', attack: 3, cost: 250, asset: 'RAVER-CAP.png' },
                { name: 'Halo', type: 'accessory', defense: 5, cost: 400, asset: 'HALO.png' },
                { name: 'Droid', type: 'accessory', attack: 4, cost: 350, asset: 'DROID.png' },
                { name: 'BK', type: 'accessory', attack: 2, cost: 150, asset: 'BK.png' },
                { name: 'Hikkikomori', type: 'accessory', defense: 3, cost: 200, asset: 'HIKKIKOMORI.png' }
            ],
            skills: [
                { name: 'Slash', type: 'skill', cost: 0, description: 'Basic light attack', unlocked: true },
                { name: 'Power-up', type: 'skill', cost: 0, description: 'Add a permanent +15% attack stack', unlocked: true },
                { name: 'Defend', type: 'skill', cost: 0, description: 'Reduce the next damaging hit by 55%', unlocked: true },
                { name: 'Dodge', type: 'skill', cost: 0, description: '60% chance to dodge the next attack', unlocked: true },
                { name: 'Special', type: 'skill', cost: 500, description: 'Heavy attack (requires 3 power-ups)', unlocked: false },
                { name: 'Bonkler Beam', type: 'skill', cost: 1000, description: 'Devastating beam attack (65% hit rate)', unlocked: false },
                { name: 'Double Strike', type: 'skill', cost: 300, description: 'Two 0.72x defense-aware hits', unlocked: false },
                { name: 'Counter Attack', type: 'skill', cost: 400, description: 'Return an 0.85x strike after the next hit', unlocked: false },
                { name: 'Heal', type: 'skill', cost: 200, description: 'Restore 28% health once per battle', unlocked: false },
                { name: 'Critical Strike', type: 'skill', cost: 600, description: '60% chance for a 1.9x critical strike', unlocked: false }
            ]
        };

        const items = (shopData[category] || []).map((item) => ({
            ...item,
            cost: this.getBalancedShopCost(item)
        }));

        items.forEach(item => {
            const shopItem = document.createElement('div');
            shopItem.className = 'shop-item';
            
            let description = '';
            if (item.type === 'pilot') {
                description = `Pilot component with +${item.attack} attack`;
            } else if (item.type === 'body') {
                description = `Body component with +${item.defense} defense`;
            } else if (item.type === 'armor') {
                description = `Armor component with +${item.defense} defense`;
            } else if (item.type === 'hand') {
                description = `Hand component with +${item.attack} attack`;
            } else if (item.type === 'offhand') {
                description = `Offhand component with +${item.attack || item.defense} ${item.attack ? 'attack' : 'defense'}`;
            } else if (item.type === 'accessory') {
                description = `Accessory component with +${item.attack || item.defense} ${item.attack ? 'attack' : 'defense'}`;
            } else if (item.type === 'potion') {
                description = `Temporary boost to your fighter`;
            } else if (item.type === 'skill') {
                description = item.description;
            }
            
            shopItem.innerHTML = `
                <div class="item-icon">
                    ${item.asset ? `<span class="item-fallback" aria-hidden="true">${this.symbolMarkup(this.getItemSymbol(item))}</span><img class="shop-preview-image" src="${item.type === 'offhand' ? 'OFFHAND store' : item.type === 'accessory' ? 'store accessories' : item.type === 'pilot' ? 'store pilot' : item.type === 'body' ? 'BODIES' : item.type === 'armor' ? 'ARMORS' : item.type === 'hand' ? 'store hands' : item.type.toUpperCase()}/${item.asset}" alt="${item.name}" width="1000" height="1528" loading="lazy" decoding="async">` : this.symbolMarkup(this.getItemSymbol(item), 'skill-symbol')}
                </div>
                <div class="item-name">${item.name}</div>
                <div class="item-description">${description}</div>
                <div class="item-price">${item.cost} coins</div>
                <button class="buy-btn" data-item='${JSON.stringify(item)}'>
                    Buy (${item.cost} coins)
                </button>
            `;

            const buyBtn = shopItem.querySelector('.buy-btn');
            buyBtn.addEventListener('click', () => this.purchaseItem(item));
            
            if (this.coins < item.cost) {
                buyBtn.disabled = true;
                buyBtn.textContent = 'Not enough coins';
            }
            
            shopItems.appendChild(shopItem);

            const shopPreview = shopItem.querySelector('.shop-preview-image');
            if (shopPreview) this.prepareShopPreview(shopPreview);
        });
    }

    purchaseItem(item) {
        if (this.coins < item.cost) {
            this.showModal('Insufficient Coins', 'You need more coins to purchase this item!');
            return;
        }

        this.coins -= item.cost;
        
        // Handle different item types
        if (['pilot', 'body', 'head', 'armor', 'offhand', 'accessory', 'hand'].includes(item.type)) {
            // Add component to available assets for future use
            if (!this.componentAssets) {
                this.componentAssets = {};
            }
            const assetKey = this.normalizeComponentType(item.type);
            if (!this.componentAssets[assetKey]) {
                this.componentAssets[assetKey] = [];
            }
            
            // Create component asset - convert store asset name to regular asset name
            let regularAssetName = item.asset;
            if (item.asset.includes('-store.png')) {
                regularAssetName = item.asset.replace('-store.png', '.png');
            }
            
            // Determine the correct folder path for purchased items (use regular folders, not store folders)
            let folderPath;
            if (item.type === 'hand') {
                folderPath = 'HANDS';
            } else if (item.type === 'armor') {
                folderPath = 'ARMORS';
            } else if (item.type === 'body') {
                folderPath = 'BODIES';
            } else if (item.type === 'pilot') {
                folderPath = 'PILOT';
            } else if (item.type === 'head') {
                folderPath = 'HEADS';
            } else if (item.type === 'offhand') {
                folderPath = 'OFFHAND';
            } else if (item.type === 'accessory') {
                folderPath = 'ACCESSORIES';
            } else {
                folderPath = item.type.toUpperCase();
            }
            
            console.log('Creating purchased item with path:', `${folderPath}/${regularAssetName}`);
            
            const componentAsset = {
                name: item.name,
                asset: regularAssetName,
                path: `${folderPath}/${regularAssetName}`,
                type: this.normalizeComponentType(item.type),
                attack: item.attack || 0,
                defense: item.defense || 0,
                cost: item.cost
            };
            
            this.componentAssets[assetKey].push(componentAsset);
            
            // Add to purchased items inventory
            const purchasedItem = {
                ...componentAsset,
                id: Date.now() + Math.random(), // Unique ID
                purchasedAt: new Date().toISOString()
            };
            
            this.purchasedItems.push(purchasedItem);
            
            this.showModal('Component Unlocked', `You unlocked ${item.name}! You can now use this component in the fighter builder.`);
        } else if (item.type === 'skill') {
            // Add skill to available skills
            if (!this.availableSkills) {
                this.availableSkills = [];
            }
            this.availableSkills.push(item.name);
            
            this.showModal('Skill Purchased', `${item.name} has been added to your available skills!`);
        } else if (item.type === 'potion') {
            // Apply potion effect to current fighter
            if (this.selectedNFT) {
                if (item.health) {
                    this.selectedNFT.health = Math.min(this.selectedNFT.maxHealth, this.selectedNFT.health + item.health);
                }
                if (item.attack) {
                    this.selectedNFT.attack += item.attack;
                }
                if (item.defense) {
                    this.selectedNFT.defense += item.defense;
                }
                this.populateNFTs();
                this.showModal('Potion Applied', `${item.name} effect applied to your fighter!`);
            } else {
                this.showModal('No Fighter Selected', 'Please select a fighter to apply the potion to.');
            }
        }
        
        this.updateUI();
        this.saveGameData();
        this.populateShop(this.currentShopCategory);
        this.populateInventory();
        
        // Refresh purchased items in builder if it's currently visible
        if (document.querySelector('.fighter-builder-container').style.display !== 'none') {
            this.populatePurchasedItems();
        }
    }

    // Inventory System
    populateInventory() {
        this.populateInventoryNFTs();
        this.populateInventorySkills();
    }

    populateInventoryNFTs() {
        const carouselTrack = document.getElementById('nft-carousel-track');
        const indicators = document.getElementById('nft-carousel-indicators');
        if (!carouselTrack) return;
        
        carouselTrack.innerHTML = '';
        if (indicators) indicators.innerHTML = '';
        
        if (!this.userNFTs || this.userNFTs.length === 0) {
            carouselTrack.innerHTML = '<div class="inventory-empty">No NFTs found. Connect your wallet to load your NFTs.</div>';
            return;
        }
        
        // Keep fighter cards usable instead of squeezing five across every viewport.
        const itemsPerPage = window.innerWidth < 560 ? 1 : window.innerWidth < 900 ? 2 : 4;
        const totalPages = Math.ceil(this.userNFTs.length / itemsPerPage);
        
        // Create carousel pages
        for (let page = 0; page < totalPages; page++) {
            const pageContainer = document.createElement('div');
            pageContainer.className = 'carousel-page';
            pageContainer.style.display = 'flex';
            
            // Add NFTs for this page
            for (let i = 0; i < itemsPerPage; i++) {
                const nftIndex = page * itemsPerPage + i;
                if (nftIndex >= this.userNFTs.length) break;
                
                const nft = this.userNFTs[nftIndex];
                const nftCard = document.createElement('button');
                nftCard.type = 'button';
                nftCard.className = 'nft-card';
                nftCard.dataset.nftId = nft.id;

                
                // Add NFT indicator if it's an NFT
                const nftBadge = nft.isNFT ? '<div class="nft-badge">NFT</div>' : '';
                const safeName = this.escapeHTML(nft.name);
                const safeDescription = this.escapeHTML(nft.description || '');
                const safeTokenId = this.escapeHTML(nft.tokenId || '');
                
                // Create canvas for NFT preview
                const canvas = document.createElement('canvas');
                canvas.className = 'fighter-preview';
                canvas.width = 120;
                canvas.height = 180;
                
                nftCard.innerHTML = `
                    <div class="nft-avatar custom-fighter">
                        ${canvas.outerHTML}
                        ${nftBadge}
                    </div>
                    <div class="nft-name">${safeName}</div>
                    <div class="nft-description">${safeDescription}</div>
                    <div class="nft-stats">
                        <div>Level: ${nft.level}</div>
                        <div>Attack: ${nft.attack}</div>
                        <div>Defense: ${nft.defense}</div>
                        <div>Health: ${nft.health}/${nft.maxHealth}</div>
                        ${nft.tokenId ? `<div>Token ID: ${safeTokenId}</div>` : ''}
                    </div>
                `;
                
                // Render NFT preview
                const previewCanvas = nftCard.querySelector('.fighter-preview');
                const previewCtx = previewCanvas.getContext('2d');
                this.renderFighterPreview(previewCtx, nft.components || {});
                
                nftCard.addEventListener('click', () => {
                // Remove previous selection
                    document.querySelectorAll('.nft-card.selected').forEach(card => {
                        card.classList.remove('selected');
                    });
                    nftCard.classList.add('selected');
                    
                    // Select NFT for builder
                    this.selectNFTForBuilder(nft);
                    
                    // Show builder interface
                    this.showBuilderInInventory();
                });
                
                pageContainer.appendChild(nftCard);
            }
            
            carouselTrack.appendChild(pageContainer);
        }
        
        // Create indicators
        if (indicators && totalPages > 1) {
            for (let i = 0; i < totalPages; i++) {
                const indicator = document.createElement('button');
                indicator.type = 'button';
                indicator.className = 'carousel-indicator';
                indicator.setAttribute('aria-label', `Show fighter page ${i + 1}`);
                if (i === 0) indicator.classList.add('active');
                indicator.dataset.page = i;
                
                indicator.addEventListener('click', () => {
                    this.goToCarouselPage(i);
                });
                
                indicators.appendChild(indicator);
            }
        }
        
        // Set up carousel navigation
        this.setupCarouselNavigation();
        
        // Initialize carousel state
        this.currentCarouselPage = 0;
        this.totalCarouselPages = totalPages;
        
        // Set up back button
        const backBtn = document.getElementById('back-to-nfts-btn');
        if (backBtn) {
            backBtn.onclick = () => this.showCarouselView();
        }
    }

    renderNFTPreviewOnCanvas(canvas, nft) {
        const ctx = canvas.getContext('2d');
        if (!ctx || !nft || !nft.components) return;

        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Render layers in order: body → armor → hands → offhand → head → pilot → accessories
        const layerOrder = ['body', 'armor', 'hands', 'offhand', 'head', 'pilot', 'accessory'];
        const scale = 0.15; // Smaller scale for inventory preview
        
        layerOrder.forEach(layer => {
            const component = nft.components[layer];
            if (component && component.image && component.image.complete && component.image.naturalWidth > 0) {
                const scaledWidth = component.image.width * scale;
                const scaledHeight = component.image.height * scale;
                const drawX = (canvas.width - scaledWidth) / 2;
                const drawY = (canvas.height - scaledHeight) / 2;
                
                ctx.drawImage(component.image, drawX, drawY, scaledWidth, scaledHeight);
            } else if (component && component.name) {
                // Draw a placeholder for components without images
                this.drawComponentPlaceholder(ctx, component.name, canvas.width, canvas.height, scale);
            }
        });
    }

    setupCarouselNavigation() {
        const prevBtn = document.getElementById('nft-prev-btn');
        const nextBtn = document.getElementById('nft-next-btn');
        
        if (prevBtn) {
            prevBtn.onclick = () => this.goToCarouselPage(this.currentCarouselPage - 1);
        }
        
        if (nextBtn) {
            nextBtn.onclick = () => this.goToCarouselPage(this.currentCarouselPage + 1);
        }
    }
    
    goToCarouselPage(page) {
        if (page < 0 || page >= this.totalCarouselPages) return;
        
        this.currentCarouselPage = page;
        const track = document.getElementById('nft-carousel-track');
        const indicators = document.querySelectorAll('.carousel-indicator');
        
        if (track) {
            track.style.transform = `translateX(-${page * 100}%)`;
        }
        
        // Update indicators
        indicators.forEach((indicator, index) => {
            indicator.classList.toggle('active', index === page);
        });
        
        // Update navigation buttons
        const prevBtn = document.getElementById('nft-prev-btn');
        const nextBtn = document.getElementById('nft-next-btn');
        
        if (prevBtn) prevBtn.disabled = page === 0;
        if (nextBtn) nextBtn.disabled = page === this.totalCarouselPages - 1;
    }

    renderFighterPreviewForInventory(ctx, components) {
        if (!ctx) return;
        
        // Clear canvas
        ctx.clearRect(0, 0, 60, 60);
        
        // Render layers in order: body → armor → hands → offhand → head → pilot → accessories (last drawn = top layer)
        const layerOrder = ['body', 'armor', 'hands', 'offhand', 'head', 'pilot', 'accessory'];
        
        let hasValidComponents = false;
        
        layerOrder.forEach(layer => {
            const component = components[layer];
            if (component && component.image && component.image.complete && component.image.naturalWidth > 0) {
                // Scale and center the image for inventory preview (make smaller)
                const scale = Math.min(60 / component.image.width, 60 / component.image.height) * 0.8; // 80% of available space
                const scaledWidth = component.image.width * scale;
                const scaledHeight = component.image.height * scale;
                const x = (60 - scaledWidth) / 2;
                const y = (60 - scaledHeight) / 2;
                
                ctx.drawImage(component.image, x, y, scaledWidth, scaledHeight);
                hasValidComponents = true;
            }
        });
        
        // If no valid components found, draw a placeholder
        if (!hasValidComponents) {
            this.drawInventoryPlaceholder(ctx);
        }
    }

    drawInventoryPlaceholder(ctx) {
        // Draw a simple placeholder character for inventory
        ctx.fillStyle = '#cccccc';
        ctx.fillRect(20, 30, 20, 30); // Body
        
        ctx.fillStyle = '#999999';
        ctx.fillRect(22, 20, 16, 12); // Head
        
        ctx.fillStyle = '#666666';
        ctx.fillRect(18, 35, 5, 10); // Left arm
        ctx.fillRect(37, 35, 5, 10); // Right arm
        
        // Add some basic features
        ctx.fillStyle = '#000000';
        ctx.fillRect(25, 25, 2, 2); // Left eye
        ctx.fillRect(33, 25, 2, 2); // Right eye
        ctx.fillRect(29, 30, 2, 1); // Mouth
    }

    populatePurchasedItems() {
        console.log('populatePurchasedItems called');
        console.log('purchasedItems:', this.purchasedItems);
        console.log('purchasedItems length:', this.purchasedItems.length);
        
        const categories = ['bodies', 'armors', 'hands', 'offhands', 'heads', 'pilots', 'accessories'];
        
        categories.forEach(category => {
            const gridId = `purchased-${category}-grid`;
            const grid = document.getElementById(gridId);
            if (!grid) return;
            
            grid.innerHTML = '';
            
            // Normalize legacy plural item types before matching each UI category.
            const categoryType = this.normalizeComponentType(category);
            const categoryItems = this.purchasedItems.filter((item) =>
                this.normalizeComponentType(item.type) === categoryType
            );
            
            console.log(`Category ${category}:`, categoryItems);
            console.log(`Category ${category} items count:`, categoryItems.length);
            
            if (categoryItems.length === 0) {
                grid.innerHTML = '<div class="purchased-item empty">No items purchased</div>';
                return;
            }
            
            categoryItems.forEach(item => {
                const itemElement = document.createElement('div');
                itemElement.className = 'purchased-item';
                itemElement.dataset.itemId = item.name;
                
                // Get image path - use item.path which contains the correct path
                let imagePath = item.path || '';
                
                // Fallback to constructing path if item.path is not available
                if (!imagePath && item.asset) {
                    if (item.type === 'body') {
                        imagePath = `BODIES/${item.asset}`;
                    } else if (item.type === 'armor') {
                        imagePath = `ARMORS/${item.asset}`;
                    } else if (item.type === 'hand') {
                        imagePath = `HANDS/${item.asset}`;
                    } else if (item.type === 'offhand') {
                        imagePath = `OFFHAND store/${item.asset}`;
                    } else if (item.type === 'head') {
                        imagePath = `HEADS/${item.asset}`;
                    } else if (item.type === 'pilot') {
                        imagePath = `PILOT/${item.asset}`;
                    } else if (item.type === 'accessory') {
                        imagePath = `ACCESSORIES/${item.asset}`;
                    }
                }
                
                // Check if this item is currently equipped
                const itemCategory = this.normalizeComponentType(item.type);
                const isCurrentlyEquipped = this.builderComponents[itemCategory] && 
                    this.builderComponents[itemCategory].name === item.name;
                
                const buttonText = isCurrentlyEquipped ? 'Unequip' : 'Equip';
                const buttonDisabled = '';
                itemElement.innerHTML = `
                    <img src="${imagePath}" alt="${item.name}" loading="lazy" decoding="async">
                    <div class="purchased-item-name">${item.name}</div>
                    <button class="equip-btn" data-category="${item.type}" data-item="${item.name}" ${buttonDisabled}>${buttonText}</button>
                `;
                
                // Add click handler for equip button
                const equipBtn = itemElement.querySelector('.equip-btn');
                equipBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    
                    // Check current state dynamically
                    const currentItemCategory = this.normalizeComponentType(item.type);
                    const isCurrentlyEquipped = this.builderComponents[currentItemCategory] && 
                        this.builderComponents[currentItemCategory].name === item.name;
                    
                    if (isCurrentlyEquipped) {
                        // Unequip the item
                        this.unequipItem(item);
                    } else {
                        // Equip the item
                        this.equipItem(item);
                    }
                });
                
                grid.appendChild(itemElement);
            });
        });
    }

    equipItem(item) {
        if (!this.selectedNFT) {
            this.showModal('No NFT Selected', 'Please select an NFT first before equipping items. Go to the Battle screen and select an NFT.');
            return;
        }
        
        // Update the builder components
        const category = this.normalizeComponentType(item.type);
        
        // Check if there's already an item equipped in this category
        const currentlyEquipped = this.builderComponents[category];
        if (currentlyEquipped) {
            // Unequip the current item by resetting its button
            this.updateEquipButtonState(currentlyEquipped.name, false);
        }
        
        // Create a new image and load it properly
        const image = new Image();
        image.crossOrigin = 'anonymous'; // Handle CORS if needed
        
        image.onload = () => {
            
            // Store the component with the canonical, non-store asset path.
            const componentPath = this.getComponentImagePath(item);

            this.builderComponents[category] = {
                name: item.name,
                path: componentPath,
                image: image,
                attack: item.attack || 0,
                defense: item.defense || 0
            };
            
            // Immediately save the equipped component to the selected NFT
            if (this.selectedNFT) {
                if (!this.selectedNFT.components) {
                    this.selectedNFT.components = {};
                }
                this.selectedNFT.components[category] = {
                    name: item.name,
                    path: componentPath,
                    image: image,
                    attack: item.attack || 0,
                    defense: item.defense || 0
                };
                
                // Update the NFT in the userNFTs array
                const nftIndex = this.userNFTs.findIndex(nft => nft.id === this.selectedNFT.id);
                if (nftIndex !== -1) {
                    this.userNFTs[nftIndex] = { ...this.selectedNFT };
                }
                
                // Save to localStorage immediately
                this.saveGameData();
                
            }
            
            // Re-render the NFT with the new component
            this.renderNFTAsBase(this.selectedNFT);
            
            // Update the button text to show it's equipped
            this.updateEquipButtonState(item.name, true);
        };
        
        image.onerror = (error) => {
            console.error(`Failed to load image for ${item.name}:`, error);
            
            // Still store the component without an image so it can be retried later.
            const componentPath = this.getComponentImagePath(item);

            this.builderComponents[category] = {
                name: item.name,
                path: componentPath,
                image: null,
                attack: item.attack || 0,
                defense: item.defense || 0
            };
            
            // Re-render anyway (will show placeholder)
            this.renderNFTAsBase(this.selectedNFT);
            
            // Update the button text
            this.updateEquipButtonState(item.name, true);
        };
        
        // Start loading the canonical image.
        const imageSrc = this.getComponentImagePath(item);
        image.src = imageSrc;
        
        console.log('Starting image load for:', imageSrc);
    }
    
    updateEquipButtonState(itemName, isEquipped) {
        // Find all buttons for this item (there might be multiple instances)
        const equipBtns = document.querySelectorAll(`[data-item="${itemName}"]`);
        
        equipBtns.forEach(btn => {
            if (isEquipped) {
                btn.textContent = 'Unequip';
                btn.disabled = false;
                btn.classList.add('equipped');
            } else {
                btn.textContent = 'Equip';
                btn.disabled = false;
                btn.classList.remove('equipped');
            }
        });
    }
    
    unequipItem(item) {
        if (!this.selectedNFT) {
            this.showModal('No NFT Selected', 'Please select an NFT first before unequipping items.');
            return;
        }
        
        const category = this.normalizeComponentType(item.type);
        console.log(`Unequipping ${item.name} from category ${category}`);
        
        // Remove the component from builder components
        if (this.builderComponents[category]) {
            console.log(`Removing ${item.name} from builderComponents[${category}]`);
            delete this.builderComponents[category];
        }
        
        // Remove the component from the selected NFT
        if (this.selectedNFT && this.selectedNFT.components && this.selectedNFT.components[category]) {
            delete this.selectedNFT.components[category];
        }
        
        // Update the NFT in the userNFTs array
        const nftIndex = this.userNFTs.findIndex(nft => nft.id === this.selectedNFT.id);
        if (nftIndex !== -1) {
            this.userNFTs[nftIndex] = { ...this.selectedNFT };
        }
        
        // Save to localStorage immediately
        this.saveGameData();
        
        // Re-render the NFT without the component
        this.renderNFTAsBase(this.selectedNFT);
        
        // Update the button state
        this.updateEquipButtonState(item.name, false);
        console.log(`Unequip complete for ${item.name}`);
    }
    
    showCarouselView() {
        // Show carousel section and hide builder
        const carouselSection = document.querySelector('.nft-carousel-section');
        const builderContainer = document.querySelector('.fighter-builder-container');
        
        if (carouselSection) {
            carouselSection.style.display = 'block';
        }
        
        if (builderContainer) {
            builderContainer.style.display = 'none';
        }
    }

    showBuilderInInventory() {
        // Ensure we're on the inventory screen
        this.switchScreen('inventory');
        
        // Hide carousel section and show builder
        const carouselSection = document.querySelector('.nft-carousel-section');
        const builderContainer = document.querySelector('.fighter-builder-container');
        
        if (carouselSection) {
            carouselSection.style.display = 'none';
        }
        
        if (builderContainer) {
            builderContainer.style.display = 'block';
        }
        
        // Update selected NFT name
        const selectedNFTName = document.getElementById('selected-nft-name');
        if (selectedNFTName && this.selectedNFT) {
            selectedNFTName.textContent = this.selectedNFT.name;
        }
        
        // Populate purchased items
        this.populatePurchasedItems();
        
        // Initialize builder components from the selected NFT
        if (this.selectedNFT) {
            // Check if NFT has customized components first
            if (this.selectedNFT.components && Object.keys(this.selectedNFT.components).length > 0) {
                console.log('Loading customized components for builder view:', this.selectedNFT.components);
                this.builderComponents = { ...this.selectedNFT.components };
                
                // Load images for the components and render when all are loaded
                let imagesToLoad = 0;
                let imagesLoaded = 0;
                
                Object.entries(this.builderComponents).forEach(([layer, component]) => {
                    if (component && component.path && !component.image) {
                        imagesToLoad++;
                        console.log(`Loading image for ${layer} component in builder view:`, component.name);
                        const image = new Image();
                        image.onload = () => {
                            console.log(`Image loaded for ${layer} component in builder view:`, component.name);
                            component.image = image;
                            imagesLoaded++;
                            
                            // When all images are loaded, render the NFT
                            if (imagesLoaded === imagesToLoad) {
                                console.log('All component images loaded for builder view, rendering NFT');
                                this.renderNFTAsBase(this.selectedNFT);
                            }
                        };
                        image.onerror = (error) => {
                            console.error(`Failed to load image for ${layer} component in builder view:`, component.name, error);
                            imagesLoaded++;
                            
                            // Still render even if some images fail to load
                            if (imagesLoaded === imagesToLoad) {
                                console.log('All component images processed for builder view, rendering NFT');
                                this.renderNFTAsBase(this.selectedNFT);
                            }
                        };
                        image.src = component.path;
                    }
                });
                
                // If no images need to be loaded, render immediately
                if (imagesToLoad === 0) {
                    console.log('No component images to load for builder view, rendering NFT immediately');
                    this.renderNFTAsBase(this.selectedNFT);
                }
            } else {
                // Use original NFT components if no customized ones exist
                const nftComponents = this.buildComponentsFromNFTMetadata(this.selectedNFT);
                this.builderComponents = nftComponents;
                console.log('Using original NFT components for builder view:', nftComponents);
                
                // Render the NFT with original components
                this.renderNFTAsBase(this.selectedNFT);
            }
        }
    }

    drawComponentPlaceholder(ctx, componentName, canvasWidth, canvasHeight, scale) {
        const centerX = canvasWidth / 2;
        const centerY = canvasHeight / 2;
        const size = 30 * scale;
        
        // Draw a simple placeholder
        ctx.fillStyle = '#cccccc';
        ctx.fillRect(centerX - size/2, centerY - size/2, size, size);
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1;
        ctx.strokeRect(centerX - size/2, centerY - size/2, size, size);
        
        // Draw component name
        ctx.fillStyle = '#000000';
        ctx.font = `${8 * scale}px Arial`;
        ctx.textAlign = 'center';
        ctx.fillText(componentName.substring(0, 8), centerX, centerY + size/2 + 8 * scale);
    }

    populateInventoryPurchased() {
        const purchasedGrid = document.getElementById('inventory-purchased-grid');
        if (!purchasedGrid) {
            console.error('inventory-purchased-grid element not found');
            return;
        }
        
        console.log('populateInventoryPurchased called');
        console.log('purchasedItems array:', this.purchasedItems);
        console.log('purchasedItems length:', this.purchasedItems.length);
        
        purchasedGrid.innerHTML = '';
        
        if (this.purchasedItems.length === 0) {
            console.log('No purchased items found');
            purchasedGrid.innerHTML = '<div class="inventory-empty">No purchased items found. Buy items from the shop to see them here.</div>';
            return;
        }
        
        this.purchasedItems.forEach((item, index) => {
            const itemElement = document.createElement('div');
            itemElement.className = 'shop-item';
            itemElement.dataset.index = index;
            
            let description = '';
            if (item.type === 'pilot') {
                description = `Pilot component with +${item.attack} attack`;
            } else if (item.type === 'body') {
                description = `Body component with +${item.defense} defense`;
            } else if (item.type === 'armor') {
                description = `Armor component with +${item.defense} defense`;
            } else if (item.type === 'head') {
                description = `Head component with +${item.attack} attack`;
            } else if (item.type === 'hand' || item.type === 'hands') {
                description = `Hand component with +${item.attack} attack`;
            } else if (item.type === 'offhand') {
                description = `Offhand component with +${item.attack || item.defense} ${item.attack ? 'attack' : 'defense'}`;
            } else if (item.type === 'accessory') {
                description = `Accessory component with +${item.attack || item.defense} ${item.attack ? 'attack' : 'defense'}`;
            }
            
            console.log('Creating item element for:', item.name, 'with path:', item.path);
            
            itemElement.innerHTML = `
                <div class="item-icon">
                    ${item.path ? `<img src="${item.path}" alt="${item.name}" loading="lazy" decoding="async">` : this.symbolMarkup(this.getItemSymbol(item), 'skill-symbol')}
                </div>
                <div class="item-name">${item.name}</div>
                <div class="item-description">${description}</div>
                <div class="item-price">Purchased</div>
                <button class="equip-btn" data-item='${JSON.stringify(item)}'>Equip</button>
            `;
            
            // Add equip button functionality
            const equipBtn = itemElement.querySelector('.equip-btn');
            equipBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.equipItem(item);
            });
            
            itemElement.addEventListener('click', () => {
                // Remove previous selection
                document.querySelectorAll('.shop-item.selected').forEach(el => el.classList.remove('selected'));
                itemElement.classList.add('selected');
                
                // Show item details
                this.showModal('Item Details', `
                    <strong>${item.name}</strong><br>
                    Type: ${item.type}<br>
                    Attack: ${item.attack || 0}<br>
                    Defense: ${item.defense || 0}<br>
                    Cost: ${item.cost} coins<br>
                    Purchased: ${new Date(item.purchasedAt).toLocaleDateString()}
                `);
            });
            
            purchasedGrid.appendChild(itemElement);
        });
    }

    populateInventorySkills() {
        const equippedGrid = document.getElementById('equipped-skills-grid');
        const availableGrid = document.getElementById('available-skills-grid');
        if (!equippedGrid || !availableGrid) return;
        
        // Clear grids
        equippedGrid.innerHTML = '';
        availableGrid.innerHTML = '';
        
        // Update equipped skills count
        const equippedCount = document.querySelector('.equipped-skills h4');
        if (equippedCount) {
            equippedCount.textContent = `Equipped Skills (${this.equippedSkills.length}/${this.maxSkills})`;
        }
        
        // Populate equipped skills
        this.equippedSkills.forEach((skillName, index) => {
            const skillElement = document.createElement('div');
            skillElement.className = 'shop-item equipped';
            skillElement.dataset.skill = skillName;

            const skillData = this.shopData.skills.find(s => s.name === skillName);
            const description = skillData ? skillData.description : 'Skill';

            skillElement.innerHTML = `
                <div class="item-icon">${this.symbolMarkup(this.getSkillSymbol(skillName), 'skill-symbol')}</div>
                <div class="item-name">${skillName}</div>
                <div class="item-description">${description}</div>
                <div class="item-price">Equipped</div>
                <button class="unequip-btn" style="margin-top: 8px; padding: 4px 8px; font-size: 10px;">Unequip</button>
            `;
            
            skillElement.querySelector('.unequip-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                this.unequipSkill(skillName);
            });
            
            equippedGrid.appendChild(skillElement);
        });
        
        // Populate available skills (including default skills and purchased skills)
        const allAvailableSkills = ['Slash', 'Power-up', 'Defend', 'Dodge'];
        if (this.availableSkills) {
            allAvailableSkills.push(...this.availableSkills);
        }
        
        // Filter out already equipped skills
        const unequippedSkills = allAvailableSkills.filter(skill => !this.equippedSkills.includes(skill));
        
        unequippedSkills.forEach(skillName => {
            const skillElement = document.createElement('div');
            skillElement.className = 'shop-item available';
            skillElement.dataset.skill = skillName;

            const skillData = this.shopData.skills.find(s => s.name === skillName);
            const description = skillData ? skillData.description : 'Skill';

            skillElement.innerHTML = `
                <div class="item-icon">${this.symbolMarkup(this.getSkillSymbol(skillName), 'skill-symbol')}</div>
                <div class="item-name">${skillName}</div>
                <div class="item-description">${description}</div>
                <div class="item-price">Available</div>
                <button class="equip-btn" style="margin-top: 8px; padding: 4px 8px; font-size: 10px;">Equip</button>
            `;
            
            skillElement.querySelector('.equip-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                this.equipSkill(skillName);
            });
            
            availableGrid.appendChild(skillElement);
        });
    }

    equipSkill(skillName) {
        if (this.equippedSkills.length >= this.maxSkills) {
            this.showModal('Skill Limit Reached', 'You can only equip 6 skills at a time!');
            return;
        }
        
        if (this.equippedSkills.includes(skillName)) {
            this.showModal('Skill Already Equipped', 'This skill is already equipped!');
            return;
        }
        
        this.equippedSkills.push(skillName);
        this.populateInventorySkills();
        this.saveGameData();
    }

    unequipSkill(skillName) {
        const index = this.equippedSkills.indexOf(skillName);
        if (index > -1) {
            this.equippedSkills.splice(index, 1);
            this.populateInventorySkills();
            this.saveGameData();
        }
    }

    // Leaderboard System
    savePlayerStats() {
        if (!this.publicKey) return;
        
        const playerData = {
            walletAddress: this.publicKey,
            name: this.publicKey.substring(0, 8) + '…' + this.publicKey.substring(this.publicKey.length - 4),
            level: this.level,
            exp: this.exp,
            totalExp: this.playerStats.totalExp,
            wins: this.playerStats.wins,
            losses: this.playerStats.losses,
            battlesWon: this.playerStats.battlesWon,
            battlesLost: this.playerStats.battlesLost,
            highestLevel: this.playerStats.highestLevel,
            lastUpdated: Date.now()
        };
        
        // Save to localStorage for offline access
        localStorage.setItem('bonkler_player_stats', JSON.stringify(playerData));
        
        // Submit to global leaderboard
        this.submitToGlobalLeaderboard(playerData);
    }
    
    // Submit player data to global leaderboard
    async submitToGlobalLeaderboard(playerData) {
        try {
            const response = await fetch('/api/leaderboard/submit', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(playerData)
            });

            if (response.ok) {
                const result = await response.json();
                console.log('Score submitted to global leaderboard:', result.message);

                // Show rank notification if available
                if (result.rank) {
                    this.showModal?.('Global Rank Updated!', `Your current global rank: #${result.rank}`);
                }

                // Refresh leaderboard to show updated data
                this.updateLeaderboard();
            } else {
                console.error('Failed to submit score to global leaderboard');
            }
        } catch (error) {
            console.error('Error submitting to global leaderboard:', error);
            // Fallback to local storage if server is unavailable
            this.updateLocalLeaderboardData(playerData);
        }
    }

    // Fallback to local storage if server is unavailable
    updateLocalLeaderboardData(playerData) {
        const existingData = localStorage.getItem('bonkler_leaderboard');
        let leaderboardData = existingData ? JSON.parse(existingData) : [];
        
        const existingIndex = leaderboardData.findIndex(p => p.walletAddress === playerData.walletAddress);
        
        if (existingIndex !== -1) {
            leaderboardData[existingIndex] = { ...leaderboardData[existingIndex], ...playerData };
        } else {
            leaderboardData.push(playerData);
        }
        
        leaderboardData.sort((a, b) => b.totalExp - a.totalExp);
        leaderboardData = leaderboardData.slice(0, 100);
        
        localStorage.setItem('bonkler_leaderboard', JSON.stringify(leaderboardData));
        this.leaderboardData = leaderboardData;
    }
    
    // Get current player's global rank
    async getPlayerGlobalRank() {
        if (!this.publicKey) return null;

        try {
            const response = await fetch(`/api/leaderboard/rank/${encodeURIComponent(this.publicKey)}`);

            if (response.ok) {
                const result = await response.json();
                return result.rank;
            }
        } catch (error) {
            console.error('Error getting global rank:', error);
        }

        return null;
    }

    async updateLeaderboard() {
        try {
            // Try to fetch from global leaderboard first
            const response = await fetch('/api/leaderboard');

            if (response.ok) {
                const globalData = await response.json();
                this.leaderboardData = globalData;
                console.log('Loaded global leaderboard:', globalData.length, 'players');
                this.updateLeaderboardStatus('global');
            } else {
                throw new Error('Failed to fetch global leaderboard');
            }
        } catch (error) {
            console.warn('Using local leaderboard (server unavailable):', error.message);
            // Fallback to local storage
            const existingData = localStorage.getItem('bonkler_leaderboard');
            this.leaderboardData = existingData ? JSON.parse(existingData) : [];
            this.updateLeaderboardStatus('local');
        }
        
        // Update the display
        this.populateLeaderboard(this.currentLeaderboardTab);
    }

    // Update leaderboard status indicator
    updateLeaderboardStatus(status) {
        const statusElement = document.getElementById('leaderboard-status');
        if (!statusElement) return;

        const indicator = statusElement.querySelector('.status-indicator');
        if (indicator) {
            indicator.className = `status-indicator ${status}`;
            indicator.innerHTML = status === 'global'
                ? `${this.symbolMarkup('global')} Global`
                : `${this.symbolMarkup('local')} Local`;
        }
    }
    
    populateLeaderboard(tab = 'global') {
        const leaderboardList = document.getElementById('leaderboard-list');
        leaderboardList.innerHTML = '';

        if (this.leaderboardData.length === 0) {
            leaderboardList.innerHTML = '<div class="leaderboard-empty">No players found. Be the first to battle and get on the leaderboard!</div>';
            return;
        }
        
        // Filter data based on tab
        let displayData = this.leaderboardData;
        if (tab === 'weekly') {
            const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
            displayData = this.leaderboardData.filter(player => 
                player.lastUpdated > oneWeekAgo
            );
        } else if (tab === 'monthly') {
            const oneMonthAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
            displayData = this.leaderboardData.filter(player => 
                player.lastUpdated > oneMonthAgo
            );
        }
        
        // Sort by appropriate metric
        if (tab === 'wins') {
            displayData.sort((a, b) => b.wins - a.wins);
        } else if (tab === 'level') {
            displayData.sort((a, b) => b.level - a.level);
        } else {
            displayData.sort((a, b) => b.totalExp - a.totalExp);
        }
        
        displayData.forEach((player, index) => {
            const entry = document.createElement('div');
            entry.className = 'leaderboard-entry';
            
            let rankClass = '';
            if (index === 0) rankClass = 'gold';
            else if (index === 1) rankClass = 'silver';
            else if (index === 2) rankClass = 'bronze';
            
            // Highlight current player
            const isCurrentPlayer = this.publicKey && player.walletAddress === this.publicKey;
            if (isCurrentPlayer) {
                entry.classList.add('current-player');
            }
            
            entry.innerHTML = `
                <div class="rank ${rankClass}">#${index + 1}</div>
                <div class="player-info">
                    <div class="player-avatar">${this.symbolMarkup('pilot')}</div>
                    <div class="player-details">
                        <h3>${player.name}</h3>
                        <p>Level ${player.level}</p>
                        <small>${player.walletAddress}</small>
                    </div>
                </div>
                <div class="player-stats">
                    <div class="stat-value">${player.totalExp}</div>
                    <div class="stat-label">EXP</div>
                    <div class="stat-value">${player.wins}</div>
                    <div class="stat-label">Wins</div>
                </div>
            `;
            
            leaderboardList.appendChild(entry);
        });
    }

    // Modal System
    showModal(title, content) {
        this.lastFocusedElement = document.activeElement;
        document.getElementById('modal-title').textContent = title;
        document.getElementById('modal-content').textContent = content;
        document.getElementById('modal-overlay').classList.add('active');
        requestAnimationFrame(() => document.getElementById('modal-ok')?.focus());
    }

    closeModal() {
        const overlay = document.getElementById('modal-overlay');
        if (!overlay?.classList.contains('active')) return;
        overlay.classList.remove('active');
        this.lastFocusedElement?.focus?.();
    }

    // Loading Screen Methods
    startLoadingScreen() {
        this.loadingProgress = 0;
        this.assetIndex = 0;
        this.loadingBonklers = [];
        this.renderLoadingMark();
    }

    renderLoadingMark() {
        const canvas = document.getElementById('asset-preview-canvas');
        const label = document.getElementById('asset-preview-text');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const logo = new Image();
        logo.onload = () => {
            ctx.drawImage(logo, 104, 74, 92, 95);
            ctx.fillStyle = '#000b78';
            ctx.font = '700 18px Tahoma';
            ctx.textAlign = 'center';
            ctx.fillText('BONKLER OS', 150, 204);
            ctx.font = '11px monospace';
            ctx.fillText('COMBAT BIOS v1.8.1', 150, 225);
        };
        logo.src = 'favicon.png';
        if (label) label.textContent = 'Checking local combat modules…';
    }

    updateLoadingProgress(progress, text) {
        this.loadingProgress = progress;
        
        // Update loading bar
        const loadingBarFill = document.getElementById('loading-bar-fill');
        const loadingText = document.getElementById('loading-text');
        const loadingTip = document.getElementById('loading-tip');
        
        if (loadingBarFill) {
            loadingBarFill.style.width = `${progress}%`;
            loadingBarFill.parentElement?.setAttribute('aria-valuenow', String(progress));
        }
        
        if (loadingText) {
            loadingText.textContent = `${progress}%`;
        }
        
        if (loadingTip) {
            loadingTip.textContent = String(text).replace(/\.\.\./g, '…');
        }
    }

    hideLoadingScreen() {
        const loadingScreen = document.getElementById('loading-screen');
        const gameContainer = document.getElementById('game-container');
        
        if (loadingScreen) {
            loadingScreen.style.opacity = '0';
            loadingScreen.style.transition = 'opacity 180ms ease';
            
            setTimeout(() => {
                loadingScreen.style.display = 'none';
                if (gameContainer) {
                    gameContainer.style.display = 'flex';
                }
            }, 180);
        }
    }

    startWalletMonitoring() {
        // Monitor wallet connection state
        setInterval(() => {
            // Check if wallet is still connected
            if (this.isConnected && this.wallet) {
                // For Phantom wallet, check if still connected
                if (window.solana && window.solana.isPhantom) {
                    if (!window.solana.isConnected) {
                        console.log('Phantom wallet disconnected');
                        this.isConnected = false;
                        this.publicKey = null;
                        this.wallet = null;
                        // Don't clear userNFTs - keep them for when wallet reconnects
                        // this.userNFTs = [];
                        this.updateWalletButton();
                        this.populateInventory();
                        this.populateNFTs();
                        this.saveGameData();
                    }
                }
            }
        }, 2000); // Check every 2 seconds
    }
}

// Replace the legacy canvas effects with the custom geometric combat renderer.
window.installCombatAnimations?.(GameState);

// Initialize the game when the page loads
document.addEventListener('DOMContentLoaded', async () => {
    try {
        console.log('Initializing Bonkler game...');
    window.gameState = new GameState();
        await window.gameState.init();
        console.log('Game initialized successfully!');
    } catch (error) {
        console.error('Error initializing game:', error);
        // Show error message to user
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: red; color: white; padding: 20px; z-index: 9999; border: 2px solid black;';
        errorDiv.innerHTML = 'Game failed to load. Please refresh the page.';
        document.body.appendChild(errorDiv);
    }
});

// Add CSS for damage animation
const style = document.createElement('style');
style.textContent = `
    @keyframes fadeOutUp {
        0% {
            opacity: 1;
            transform: translateY(0);
        }
        100% {
            opacity: 0;
            transform: translateY(-20px);
        }
    }
`;
document.head.appendChild(style);
