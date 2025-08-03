// Game State Management
class GameState {
    constructor() {
        this.coins = 1000;
        this.exp = 0;
        this.level = 1;
        this.nfts = [];
        this.userNFTs = [];
        this.purchasedItems = [];
        this.selectedNFT = null;
        this.currentFighter = {};
        this.fighterBuilt = false;
        this.battleMode = 'ai';
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
            dodgeSuccessRate: 0.7,
            bonklerBeamUses: 3
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
        
        // Bonkler NFT collection info
        this.bonklerCollectionMint = 'YOUR_COLLECTION_MINT_ADDRESS'; // Replace with actual collection mint
        this.bonklerProgramId = 'YOUR_PROGRAM_ID'; // Replace with actual program ID
        
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
                { name: 'Slash', type: 'skill', cost: 0, icon: '⚔️', description: 'Basic light attack', unlocked: true },
                { name: 'Power-up', type: 'skill', cost: 0, icon: '⬆️', description: 'Increase attack strength', unlocked: true },
                { name: 'Defend', type: 'skill', cost: 0, icon: '🛡️', description: 'Increase defense', unlocked: true },
                { name: 'Dodge', type: 'skill', cost: 0, icon: '💨', description: '70% chance to dodge', unlocked: true },
                { name: 'Special', type: 'skill', cost: 500, icon: '⭐', description: 'Heavy attack (requires 3 power-ups)', unlocked: false },
                { name: 'Bonkler Beam', type: 'skill', cost: 1000, icon: '⚡', description: 'Devastating beam attack (65% hit rate)', unlocked: false },
                { name: 'Double Strike', type: 'skill', cost: 300, icon: '⚔️⚔️', description: 'Attack twice in one turn', unlocked: false },
                { name: 'Counter Attack', type: 'skill', cost: 400, icon: '🔄', description: 'Counter enemy attacks', unlocked: false },
                { name: 'Heal', type: 'skill', cost: 200, icon: '💚', description: 'Restore 30% health', unlocked: false },
                { name: 'Critical Strike', type: 'skill', cost: 600, icon: '💥', description: 'High chance of critical damage', unlocked: false }
            ]
        };
    }

    // Battle Log Methods
    addBattleLogEntry(message, type = 'battle-event') {
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
        console.log('🔍 After loadGameData - userNFTs count:', this.userNFTs.length);
        if (this.userNFTs.length > 0) {
            this.userNFTs.forEach((nft, index) => {
                if (nft.components && Object.keys(nft.components).length > 0) {
                    console.log(`🔍 NFT ${index} has customized components:`, nft.components);
                }
            });
        }
        
        // Setup event listeners
        this.updateLoadingProgress(20, 'Setting up game controls...');
        this.setupEventListeners();
        
        // Load component assets
        this.updateLoadingProgress(30, 'Loading fighter components...');
        await this.initFighterBuilder();
        
        // Load NFT bonklers
        this.updateLoadingProgress(50, 'Loading NFT collection...');
        await this.loadNFTBonklers();
        
        // Process NFTs with assets
        this.updateLoadingProgress(70, 'Processing NFT data...');
        this.reprocessNFTsWithAssets();
        
        // Populate UI elements
        this.updateLoadingProgress(85, 'Building user interface...');
        this.populateNFTs();
        this.populateShop();
        this.populateInventory();
        this.updateLeaderboard();
        this.updateUI();
        
        // Preload battle background
        this.updateLoadingProgress(95, 'Preparing battle arena...');
        this.preloadBattleBackground();
        
        // Complete loading
        this.updateLoadingProgress(100, 'Game ready!');
        
        // Clear any cached data that might have old paths
        this.clearCachedPaths();
        
        // Wallet connection monitoring
        this.startWalletMonitoring();
        
        // Debug: Check if wallet should auto-connect
        console.log('🔍 Checking if wallet should auto-connect...');
        console.log('🔍 Current publicKey:', this.publicKey);
        console.log('🔍 Current isConnected:', this.isConnected);
        if (this.publicKey && this.isConnected) {
            console.log('✅ Wallet already connected, skipping auto-connect');
        } else {
            console.log('❌ No wallet connected, will need manual connection');
        }
        
        // Hide loading screen and show game
        setTimeout(() => {
            this.hideLoadingScreen();
        
        // Check if fighter is already built
        if (this.fighterBuilt) {
            this.switchScreen('battle');
        }
        }, 1000);
    }

    loadGameData() {
        console.log('🔄 loadGameData called');
        // Load saved data from localStorage
        const savedData = localStorage.getItem('bonklerGameData');
        if (savedData) {
            const data = JSON.parse(savedData);
            console.log('📦 Found saved data in localStorage');
            
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
            
            // Only load progress if user has a connected wallet
            if (data.publicKey && data.isConnected) {
                console.log('✅ Loading saved progress for wallet:', data.publicKey);
                this.coins = data.coins || 1000;
                this.exp = data.exp || 0;
                this.level = data.level || 1;
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
                    console.log('📋 Loaded userNFTs from localStorage:', this.userNFTs.length, 'NFTs');
                    this.userNFTs.forEach((nft, index) => {
                        if (nft.components && Object.keys(nft.components).length > 0) {
                            console.log(`🎯 NFT ${index} (${nft.name}) has customized components:`, nft.components);
                        } else {
                            console.log(`📝 NFT ${index} (${nft.name}) has NO customized components`);
                        }
                    });
                } else {
                    console.log('❌ No userNFTs found in saved data');
                }
                
                this.equippedSkills = data.equippedSkills || ['Slash', 'Power-up', 'Defend', 'Dodge'];
                this.availableSkills = data.availableSkills || [];
                
                // Load wallet state
                this.publicKey = data.publicKey;
                this.isConnected = data.isConnected;
                console.log('✅ Wallet state loaded - publicKey:', this.publicKey, 'isConnected:', this.isConnected);
            } else {
                console.log('❌ No connected wallet found, starting fresh');
                this.resetToFreshStart();
            }
        } else {
            console.log('❌ No saved data found, starting fresh');
            this.resetToFreshStart();
        }
    }
    
    resetToFreshStart() {
        // Reset all game state to fresh start
        this.coins = 0;
        this.exp = 0;
        this.level = 1;
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
        console.log('🔄 Clearing cached paths with old format');
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
            isConnected: this.isConnected
        };
        
        // Debug: Check what's being saved
        if (this.userNFTs.length > 0) {
            console.log('Saving userNFTs to localStorage:', this.userNFTs.length, 'NFTs');
            this.userNFTs.forEach((nft, index) => {
                if (nft.components && Object.keys(nft.components).length > 0) {
                    console.log(`NFT ${index} (${nft.name}) has customized components being saved:`, nft.components);
                }
            });
        }
        
        localStorage.setItem('bonklerGameData', JSON.stringify(data));
    }

    async loadNFTBonklers() {
        try {
            // Load individual NFT JSON files from output-jsons directory
            this.nftCount = 1555; // Total number of NFTs
            this.currentNFTIndex = 0;
            
            console.log('Loading NFT bonklers from output-jsons...');
            
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
        
        console.log(`Loading NFTs ${this.currentNFTIndex} to ${endIndex - 1}...`);
        
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
        
        console.log(`Successfully loaded ${newNFTs.length} more NFT bonklers (Total: ${this.nfts.length})`);
        
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
            countElement.textContent = `Loaded: ${count} NFTs`;
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
            avatar: '⚔️',
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
        try {
            // Use Helius RPC endpoint with API key for reliable access
            const rpcEndpoint = 'https://mainnet.helius-rpc.com/?api-key=681f390e-8fce-4246-85f7-1e515cd5894c';
            
            this.connection = new solanaWeb3.Connection(
                rpcEndpoint,
                'confirmed'
            );
            console.log('Solana connection initialized with Helius RPC endpoint');
        } catch (error) {
            console.error('Failed to initialize Solana connection:', error);
        }
    }

    async tryAlternativeRPC() {
        // Use Helius RPC as primary fallback, then public endpoints
        const rpcEndpoints = [
            'https://mainnet.helius-rpc.com/?api-key=681f390e-8fce-4246-85f7-1e515cd5894c',
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
                            
                            console.log('Connected via Wallet Standard:', this.publicKey);
        
        // Update wallet button
                            this.updateWalletButton();
                            
                            // Check if we already have saved NFTs for this wallet
                            const savedData = localStorage.getItem('bonklerGameData');
                            console.log('🔍 Checking saved data for wallet:', this.publicKey);
                            if (savedData) {
                                const data = JSON.parse(savedData);
                                console.log('🔍 Saved data publicKey:', data.publicKey);
                                console.log('🔍 Current publicKey:', this.publicKey);
                                console.log('🔍 Saved userNFTs count:', data.userNFTs ? data.userNFTs.length : 0);
                                
                                if (data.publicKey === this.publicKey && data.userNFTs && data.userNFTs.length > 0) {
                                    console.log('✅ Using saved NFTs from localStorage');
                                    this.userNFTs = data.userNFTs;
                                    
                                    // Debug: Check customized components
                                    this.userNFTs.forEach((nft, index) => {
                                        if (nft.components && Object.keys(nft.components).length > 0) {
                                            console.log(`✅ NFT ${index} has customized components:`, nft.components);
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

                console.log('Connected to Phantom wallet:', this.publicKey);

                // Update wallet button
                this.updateWalletButton();

                // Check if we already have saved NFTs for this wallet
                const savedData = localStorage.getItem('bonklerGameData');
                console.log('🔍 Checking saved data for Phantom wallet:', this.publicKey);
                if (savedData) {
                    const data = JSON.parse(savedData);
                    console.log('🔍 Saved data publicKey:', data.publicKey);
                    console.log('🔍 Current publicKey:', this.publicKey);
                    console.log('🔍 Saved userNFTs count:', data.userNFTs ? data.userNFTs.length : 0);
                    
                    if (data.publicKey === this.publicKey && data.userNFTs && data.userNFTs.length > 0) {
                        console.log('✅ Using saved NFTs from localStorage (Phantom)');
                        this.userNFTs = data.userNFTs;
                        
                        // Debug: Check customized components
                        this.userNFTs.forEach((nft, index) => {
                            if (nft.components && Object.keys(nft.components).length > 0) {
                                console.log(`✅ NFT ${index} has customized components:`, nft.components);
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
        console.log('🔄 Loading Bonkler NFTs for wallet:', publicKey);
        
        if (!publicKey) {
            console.error('No public key provided');
            return;
        }

        try {
            // Use Helius API to get NFTs
            const HELIUS_API_KEY = '681f390e-8fce-4246-85f7-1e515cd5894c';
            const HELIUS_RPC = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;

            console.log('📡 Fetching NFTs from Helius...');

            const res = await fetch(HELIUS_RPC, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: '1',
                    method: 'getAssetsByOwner',
                    params: {
                        ownerAddress: publicKey,
                        page: 1,
                        limit: 1000,
                        displayOptions: {
                            showUnverifiedCollections: true
                        }
                    }
                })
            });

            const data = await res.json();

            if (!data.result || !data.result.items || data.result.items.length === 0) {
                console.warn('⚠️ No NFTs found for wallet:', publicKey);
                await this.loadTestNFTs(publicKey);
                this.showModal('Test Mode', 'No NFTs found in your wallet. Loaded test NFTs for demonstration.');
                return;
            }

            const allNFTs = data.result.items;
            console.log(`📦 Found ${allNFTs.length} total NFTs`);

            // Filter for Bonkler NFTs by name or collection address
            const bonklerNFTs = allNFTs.filter(nft => {
                const name = nft.content?.metadata?.name?.toLowerCase() || '';
                const symbol = nft.content?.metadata?.symbol?.toLowerCase() || '';
                
                // Check for Bonkler collection address
                const bonklerCollectionMint = 'HCx8AwY9ivtVNVT6rrht2StyMZgDE3yA3vGtmoRuoaeM';
                const isBonklerCollection = nft.grouping?.some(group => 
                    group.group_value === bonklerCollectionMint
                );
                
                // Check for Bonkler terms in name/symbol
                const hasBonklerTerms = name.includes('bonkler') || symbol.includes('bonkler');
                
                console.log(`Checking NFT: ${name} (${symbol}) - Collection: ${isBonklerCollection}, Terms: ${hasBonklerTerms}`);
                
                return isBonklerCollection || hasBonklerTerms;
            });

            console.log(`✅ Found ${bonklerNFTs.length} Bonkler NFTs`);

            // Convert to game format
            // Store existing user NFTs to preserve customized components
            const existingUserNFTs = this.userNFTs || [];
        this.userNFTs = []; // Clear existing user NFTs
            let loadedCount = 0;

            for (const nft of bonklerNFTs) {
                try {
                    console.log(`🎮 Converting NFT: ${nft.content?.metadata?.name}`);
                    
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
                                console.log(`✅ Loaded metadata for NFT #${nftNumber}:`, metadata);
                            } else {
                                console.log(`❌ No metadata file found for NFT #${nftNumber}`);
                            }
                        } catch (error) {
                            console.log(`❌ Failed to load metadata for NFT #${nftNumber}:`, error);
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

            console.log(`🎯 Loaded ${loadedCount} Bonkler NFTs for wallet ${publicKey}`);

            // Save the updated userNFTs immediately after loading
            this.saveGameData();
            console.log('✅ Saved updated userNFTs to localStorage');

            // Process NFTs with loaded component assets
            this.reprocessNFTsWithAssets();
            
            // Refresh displays
            this.populateInventory();
            this.populateNFTs();

            if (loadedCount > 0) {
                this.showModal('NFTs Loaded', `Successfully loaded ${loadedCount} of your Bonkler NFTs!`);
            } else {
                console.log('No Bonkler NFTs found, loading test NFTs for demonstration');
                await this.loadTestNFTs(publicKey);
                this.showModal('Test Mode', 'No Bonkler NFTs found in your wallet. Loaded test NFTs for demonstration.');
            }

            } catch (error) {
            console.error('❌ Error loading user NFTs:', error);
            
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

    async loadTestNFTs(publicKey) {
        console.log('Loading demo NFTs for testing');
        
        // Create demo NFTs with different configurations
        const demoNFTs = [
            {
                id: 'demo-1',
                name: 'Demo Bonkler #1',
                level: 5,
                attack: 85,
                defense: 72,
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
                owner: publicKey,
                mint: demoNFT.id,
                rarity: 'Rare',
                exp: demoNFT.level * 100
            };
            this.userNFTs.push(gameBonkler);
        }
        
        console.log(`Loaded ${this.userNFTs.length} demo NFTs`);
        
        // Refresh displays
        this.populateInventory();
        this.populateNFTs();
    }

    async disconnectWallet() {
        try {
            if (this.wallet && this.isConnected) {
                await this.wallet.disconnect();
            }
            
            // Clear all game data when disconnecting
            this.resetToFreshStart();
            
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
        
        if (this.isConnected && this.publicKey) {
            walletBtn.innerHTML = `<i class="fas fa-wallet"></i> ${this.publicKey.slice(0, 4)}...${this.publicKey.slice(-4)}`;
            walletBtn.disabled = false;
        } else {
            walletBtn.innerHTML = `<i class="fas fa-wallet"></i> Connect Wallet`;
            walletBtn.disabled = false;
        }
    }

    updateUI() {
        document.getElementById('coins').textContent = this.coins;
        document.getElementById('exp').textContent = this.exp;
        document.getElementById('level').textContent = this.level;
        
        // Update wallet button state
        this.updateWalletButton();
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
        
        // Navigation
        const navButtons = document.querySelectorAll('.nav-btn');
        console.log('Found navigation buttons:', navButtons.length);
        navButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                console.log('Navigation button clicked:', e.target.dataset.screen);
                this.switchScreen(e.target.dataset.screen);
            });
        });

        // Battle mode selection
        document.querySelectorAll('.battle-mode-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.setBattleMode(e.target.dataset.mode);
            });
        });

        // Battle controls
        document.getElementById('slash-btn').addEventListener('click', () => this.performSlash());
        document.getElementById('power-up-btn').addEventListener('click', () => this.performPowerUp());
        document.getElementById('defend-btn').addEventListener('click', () => this.performDefend());
        document.getElementById('dodge-btn').addEventListener('click', () => this.performDodge());
        document.getElementById('special-btn').addEventListener('click', () => this.performSpecial());
        document.getElementById('bonkler-beam-btn').addEventListener('click', () => this.performBonklerBeam());

        // Modal close
        document.getElementById('modal-close').addEventListener('click', () => this.closeModal());
        document.getElementById('modal-overlay').addEventListener('click', (e) => {
            if (e.target.id === 'modal-overlay') this.closeModal();
        });

        // Shop categories
        document.querySelectorAll('.category-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.setShopCategory(e.target.dataset.category);
            });
        });

        // Inventory tabs
        document.querySelectorAll('.inventory-tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.setInventoryTab(e.target.dataset.tab);
            });
        });

        // Leaderboard tabs
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.setLeaderboardTab(e.target.dataset.tab);
            });
        });

        // Fighter builder controls
        document.getElementById('confirm-fighter-btn').addEventListener('click', () => {
            this.confirmFighter();
        });



        // Wallet connect/disconnect
        document.getElementById('wallet-connect-btn').addEventListener('click', () => {
            if (this.isConnected) {
                this.disconnectWallet();
            } else {
            this.connectWallet();
            }
        });



        // Load more NFTs
        document.getElementById('load-more-nfts-btn').addEventListener('click', () => {
            this.loadMoreNFTs();
        });
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
        this.componentAssets = {
            pilot: await this.loadAssetsFromFolder('PILOT'),
            body: await this.loadAssetsFromFolder('BODIES'),
            head: await this.loadAssetsFromFolder('HEADS'),
            armor: await this.loadAssetsFromFolder('ARMORS'),
            hands: await this.loadAssetsFromFolder('HANDS'),
            offhand: await this.loadAssetsFromFolder('OFFHAND'),
            accessory: await this.loadAssetsFromFolder('ACCESSORIES')
        };
        
        console.log('Component assets loaded:', this.componentAssets);
        console.log('Pilot assets:', this.componentAssets.pilot?.length || 0);
        console.log('Body assets:', this.componentAssets.body?.length || 0);
        console.log('Head assets:', this.componentAssets.head?.length || 0);
        console.log('Armor assets:', this.componentAssets.armor?.length || 0);
        console.log('Hands assets:', this.componentAssets.hands?.length || 0);
        console.log('Offhand assets:', this.componentAssets.offhand?.length || 0);
        console.log('Accessory assets:', this.componentAssets.accessory?.length || 0);
        
        // Draw empty builder after assets are loaded
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
            
            for (const fileName of files) {
                const img = new Image();
                
                // Create a promise to handle image loading
                const loadPromise = new Promise((resolve, reject) => {
                    img.onload = () => resolve(img);
                    img.onerror = () => {
                        console.warn(`Failed to load ${fileName}, using placeholder`);
                        // Create a placeholder if image fails to load
                        const canvas = document.createElement('canvas');
                        canvas.width = 100;
                        canvas.height = 100;
                        const ctx = canvas.getContext('2d');
                        
                        ctx.fillStyle = '#cccccc';
                        ctx.fillRect(0, 0, 100, 100);
                        ctx.strokeStyle = '#000000';
                        ctx.lineWidth = 2;
                        ctx.strokeRect(0, 0, 100, 100);
                        ctx.fillStyle = '#ffffff';
                        ctx.font = '12px Arial';
                        ctx.textAlign = 'center';
                        ctx.fillText(folderName, 50, 45);
                        ctx.fillText(fileName.replace('.png', ''), 50, 65);
                        
                        const placeholderImg = new Image();
                        placeholderImg.onload = () => resolve(placeholderImg);
                        placeholderImg.src = canvas.toDataURL();
                    };
                });
                
                // Try to load the actual image
                img.src = `${folderPath}/${fileName}`;
                
                // Wait for the image to load (or fallback to placeholder)
                const loadedImg = await loadPromise;
                
                assets.push({
                    name: fileName.replace('.png', ''),
                    path: `${folderPath}/${fileName}`,
                    image: loadedImg
                });
            }
        } catch (error) {
            console.error(`Error loading assets from ${folderName}:`, error);
        }
        
        return assets;
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
            display.innerHTML = '<div class="component-item"><span class="component-icon">❌</span></div>';
            info.innerHTML = '<span class="component-name">No items available</span><span class="component-stats"></span>';
            prevBtn.disabled = true;
            nextBtn.disabled = true;
            return;
        }
        
        const currentIndex = this.componentIndices[category];
        const currentAsset = assets[currentIndex];
        
        // Update display
        const icons = {
            pilot: '👤',
            body: '👔',
            head: '🎭',
            armor: '🛡️',
            hands: '⚔️',
            offhand: '💰',
            accessory: '🎩'
        };
        
        display.innerHTML = `
            <div class="component-item selected">
                <span class="component-icon">${icons[category] || '⚔️'}</span>
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
        console.log('selectNFTForBuilder called with:', nft);
        this.selectedNFT = nft;
        
        // Update builder display
        const builderHeader = document.querySelector('.builder-header h2');
        if (builderHeader) {
            builderHeader.textContent = `Customize: ${nft.name}`;
        }
        
        // Check if NFT has customized components first
        if (nft.components && Object.keys(nft.components).length > 0) {
            console.log('Using customized components for builder:', nft.components);
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
        
        // Render the NFT as base
        this.renderNFTAsBase(nft);
        
        this.showModal('NFT Selected', `You can now customize ${nft.name} with your purchased items!`);
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
                        console.log(`✅ Found asset for ${traitType}: ${asset.name}`);
                        components[category] = {
                            name: asset.name,
                            path: asset.path,
                            image: asset.image
                        };
                    } else {
                        console.log(`❌ No asset found for ${traitType}: ${value}`);
                        // Create a placeholder component
                        components[category] = {
                            name: value,
                            path: `${category.toUpperCase()}/${value}.png`,
                            image: null
                        };
                    }
                } else {
                    console.log(`⚠️ Unknown trait type: ${traitType}`);
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
                    console.log(`✅ Loaded fallback image for ${category}: ${component.name}`);
                };
                img.onerror = () => {
                    console.log(`❌ Failed to load fallback image for ${category}: ${component.path}`);
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
        
        // Clear canvas with transparent background
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw actual NFT components using the built components
        this.renderNFTComponentsFromBuilder();
        
        // Draw NFT info
        this.ctx.fillStyle = '#000000';
        this.ctx.font = '16px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(nft.name, this.canvas.width / 2, 30);
        this.ctx.font = '12px Arial';
        this.ctx.fillText(`Attack: ${nft.attack} | Defense: ${nft.defense}`, this.canvas.width / 2, 50);
        this.ctx.fillText('Select components from the right panel to customize', this.canvas.width / 2, 70);
        
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

    getPurchasedItemsByType(type) {
        if (!this.purchasedItems) return [];
        return this.purchasedItems.filter(item => item.type === type);
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
        const folderMap = {
            'pilot': 'PILOT',
            'body': 'BODIES',
            'armor': 'ARMORS',
            'hand': 'HANDS',
            'offhand': 'OFFHAND',
            'accessory': 'ACCESSORIES'
        };
        
        return `${folderMap[item.type] || item.type.toUpperCase()}/${item.asset}`;
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
        
        // Check if any components are selected
        const selectedComponents = Object.values(this.builderComponents).filter(comp => comp !== null);
        
        if (selectedComponents.length === 0) {
            this.showModal('No Components Selected', 'Please select at least one component to customize your NFT.');
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
        
        this.showModal('Fighter Customized!', `Your NFT "${this.selectedNFT.name}" has been customized and is ready for battle!`);
        
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

    switchScreen(screenName) {
        console.log('Switching to screen:', screenName);
        
        // Update navigation buttons
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        const targetNavBtn = document.querySelector(`[data-screen="${screenName}"]`);
        if (targetNavBtn) {
            targetNavBtn.classList.add('active');
            console.log('Updated navigation button');
        } else {
            console.error('Navigation button not found for screen:', screenName);
        }

        // Update screens
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });
        const targetScreen = document.getElementById(`${screenName}-screen`);
        if (targetScreen) {
            targetScreen.classList.add('active');
            console.log('Updated screen display');
        } else {
            console.error('Screen not found:', screenName);
        }
        
        // Special handling for builder screen
        if (screenName === 'builder') {
            // Ensure canvas is properly initialized
            if (this.canvas && this.ctx) {
                if (this.selectedNFT) {
                    // Re-render the selected NFT
                    this.renderNFTAsBase(this.selectedNFT);
                } else {
                    // Draw empty builder
                    this.drawEmptyBuilder();
                }
            }
        }
        
        // Note: Users can now access inventory even after building a fighter
    }

    setBattleMode(mode) {
        this.battleMode = mode;
        document.querySelectorAll('.battle-mode-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-mode="${mode}"]`).classList.add('active');
    }

    setShopCategory(category) {
        document.querySelectorAll('.category-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-category="${category}"]`).classList.add('active');
        this.populateShop(category);
    }

    setInventoryTab(tab) {
        // Update tab buttons
        document.querySelectorAll('.inventory-tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelector(`[data-tab="${tab}"]`).classList.add('active');
        
        // Show/hide sections based on tab
        const nftSection = document.querySelector('.nft-carousel-section');
        const skillsSection = document.querySelector('.skills-section');
        
        if (tab === 'nfts') {
            nftSection.style.display = 'block';
            skillsSection.style.display = 'none';
            this.populateInventoryNFTs();
        } else if (tab === 'skills') {
            nftSection.style.display = 'none';
            skillsSection.style.display = 'block';
            this.populateInventorySkills();
        }
    }

    setLeaderboardTab(tab) {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tab}"]`).classList.add('active');
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
                            component.image = asset.image;
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
            const nftCard = document.createElement('div');
            nftCard.className = 'nft-card';
            nftCard.dataset.nftId = nft.id;
            
            // Add NFT indicator if it's an NFT
            const nftBadge = nft.isNFT ? `<div class="nft-badge">NFT</div>` : '';
            
            // Always create a fighter preview canvas
            nftCard.innerHTML = `
                <div class="nft-avatar custom-fighter">
                    <canvas class="fighter-preview" width="120" height="180"></canvas>
                    ${nftBadge}
                </div>
                <div class="nft-name">${nft.name}</div>
                <div class="nft-description">${nft.description || ''}</div>
                <div class="nft-stats">
                    <div>Level: ${nft.level}</div>
                    <div>Attack: ${nft.attack}</div>
                    <div>Defense: ${nft.defense}</div>
                    <div>Health: ${nft.health}/${nft.maxHealth}</div>
                    ${nft.tokenId ? `<div>Token ID: ${nft.tokenId}</div>` : ''}
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

    startBattle() {
        if (!this.selectedNFT) {
            console.log('No NFT selected for battle');
            return;
        }

        // Switch to battle screen
        this.switchScreen('battle');
        
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
            level: this.selectedNFT.level,
            attack: this.selectedNFT.attack,
            defense: this.selectedNFT.defense,
            health: this.selectedNFT.health || defaultHealth,
            maxHealth: this.selectedNFT.maxHealth || defaultMaxHealth,
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
            this.playerFighter.attack += additionalAttack;
            this.playerFighter.defense += additionalDefense;
            
            console.log(`Applied component bonuses: +${additionalAttack} ATK, +${additionalDefense} DEF`);
            console.log('Final player fighter stats:', this.playerFighter);
            
            // Copy components to player fighter for rendering
            this.playerFighter.components = { ...this.selectedNFT.components };
            console.log('Copied components to player fighter:', this.playerFighter.components);
        }
        
        console.log('Player fighter created:', this.playerFighter);
        console.log('Player fighter components:', this.playerFighter.components);
        
        // Set up battle state
        this.currentBattle = {
            player: { ...this.playerFighter },
            enemy: { ...this.enemyFighter },
            turn: 'player',
            timer: 30
        };
        
        // Reset battle state
        this.battleState.powerUpCount = 0;
        this.battleState.bonklerBeamUses = 3;

        // Show battle arena
        document.getElementById('battle-arena').style.display = 'block';
        
        // Add battle start log entry
        this.addBattleLogEntry(`Battle started! ${this.playerFighter.name} vs ${this.enemyFighter.name}`, 'battle-event');
        this.addBattleLogEntry(`Your fighter: ${this.playerFighter.attack} ATK, ${this.playerFighter.defense} DEF`, 'player-action');
        this.addBattleLogEntry(`Enemy fighter: ${this.enemyFighter.attack} ATK, ${this.enemyFighter.defense} DEF`, 'enemy-action');
        
        // Initial render
        this.renderBattle();
        
        // Timer removed - battles are now unlimited
        
        // Enable battle controls
        this.enableBattleControls();
    }



    // Battle Animation Methods
    initBattleCanvas() {
        this.battleCanvas = document.getElementById('battle-canvas');
        this.battleCtx = this.battleCanvas.getContext('2d');
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

        return {
            name: 'Enemy Bonkler',
            level: Math.floor(Math.random() * 10) + 1,
            attack: 50 + Math.floor(Math.random() * 30),
            defense: 30 + Math.floor(Math.random() * 30),
            health: 400 + Math.floor(Math.random() * 200),
            maxHealth: 400 + Math.floor(Math.random() * 200),
            components: enemyComponents
        };
    }

    renderFighterOnBattleCanvas(fighter, x, y, scale = 0.3, isEnemy = false) {
        if (!this.battleCtx || !fighter || !fighter.components) {
            console.log('Cannot render fighter:', { battleCtx: !!this.battleCtx, fighter: !!fighter, components: !!fighter?.components });
            return;
        }

        console.log(`Rendering ${isEnemy ? 'enemy' : 'player'} fighter:`, fighter.name);
        console.log('Fighter components:', fighter.components);

        // Clear area for this fighter
        this.battleCtx.clearRect(x - 50, y - 100, 100, 200);

        // Render layers in order: body → armor → hands → offhand → head → pilot → accessories
        const layerOrder = ['body', 'armor', 'hands', 'offhand', 'head', 'pilot', 'accessory'];
        let renderedComponents = 0;
        
        layerOrder.forEach(layer => {
            const component = fighter.components[layer];
            console.log(`Checking ${layer} component:`, component);
            
            if (component && component.image && component.image.complete && component.image.naturalWidth > 0) {
                console.log(`Rendering ${layer} component:`, component.name);
                const scaledWidth = component.image.width * scale;
                const scaledHeight = component.image.height * scale;
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
                renderedComponents++;
            } else if (component) {
                console.log(`Component ${layer} has no valid image:`, component);
            }
        });
        
        console.log(`Rendered ${renderedComponents} components for ${isEnemy ? 'enemy' : 'player'} fighter`);
    }

    animateAttack(attacker, defender, isPlayerAttacking) {
        const startX = isPlayerAttacking ? 150 : 650;
        const endX = isPlayerAttacking ? 650 : 150;
        const y = 200;
        
        let currentX = startX;
        const step = isPlayerAttacking ? 15 : -15;
        let particles = [];
        
        // Create attack particles
        for (let i = 0; i < 20; i++) {
            particles.push({
                x: startX,
                y: y + Math.random() * 100 - 50,
                vx: (Math.random() - 0.5) * 10,
                vy: (Math.random() - 0.5) * 10,
                life: 1.0,
                decay: 0.02 + Math.random() * 0.03,
                color: `hsl(${Math.random() * 60 + 300}, 100%, 50%)` // Purple to blue
            });
        }
        
        const animate = () => {
            // Clear canvas
            this.battleCtx.clearRect(0, 0, this.battleCanvas.width, this.battleCanvas.height);
            
            // Transparent background - no background image
            // Canvas is already transparent, no need to draw anything
            
            // Draw enemy at fixed position
            this.renderFighterOnBattleCanvas(this.enemyFighter, 650, y, 0.3, true);
            
            // Draw player at fixed position
            this.renderFighterOnBattleCanvas(this.playerFighter, 150, y, 0.3, false);
            
            // Draw attacking fighter moving
            if (Math.abs(currentX - endX) > 5) {
                currentX += step;
                this.renderFighterOnBattleCanvas(attacker, currentX, y, 0.3, !isPlayerAttacking);
                
                // Update and draw particles
                particles.forEach((particle, index) => {
                    particle.x += particle.vx;
                    particle.y += particle.vy;
                    particle.life -= particle.decay;
                    
                    if (particle.life > 0) {
                        this.battleCtx.save();
                        this.battleCtx.globalAlpha = particle.life;
                        this.battleCtx.fillStyle = particle.color;
                        this.battleCtx.beginPath();
                        this.battleCtx.arc(particle.x, particle.y, 3, 0, Math.PI * 2);
                        this.battleCtx.fill();
                        this.battleCtx.restore();
                    }
                });
                
                requestAnimationFrame(animate);
            } else {
                // Attack impact effect
                this.createImpactEffect(endX, y);
                
                // Attack animation complete, return to position
                setTimeout(() => {
                    this.renderFighterOnBattleCanvas(attacker, startX, y, 0.3, !isPlayerAttacking);
                }, 300);
            }
        };
        
        animate();
    }

    createImpactEffect(x, y) {
        // Create impact particles
        const impactParticles = [];
        for (let i = 0; i < 15; i++) {
            impactParticles.push({
                x: x + (Math.random() - 0.5) * 50,
                y: y + (Math.random() - 0.5) * 50,
                vx: (Math.random() - 0.5) * 15,
                vy: (Math.random() - 0.5) * 15,
                life: 1.0,
                decay: 0.03 + Math.random() * 0.04,
                color: `hsl(${Math.random() * 60 + 15}, 100%, 50%)` // Orange to red
            });
        }
        
        let frame = 0;
        const maxFrames = 30;
        
        const animateImpact = () => {
            frame++;
            
            // Update and draw impact particles
            impactParticles.forEach((particle) => {
                particle.x += particle.vx;
                particle.y += particle.vy;
                particle.life -= particle.decay;
                
                if (particle.life > 0) {
                    this.battleCtx.save();
                    this.battleCtx.globalAlpha = particle.life;
                    this.battleCtx.fillStyle = particle.color;
                    this.battleCtx.beginPath();
                    this.battleCtx.arc(particle.x, particle.y, 4, 0, Math.PI * 2);
                    this.battleCtx.fill();
                    this.battleCtx.restore();
                }
            });
            
            if (frame < maxFrames) {
                requestAnimationFrame(animateImpact);
            }
        };
        
        animateImpact();
    }

    animateSpecialAttack(attacker, defender, isPlayerAttacking) {
        const startX = isPlayerAttacking ? 150 : 650;
        const endX = isPlayerAttacking ? 650 : 150;
        const y = 200;
        
        let currentX = startX;
        const step = isPlayerAttacking ? 20 : -20;
        let specialParticles = [];
        let frame = 0;
        
        // Create special attack particles
        for (let i = 0; i < 30; i++) {
            specialParticles.push({
                x: startX,
                y: y + Math.random() * 120 - 60,
                vx: (Math.random() - 0.5) * 15,
                vy: (Math.random() - 0.5) * 15,
                life: 1.0,
                decay: 0.015 + Math.random() * 0.02,
                color: `hsl(${Math.random() * 120 + 180}, 100%, 50%)`, // Green to cyan
                size: 2 + Math.random() * 4
            });
        }
        
        const animate = () => {
            frame++;
            
            // Clear canvas
            this.battleCtx.clearRect(0, 0, this.battleCanvas.width, this.battleCanvas.height);
            
            // Transparent background - no background image
            // Canvas is already transparent, no need to draw anything
            
            // Draw enemy at fixed position
            this.renderFighterOnBattleCanvas(this.enemyFighter, 650, y, 0.3, true);
            
            // Draw player at fixed position
            this.renderFighterOnBattleCanvas(this.playerFighter, 150, y, 0.3, false);
            
            // Draw attacking fighter moving
            if (Math.abs(currentX - endX) > 5) {
                currentX += step;
                this.renderFighterOnBattleCanvas(attacker, currentX, y, 0.3, !isPlayerAttacking);
                
                // Update and draw special particles
                specialParticles.forEach((particle) => {
                    particle.x += particle.vx;
                    particle.y += particle.vy;
                    particle.life -= particle.decay;
                    
                    if (particle.life > 0) {
                        this.battleCtx.save();
                        this.battleCtx.globalAlpha = particle.life;
                        this.battleCtx.fillStyle = particle.color;
                        this.battleCtx.beginPath();
                        this.battleCtx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
                        this.battleCtx.fill();
                        
                        // Add glow effect
                        this.battleCtx.shadowColor = particle.color;
                        this.battleCtx.shadowBlur = 10;
                        this.battleCtx.beginPath();
                        this.battleCtx.arc(particle.x, particle.y, particle.size * 0.5, 0, Math.PI * 2);
                        this.battleCtx.fill();
                        this.battleCtx.restore();
                    }
                });
                
                requestAnimationFrame(animate);
            } else {
                // Special attack impact effect
                this.createSpecialImpactEffect(endX, y);
                
                // Attack animation complete, return to position
                setTimeout(() => {
                    this.renderFighterOnBattleCanvas(attacker, startX, y, 0.3, !isPlayerAttacking);
                }, 500);
            }
        };
        
        animate();
    }

    createSpecialImpactEffect(x, y) {
        // Create special impact particles
        const specialImpactParticles = [];
        for (let i = 0; i < 25; i++) {
            specialImpactParticles.push({
                x: x + (Math.random() - 0.5) * 80,
                y: y + (Math.random() - 0.5) * 80,
                vx: (Math.random() - 0.5) * 20,
                vy: (Math.random() - 0.5) * 20,
                life: 1.0,
                decay: 0.02 + Math.random() * 0.03,
                color: `hsl(${Math.random() * 60 + 300}, 100%, 50%)`, // Purple to blue
                size: 3 + Math.random() * 6
            });
        }
        
        let frame = 0;
        const maxFrames = 45;
        
        const animateSpecialImpact = () => {
            frame++;
            
            // Update and draw special impact particles
            specialImpactParticles.forEach((particle) => {
                particle.x += particle.vx;
                particle.y += particle.vy;
                particle.life -= particle.decay;
                
                if (particle.life > 0) {
                    this.battleCtx.save();
                    this.battleCtx.globalAlpha = particle.life;
                    this.battleCtx.fillStyle = particle.color;
                    this.battleCtx.shadowColor = particle.color;
                    this.battleCtx.shadowBlur = 15;
                    this.battleCtx.beginPath();
                    this.battleCtx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
                    this.battleCtx.fill();
                    this.battleCtx.restore();
                }
            });
            
            if (frame < maxFrames) {
                requestAnimationFrame(animateSpecialImpact);
            }
        };
        
        animateSpecialImpact();
    }

    animateDefend() {
        if (!this.battleCtx) return;
        
        const playerX = 150;
        const playerY = 200;
        
        // Create shield emoji effect
        const shieldEmoji = '🛡️';
        const upArrowEmoji = '⬆️';
        
        let frame = 0;
        const maxFrames = 60;
        
        const animate = () => {
            if (frame >= maxFrames) return;
            
            // Clear the area around the player
            this.battleCtx.clearRect(playerX - 50, playerY - 100, 150, 120);
            
            // Redraw the player
            this.renderFighterOnBattleCanvas(this.playerFighter, playerX, playerY, 0.3, false);
            
            // Draw shield emoji
            this.battleCtx.font = '36px Arial';
            this.battleCtx.fillStyle = '#0066cc';
            this.battleCtx.textAlign = 'center';
            
            const shieldY = playerY - 80 + (frame * 0.5);
            const shieldOpacity = Math.sin(frame * 0.2) * 0.5 + 0.5;
            this.battleCtx.globalAlpha = shieldOpacity;
            this.battleCtx.fillText(shieldEmoji, playerX + 40, shieldY);
            
            // Draw up arrow emoji
            this.battleCtx.fillStyle = '#00cc00';
            const arrowY = playerY - 60 + (frame * 0.3);
            this.battleCtx.fillText(upArrowEmoji, playerX + 60, arrowY);
            
            this.battleCtx.globalAlpha = 1.0;
            
            frame++;
            requestAnimationFrame(animate);
        };
        
        animate();
    }

    animatePowerUp() {
        if (!this.battleCtx) return;
        
        const playerX = 150;
        const playerY = 200;
        
        // Create sword and up arrow emoji effect
        const swordEmoji = '⚔️';
        const upArrowEmoji = '⬆️';
        
        let frame = 0;
        const maxFrames = 60;
        
        const animate = () => {
            if (frame >= maxFrames) return;
            
            // Clear the area around the player
            this.battleCtx.clearRect(playerX - 50, playerY - 100, 150, 120);
            
            // Redraw the player
            this.renderFighterOnBattleCanvas(this.playerFighter, playerX, playerY, 0.3, false);
            
            // Draw sword emoji
            this.battleCtx.font = '36px Arial';
            this.battleCtx.fillStyle = '#ff6600';
            this.battleCtx.textAlign = 'center';
            
            const swordY = playerY - 80 + (frame * 0.5);
            const swordOpacity = Math.sin(frame * 0.2) * 0.5 + 0.5;
            this.battleCtx.globalAlpha = swordOpacity;
            this.battleCtx.fillText(swordEmoji, playerX + 40, swordY);
            
            // Draw up arrow emoji
            this.battleCtx.fillStyle = '#ffcc00';
            const arrowY = playerY - 60 + (frame * 0.3);
            this.battleCtx.fillText(upArrowEmoji, playerX + 60, arrowY);
            
            this.battleCtx.globalAlpha = 1.0;
            
            frame++;
            requestAnimationFrame(animate);
        };
        
        animate();
    }

    animateBonklerBeam() {
        if (!this.battleCtx) return;
        
        const playerX = 150;
        const playerY = 200;
        const enemyX = 650;
        const enemyY = 200;
        
        // Create beam effect
        const beamEmoji = '⚡';
        const explosionEmoji = '💥';
        
        let frame = 0;
        const maxFrames = 90;
        
        const animate = () => {
            if (frame >= maxFrames) return;
            
            // Clear the entire battle area
            this.battleCtx.clearRect(0, 0, this.battleCanvas.width, this.battleCanvas.height);
            
            // Redraw fighters
            this.renderFighterOnBattleCanvas(this.playerFighter, playerX, playerY, 0.3, false);
            this.renderFighterOnBattleCanvas(this.enemyFighter, enemyX, enemyY, 0.3, true);
            
            // Draw beam effect
            this.battleCtx.font = '48px Arial';
            this.battleCtx.fillStyle = '#ff0000';
            this.battleCtx.textAlign = 'center';
            
            // Beam travels from player to enemy
            const progress = frame / maxFrames;
            const beamX = playerX + (enemyX - playerX) * progress;
            const beamY = playerY + (enemyY - playerY) * progress;
            
            // Beam opacity and size
            const beamOpacity = Math.sin(frame * 0.3) * 0.5 + 0.5;
            this.battleCtx.globalAlpha = beamOpacity;
            this.battleCtx.fillText(beamEmoji, beamX, beamY);
            
            // Add explosion effect at enemy when beam hits
            if (progress > 0.8) {
                this.battleCtx.fillStyle = '#ffff00';
                this.battleCtx.font = '36px Arial';
                this.battleCtx.fillText(explosionEmoji, enemyX, enemyY - 50);
            }
            
            this.battleCtx.globalAlpha = 1.0;
            
            frame++;
            requestAnimationFrame(animate);
        };
        
        animate();
    }

    renderBattle() {
        if (!this.battleCtx) return;
        
        // Clear canvas
        this.battleCtx.clearRect(0, 0, this.battleCanvas.width, this.battleCanvas.height);
        
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
            const healthPercentage = (character.health / character.maxHealth) * 100;
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
        
        // Show/hide special button based on level
        const specialBtn = document.getElementById('special-btn');
        if (specialBtn) {
            if (this.level >= 5) {
                specialBtn.style.display = 'block';
            } else {
                specialBtn.style.display = 'none';
            }
        }
        
        // Show/hide beam button based on level
        const beamBtn = document.getElementById('bonkler-beam-btn');
        if (beamBtn) {
            if (this.level >= 10) {
                beamBtn.style.display = 'block';
            } else {
                beamBtn.style.display = 'none';
            }
        }
    }

    disableBattleControls() {
        document.querySelectorAll('.battle-btn').forEach(btn => {
            btn.disabled = true;
        });
    }

    performSlash() {
        if (!this.currentBattle || this.currentBattle.turn !== 'player') return;

        // Apply power-up bonus if active
        let damageMultiplier = 1.0;
        if (this.battleState.powerUpActive) {
            damageMultiplier = 1.5;
            this.addBattleLogEntry(`Power-up bonus applied!`, 'power-up');
        }

        const damage = Math.floor(this.currentBattle.player.attack * (0.8 + Math.random() * 0.4) * damageMultiplier);
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

        this.battleState.powerUpCount++;
        this.addBattleLogEntry(`You power up! (${this.battleState.powerUpCount}/3)`, 'player-action');
        this.addBattleLogEntry(`Attack strength increased for the rest of battle!`, 'power-up');
        
        // Activate power-up for the rest of battle
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
        this.addBattleLogEntry(`Defense increased for the rest of battle!`, 'defend');
        
        // Activate defense boost for the rest of battle
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
        this.addBattleLogEntry(`70% chance to dodge next attack!`, 'dodge');
        
        // Activate dodge for next enemy attack
        this.battleState.dodgeActive = true;
        this.showBattleEffect('dodge', 0);
        
        this.currentBattle.turn = 'enemy';
        this.addBattleLogEntry(`Enemy's turn...`, 'enemy-action');
        setTimeout(() => this.enemyTurn(), 1000);
    }

    performSpecial() {
        if (!this.currentBattle || this.currentBattle.turn !== 'player') return;

        // Check if player is level 5 or higher
        if (this.level < 5) {
            this.addBattleLogEntry(`Special attack requires level 5!`, 'battle-event');
            return;
        }
        
        // Check if player has powered up 3 times
        if (this.battleState.powerUpCount < 3) {
            this.addBattleLogEntry(`Special attack requires 3 power-ups! (${this.battleState.powerUpCount}/3)`, 'battle-event');
            return;
        }
        
        // Perform the special attack
        const damage = Math.floor(this.currentBattle.player.attack * (2.0 + Math.random() * 1.0));
        this.currentBattle.enemy.health = Math.max(0, this.currentBattle.enemy.health - damage);
        
        this.addBattleLogEntry(`You unleash a devastating special attack!`, 'player-action');
        this.addBattleLogEntry(`Dealt ${damage} damage!`, 'damage');
        
        // Reset power-up count after using special
        this.battleState.powerUpCount = 0;
        
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

        // Check if player is level 10 or higher
        if (this.level < 10) {
            this.addBattleLogEntry(`Bonkler Beam requires level 10!`, 'battle-event');
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
        
        // Calculate damage based on opponent's stats (up to 56% of max health)
        const maxDamagePercent = 0.56;
        const enemyMaxHealth = this.currentBattle.enemy.maxHealth;
        const baseDamage = Math.floor(enemyMaxHealth * maxDamagePercent);
        
        // Adjust damage based on enemy defense
        const defenseFactor = Math.max(0.3, 1 - (this.currentBattle.enemy.defense / 100));
        const finalDamage = Math.floor(baseDamage * defenseFactor);
        
        // Apply damage
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

    enemyTurn() {
        if (!this.currentBattle) return;

        console.log('Enemy turn started');
        console.log('Current battle state:', this.currentBattle);
        
        const actions = ['attack', 'special', 'defend'];
        const action = actions[Math.floor(Math.random() * actions.length)];
        
        console.log('Enemy turn - Action:', action, 'Enemy attack:', this.currentBattle.enemy.attack);
        
        let damage = 0;
        if (action === 'attack') {
            damage = Math.floor(this.currentBattle.enemy.attack * (0.8 + Math.random() * 0.4));
            console.log('Enemy attack damage:', damage);
            this.addBattleLogEntry(`Enemy attacks!`, 'enemy-action');
        } else if (action === 'special') {
            damage = Math.floor(this.currentBattle.enemy.attack * (1.2 + Math.random() * 0.6));
            console.log('Enemy special damage:', damage);
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
            damage = Math.floor(damage * 0.5); // Reduce damage by 50%
            this.addBattleLogEntry(`Defense bonus reduced damage!`, 'defend');
        }
        
        // Always show some effect for enemy actions
        if (action === 'defend') {
            // Enemy defends - no damage but show effect
            console.log('Enemy defends');
            this.addBattleLogEntry(`Enemy takes a defensive stance!`, 'enemy-action');
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
        
        // Hide battle arena
        document.getElementById('battle-arena').style.display = 'none';
        
        // Calculate rewards
        let expReward = 0;
        let coinReward = 0;
        
        if (result === 'victory') {
            expReward = 50 + (this.currentBattle.enemy.level * 10);
            coinReward = 25 + (this.currentBattle.enemy.level * 5);
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
            expReward = 10;
            this.addExp(expReward);
            
            // Update player stats
            this.playerStats.losses++;
            this.playerStats.battlesLost++;
            this.playerStats.totalExp += expReward;
        }
        
        // Save player stats and update leaderboard
        this.savePlayerStats();
        this.updateLeaderboard();
        
        // Show battle result
        this.showBattleResult(result, expReward, coinReward);
        
        this.currentBattle = null;
    }

    showBattleResult(result, expReward, coinReward) {
        const modal = document.getElementById('battle-result-modal');
        const resultTitle = document.getElementById('result-title');
        const resultContent = document.getElementById('result-content');
        
        if (result === 'victory') {
            resultTitle.textContent = 'Victory!';
            resultContent.innerHTML = `
                <div class="result-icon victory">🏆</div>
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
                <div class="result-icon defeat">💀</div>
                <div class="result-title">You Lost!</div>
                <div class="rewards">
                    <div class="reward-item">
                        <span class="reward-label">Experience:</span>
                        <span class="reward-value">+${expReward}</span>
                    </div>
                </div>
            `;
        } else {
            resultTitle.textContent = 'Time Out';
            resultContent.innerHTML = `
                <div class="result-icon defeat">⏰</div>
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
        
        // Auto close after 3 seconds
        setTimeout(() => {
            modal.classList.remove('active');
        }, 3000);
    }

    // Shop System
    populateShop(category = 'weapons') {
        const shopItems = document.getElementById('shop-items');
        shopItems.innerHTML = '';

        const shopData = {
            pilots: [
                { name: 'Alien Milady', type: 'pilot', attack: 6, cost: 600, icon: '👤', asset: 'ALIEN-MILADY.png' },
                { name: 'Binky', type: 'pilot', attack: 4, cost: 400, icon: '👤', asset: 'BINKY.png' },
                { name: 'Beauty Beast Bunny', type: 'pilot', attack: 7, cost: 700, icon: '👤', asset: 'BEAUTY-BEAST-BUNNY.png' },
                { name: 'Black Frost', type: 'pilot', attack: 8, cost: 800, icon: '👤', asset: 'BLACK-FROST.png' },
                { name: 'Bonk Bat', type: 'pilot', attack: 9, cost: 900, icon: '👤', asset: 'BONK-BAT.png' },
                { name: 'Charlie\'s Dog', type: 'pilot', attack: 5, cost: 500, icon: '👤', asset: 'CHARLIE\'S-DOG.png' },
                { name: 'Dancing Man Emoji', type: 'pilot', attack: 3, cost: 300, icon: '👤', asset: 'DANCING-MAN-EMOJI.png' },
                { name: 'Dr Kawashima', type: 'pilot', attack: 6, cost: 600, icon: '👤', asset: 'DR-KAWASHIMA.png' },
                { name: 'Guitar Bear', type: 'pilot', attack: 7, cost: 700, icon: '👤', asset: 'GUITAR-BEAR.png' },
                { name: 'Hamtaro', type: 'pilot', attack: 5, cost: 500, icon: '👤', asset: 'HAMTARO.png' },
                { name: 'Kasane Teto', type: 'pilot', attack: 8, cost: 800, icon: '👤', asset: 'KASANE-TETO.png' },
                { name: 'Maple Story', type: 'pilot', attack: 10, cost: 1000, icon: '👤', asset: 'MAPLE-STORY.png' },
                { name: 'Mew', type: 'pilot', attack: 9, cost: 900, icon: '👤', asset: 'MEW.png' },
                { name: 'Milady', type: 'pilot', attack: 6, cost: 600, icon: '👤', asset: 'MILADY.png' },
                { name: 'Minifig', type: 'pilot', attack: 4, cost: 400, icon: '👤', asset: 'MINIFIG.png' },
                { name: 'Neko', type: 'pilot', attack: 5, cost: 500, icon: '👤', asset: 'NEKO.png' },
                { name: 'Okshia Mikan', type: 'pilot', attack: 7, cost: 700, icon: '👤', asset: 'OKSHIA-MIKAN-UWASA-FRUIT-JUICER.png' },
                { name: 'Pikmin', type: 'pilot', attack: 6, cost: 600, icon: '👤', asset: 'PIKMIN.png' },
                { name: 'Rei', type: 'pilot', attack: 5, cost: 500, icon: '👤', asset: 'REI.png' },
                { name: 'Rover', type: 'pilot', attack: 7, cost: 700, icon: '👤', asset: 'ROVER.png' },
                { name: 'Shakoki Dogu', type: 'pilot', attack: 8, cost: 800, icon: '👤', asset: 'SHAKOKI-DOGU.png' },
                { name: 'Snoopy Plush', type: 'pilot', attack: 4, cost: 400, icon: '👤', asset: 'SNOOPY-PLUSH.png' },
                { name: 'Sprite Autograph', type: 'pilot', attack: 3, cost: 300, icon: '👤', asset: 'SPRITE-AUTOGRAPH.png' },
                { name: 'Stuart', type: 'pilot', attack: 6, cost: 600, icon: '👤', asset: 'STUART.png' },
                { name: 'Tivo', type: 'pilot', attack: 8, cost: 800, icon: '👤', asset: 'TIVO.png' },
                { name: 'Wolfie', type: 'pilot', attack: 5, cost: 500, icon: '👤', asset: 'WOLFIE.png' },
                { name: 'Zatsune Miku', type: 'pilot', attack: 9, cost: 900, icon: '👤', asset: 'ZATSUNE-MIKU.png' }
            ],
            bodies: [
                { name: 'Another Freaking Machine', type: 'body', defense: 12, cost: 500, icon: '🤖', asset: 'ANOTHER-FREAKING-MACHINE.png' },
                { name: 'Beetle', type: 'body', defense: 8, cost: 300, icon: '🪲', asset: 'BEETLE.png' },
                { name: 'BRG Vol1', type: 'body', defense: 10, cost: 400, icon: '📚', asset: 'BRG-VOL1.png' },
                { name: 'Burger Bonk Laser', type: 'body', defense: 15, cost: 600, icon: '🍔', asset: 'BURGER-BONK-LASER.png' },
                { name: 'Burner Phone', type: 'body', defense: 6, cost: 250, icon: '📱', asset: 'BURNER-PHONE.png' },
                { name: 'Chinese Sprite', type: 'body', defense: 11, cost: 450, icon: '🥤', asset: 'CHINESE-SPRITE.png' },
                { name: 'Cosmic Ray Detectors', type: 'body', defense: 18, cost: 700, icon: '🔬', asset: 'COSMIC-RAY-DETECTORS.png' },
                { name: 'Dark Magician Girl', type: 'body', defense: 14, cost: 550, icon: '🃏', asset: 'DARK-MAGICIAN-GIRL.png' },
                { name: 'Fire Bonk Laser', type: 'body', defense: 16, cost: 650, icon: '🔥', asset: 'FIRE-BONKER-LASER.png' },
                { name: 'Fragile Hearts', type: 'body', defense: 9, cost: 350, icon: '💔', asset: 'FRAGILE-HEARTS.png' },
                { name: 'Guam', type: 'body', defense: 7, cost: 280, icon: '🏝️', asset: 'GUAM.png' },
                { name: 'Harajuku Motorola', type: 'body', defense: 8, cost: 320, icon: '📱', asset: 'HARAJUKU-MOTOROLA.png' },
                { name: 'Jacob Jensen', type: 'body', defense: 9, cost: 360, icon: '👨‍💼', asset: 'JACOB-JENSEN.png' },
                { name: 'Jade Cabbage', type: 'body', defense: 13, cost: 520, icon: '🥬', asset: 'JADE-CABBAGE.png' },
                { name: 'Judd Chair', type: 'body', defense: 5, cost: 200, icon: '🪑', asset: 'JUDD-CHAIR.png' },
                { name: 'Lego Skeleton', type: 'body', defense: 7, cost: 290, icon: '🦴', asset: 'LEGO-SKELETON.png' },
                { name: 'Noctua Heatsink', type: 'body', defense: 10, cost: 410, icon: '❄️', asset: 'NOCTUA-HEATSINK.png' },
                { name: 'Orion Can', type: 'body', defense: 17, cost: 680, icon: '🥫', asset: 'ORION-CAN.png' },
                { name: 'Pelican Terminal', type: 'body', defense: 15, cost: 580, icon: '💻', asset: 'PELICAN-TERMINAL.png' },
                { name: 'Red and Blue Chair', type: 'body', defense: 6, cost: 240, icon: '🪑', asset: 'RED-AND-BLUE-CHAIR.png' },
                { name: 'Rei Lighter', type: 'body', defense: 8, cost: 330, icon: '🔥', asset: 'REI-LIGHTER.png' },
                { name: 'Rilakkuma', type: 'body', defense: 8, cost: 300, icon: '🐻', asset: 'RILAKKUMA.png' },
                { name: 'Rug Pull', type: 'body', defense: 19, cost: 750, icon: '🏃', asset: 'RUG-PULL.png' },
                { name: 'Rummikub', type: 'body', defense: 9, cost: 340, icon: '🎲', asset: 'RUMMIKUB.png' },
                { name: 'Sony CD Player', type: 'body', defense: 6, cost: 260, icon: '💿', asset: 'SONY-CD-PLAYER.png' },
                { name: 'Sony Pocket Station', type: 'body', defense: 7, cost: 270, icon: '🎮', asset: 'SONY-POCKET-STATION.png' },
                { name: 'Sony Tablet', type: 'body', defense: 8, cost: 310, icon: '📱', asset: 'SONY-TABLET.png' },
                { name: 'Sony TV', type: 'body', defense: 12, cost: 500, icon: '📺', asset: 'SONY-TV.png' },
                { name: 'Suit', type: 'body', defense: 10, cost: 400, icon: '👔', asset: 'SUIT.png' },
                { name: 'Tekken King', type: 'body', defense: 15, cost: 600, icon: '👑', asset: 'TEKKEN-KING.png' },
                { name: 'Valet Chair', type: 'body', defense: 5, cost: 220, icon: '🪑', asset: 'VALET-CHAIR.png' },
                { name: 'Vending Machine', type: 'body', defense: 11, cost: 460, icon: '🥤', asset: 'VENDING-MACHINE.png' },
                { name: 'YMO Tour', type: 'body', defense: 14, cost: 560, icon: '🎵', asset: 'YMO-TOUR.png' }
            ],

            armors: [
                { name: 'Adamantine Armor', type: 'armor', defense: 25, cost: 1000, icon: '🛡️', asset: 'ArmorAdamantine.png' },
                { name: 'Black Armor', type: 'armor', defense: 18, cost: 400, icon: '🛡️', asset: 'ArmorBlack.png' },
                { name: 'Black Trim Armor', type: 'armor', defense: 20, cost: 500, icon: '🛡️', asset: 'ArmorBlack-Trim.png' },
                { name: 'Bronze Armor', type: 'armor', defense: 12, cost: 300, icon: '🛡️', asset: 'ArmorBronze.png' },
                { name: 'Bronze Trim Armor', type: 'armor', defense: 14, cost: 350, icon: '🛡️', asset: 'ArmorBronze-Trim.png' },
                { name: 'Coal Armor', type: 'armor', defense: 10, cost: 250, icon: '🛡️', asset: 'ArmorCoal.png' },
                { name: 'Comme Des Garcons Armor', type: 'armor', defense: 30, cost: 1200, icon: '🛡️', asset: 'ArmorComme-Des-Garcons-Homme-Plus-FW18-Dover-Street-Market-Installation-Dinosaur-Bones.png' },
                { name: 'Dragon Armor', type: 'armor', defense: 28, cost: 1100, icon: '🛡️', asset: 'ArmorDragon.png' },
                { name: 'Glory Armor', type: 'armor', defense: 35, cost: 1500, icon: '🛡️', asset: 'ArmorGlory.png' },
                { name: 'Handycam Armor', type: 'armor', defense: 22, cost: 600, icon: '🛡️', asset: 'ArmorHandycam.png' },
                { name: 'Harajuku Sticker Armor', type: 'armor', defense: 16, cost: 450, icon: '🛡️', asset: 'ArmorHarajuku-Sticker.png' },
                { name: 'Jade Armor', type: 'armor', defense: 25, cost: 800, icon: '🛡️', asset: 'ArmorJade.png' },
                { name: 'Mithril Armor', type: 'armor', defense: 26, cost: 900, icon: '🛡️', asset: 'ArmorMithril.png' },
                { name: 'Mithril Trim Armor', type: 'armor', defense: 28, cost: 950, icon: '🛡️', asset: 'ArmorMithril-Trim.png' },
                { name: 'Phantom Armor', type: 'armor', defense: 15, cost: 380, icon: '🛡️', asset: 'ArmorPhantom.png' },
                { name: 'Steel Armor', type: 'armor', defense: 20, cost: 500, icon: '🛡️', asset: 'ArmorSteel.png' },
                { name: 'Steel Trim Armor', type: 'armor', defense: 22, cost: 550, icon: '🛡️', asset: 'ArmorSteel-Trim.png' },
                { name: 'Terminator Armor', type: 'armor', defense: 32, cost: 1300, icon: '🛡️', asset: 'ArmorTerminator.png' },
                { name: 'Terminator Recolor Armor', type: 'armor', defense: 30, cost: 1250, icon: '🛡️', asset: 'ArmorTerminator-Recolor.png' },
                { name: 'White Armor', type: 'armor', defense: 15, cost: 300, icon: '🛡️', asset: 'ArmorWhite.png' },
                { name: 'White Trim Armor', type: 'armor', defense: 17, cost: 350, icon: '🛡️', asset: 'ArmorWhite-Trim.png' }
            ],
            hands: [
                { name: 'Aghanim Scepter', type: 'hand', attack: 8, cost: 600, icon: '⚔️', asset: 'AGHANIM-SCEPTER.png' },
                { name: 'American Flag', type: 'hand', attack: 3, cost: 200, icon: '🇺🇸', asset: 'AMERICAN-FLAG.png' },
                { name: 'Ancient Godsword', type: 'hand', attack: 12, cost: 800, icon: '⚔️', asset: 'ANCIENT-GODSWORD.png' },
                { name: 'Ape Escape Net', type: 'hand', attack: 6, cost: 400, icon: '🕸️', asset: 'APE-ESCAPE-NET.png' },
                { name: 'Armed Threat', type: 'hand', attack: 7, cost: 500, icon: '🔫', asset: 'ARMED-THREAT.png' },
                { name: 'Atarashiki Mura', type: 'hand', attack: 5, cost: 350, icon: '🏘️', asset: 'ATARASHIKI-MURA.png' },
                { name: 'Balloon', type: 'hand', attack: 2, cost: 150, icon: '🎈', asset: 'BALLOON.png' },
                { name: 'Bionicle Axe', type: 'hand', attack: 4, cost: 300, icon: '⚔️', asset: 'BIONICLE-AXE.png' },
                { name: 'Blade of the Immortal', type: 'hand', attack: 9, cost: 650, icon: '⚔️', asset: 'BLADE-OF-THE-IMMORTAL.png' },
                { name: 'Bludgeoning Angel', type: 'hand', attack: 6, cost: 420, icon: '👼', asset: 'BLUDGEONING-ANGEL.png' },
                { name: 'Boom Mic', type: 'hand', attack: 3, cost: 220, icon: '🎤', asset: 'BOOM-MIC.png' },
                { name: 'Cattle Gun', type: 'hand', attack: 8, cost: 580, icon: '🔫', asset: 'CATTLE-GUN.png' },
                { name: 'Dreamcast Fishing Controller', type: 'hand', attack: 4, cost: 280, icon: '🎮', asset: 'DREAMCAST-FISHING-CONTROLLER.png' },
                { name: 'Energy Sword', type: 'hand', attack: 7, cost: 480, icon: '⚔️', asset: 'ENERGY-SWORD.png' },
                { name: 'Evolved Antenna', type: 'hand', attack: 5, cost: 320, icon: '📡', asset: 'EVOLVED-ANTENNA.png' },
                { name: 'Golden Axe', type: 'hand', attack: 6, cost: 400, icon: '⚔️', asset: 'GOLDEN-AXE.png' },
                { name: 'Ikebana', type: 'hand', attack: 10, cost: 700, icon: '🌸', asset: 'IKEBANA.png' },
                { name: 'Insanity Catalyst', type: 'hand', attack: 5, cost: 340, icon: '💊', asset: 'INSANITY-CATALYST.png' },
                { name: 'Jordan', type: 'hand', attack: 8, cost: 550, icon: '👟', asset: 'JORDAN.png' },
                { name: 'K\'NEX', type: 'hand', attack: 6, cost: 420, icon: '🧱', asset: 'K\'NEX.png' },
                { name: 'Newjeans Hammer', type: 'hand', attack: 11, cost: 750, icon: '🔨', asset: 'NEWJEANS-HAMMER.png' },
                { name: 'Phone Flail', type: 'hand', attack: 7, cost: 480, icon: '📱', asset: 'PHONE-FLAIL.png' },
                { name: 'Porsche Suspension', type: 'hand', attack: 6, cost: 400, icon: '🚗', asset: 'PORSCHE-SUSPENSION.png' },
                { name: 'Ribbon Staff', type: 'hand', attack: 8, cost: 520, icon: '🎀', asset: 'RIBBON-STAFF.png' },
                { name: 'Sir Fetch\'d', type: 'hand', attack: 5, cost: 320, icon: '🐕', asset: 'SIR-FETCH\'D.png' },
                { name: 'Skylander Sword', type: 'hand', attack: 7, cost: 450, icon: '⚔️', asset: 'SKYLANDER-SWORD.png' },
                { name: 'Sly Cooper Cane', type: 'hand', attack: 4, cost: 280, icon: '🦝', asset: 'SLY-COOPER-CANE.png' },
                { name: 'Stygian Reaver', type: 'hand', attack: 12, cost: 850, icon: '⚔️', asset: 'STYGIAN-REAVER.png' },
                { name: 'Velvet Crowe', type: 'hand', attack: 13, cost: 900, icon: '⚔️', asset: 'VELVET-CROWE.png' },
                { name: 'Water Pistol', type: 'hand', attack: 3, cost: 200, icon: '🔫', asset: 'WATER-PISTOL.png' },
                { name: 'Winged Staff Gold', type: 'hand', attack: 9, cost: 650, icon: '⚔️', asset: 'WINGED-STAFF-GOLD.png' }
            ],
                         offhands: [
                 { name: 'Yen', type: 'offhand', attack: 2, cost: 150, icon: '💰', asset: 'YEN-store.png' },
                 { name: 'VAX Pass', type: 'offhand', attack: 3, cost: 200, icon: '🎫', asset: 'VAX-PASS-store.png' },
                 { name: 'Tornado', type: 'offhand', attack: 8, cost: 600, icon: '🌪️', asset: 'TORNADO-2-store.png' },
                 { name: 'Tokyo Manhole Cover', type: 'offhand', defense: 10, cost: 800, icon: '🕳️', asset: 'TOKYO-MANHOLE-COVER-store.png' },
                 { name: 'Teddy Bear Anniversary', type: 'offhand', defense: 5, cost: 200, icon: '🧸', asset: 'TEDDY-BEAR-ANNIVERSARY-store.png' },
                 { name: 'Super Lover Watch', type: 'offhand', attack: 4, cost: 300, icon: '⌚', asset: 'SUPER-LOVER-WATCH-store.png' },
                 { name: 'Submarine Cable', type: 'offhand', defense: 7, cost: 500, icon: '🔌', asset: 'SUBMARINE-CABLE-store.png' },
                 { name: 'Shooting Star', type: 'offhand', attack: 6, cost: 400, icon: '⭐', asset: 'SHOOTING-STAR-store.png' },
                 { name: 'RX-78', type: 'offhand', attack: 5, cost: 350, icon: '🤖', asset: 'RX-78-store.png' },
                 { name: 'Remilia Films', type: 'offhand', attack: 3, cost: 250, icon: '🎬', asset: 'REMILIA-FILMS-store.png' },
                 { name: 'Remilia Engineering', type: 'offhand', defense: 6, cost: 450, icon: '⚙️', asset: 'REMILIA-ENGINEERING-store.png' },
                 { name: 'Remilia Crest', type: 'offhand', defense: 4, cost: 300, icon: '🛡️', asset: 'REMILIA-CREST-store.png' },
                 { name: 'Quad Damage', type: 'offhand', attack: 9, cost: 700, icon: '💥', asset: 'QUAD-DAMAGE-store.png' },
                 { name: 'Rayman Shield', type: 'offhand', defense: 8, cost: 600, icon: '🛡️', asset: 'RAYMAN-M-STEAL-SHIELD-store.png' },
                 { name: 'Pokewalker', type: 'offhand', attack: 2, cost: 150, icon: '👟', asset: 'POKEWALKER-store.png' },
                 { name: 'Pocket Pet', type: 'offhand', attack: 1, cost: 100, icon: '🐾', asset: 'POCKET-PET-store.png' },
                 { name: 'Palette', type: 'offhand', attack: 3, cost: 200, icon: '🎨', asset: 'PALETTE-store.png' },
                 { name: 'Nautilus', type: 'offhand', defense: 5, cost: 350, icon: '🐚', asset: 'NAUTILUS-store.png' },
                 { name: 'Ketamine', type: 'offhand', attack: 7, cost: 550, icon: '💊', asset: 'KETAMINE-store.png' },
                 { name: 'Hauchiwa', type: 'offhand', defense: 9, cost: 750, icon: '🍃', asset: 'HAUCHIWA-store.png' },
                 { name: 'Hand Clock', type: 'offhand', defense: 2, cost: 120, icon: '⏰', asset: 'HAND-CLOCK-store.png' },
                 { name: 'Gutenberg Bible', type: 'offhand', defense: 6, cost: 400, icon: '📖', asset: 'GUTENBERG-BIBLE-store.png' },
                 { name: 'Game & Watch', type: 'offhand', attack: 4, cost: 280, icon: '🎮', asset: 'GAME-AND-WATCH-store.png' },
                 { name: 'Foobar', type: 'offhand', attack: 3, cost: 220, icon: '🎵', asset: 'FOOBAR-store.png' },
                 { name: 'G-Shock', type: 'offhand', defense: 3, cost: 100, icon: '⌚', asset: 'G-SHOCK-store.png' },
                 { name: 'FBI Badge', type: 'offhand', defense: 7, cost: 500, icon: '🕵️', asset: 'FBI-BADGE-store.png' },
                 { name: 'Final Fantasy', type: 'offhand', attack: 8, cost: 650, icon: '⚔️', asset: 'FINAL-FANTASY-store.png' },
                 { name: 'Daihatsu Midget', type: 'offhand', defense: 4, cost: 320, icon: '🚗', asset: 'DAIHATSU-MIDGET-store.png' },
                 { name: 'Dwarf Fortress Blueprint', type: 'offhand', defense: 3, cost: 180, icon: '📋', asset: 'DWARF-FORTRESS-GREEK-BEDROOM-BLUEPRINT-store.png' },
                 { name: 'Carlo Bugatti Chair', type: 'offhand', defense: 5, cost: 380, icon: '🪑', asset: 'CARLO-BUGATTI-CHAIR-store.png' },
                 { name: 'Clover', type: 'offhand', attack: 2, cost: 160, icon: '🍀', asset: 'CLOVER-store.png' },
                 { name: 'Cookie', type: 'offhand', attack: 1, cost: 80, icon: '🍪', asset: 'COOKIE-store.png' },
                 { name: 'Beetle Game', type: 'offhand', attack: 5, cost: 360, icon: '🪲', asset: 'BEETLE-GAME-store.png' },
                 { name: 'Beyblade', type: 'offhand', attack: 6, cost: 420, icon: '🌀', asset: 'BEYBLADE-store.png' },
                 { name: 'Briefcase', type: 'offhand', defense: 2, cost: 110, icon: '💼', asset: 'BREIFCASE-store.png' },
                 { name: 'Adventure of Cookie and Cream', type: 'offhand', attack: 4, cost: 290, icon: '🍪', asset: 'ADVENTURE-OF-COOKIE-AND-CREAM-store.png' },
                 { name: 'Amex Platinum', type: 'offhand', defense: 8, cost: 600, icon: '💳', asset: 'AMEX-PLATINUM-store.png' },
                 { name: 'Beat Happening', type: 'offhand', attack: 3, cost: 240, icon: '🎸', asset: 'BEAT-HAPPENING-store.png' },
                 { name: '48 Laws of Power', type: 'offhand', defense: 6, cost: 450, icon: '📚', asset: '48-LAWS-OF-POWER-store.png' }
             ],
            heads: [
                { name: 'Bonk', type: 'head', attack: 5, cost: 300, icon: '👤', asset: 'BONK.png' },
                { name: 'Evil Bonk', type: 'head', attack: 7, cost: 500, icon: '👤', asset: 'EVIL-BONK.png' },
                { name: 'Alien Bonk', type: 'head', attack: 8, cost: 600, icon: '👤', asset: 'ALIEN-BONK.png' },
                { name: 'Spirit', type: 'head', attack: 6, cost: 400, icon: '👤', asset: 'SPIRIT.png' },
                { name: 'White', type: 'head', attack: 4, cost: 250, icon: '👤', asset: 'WHITE.png' }
            ],
            accessories: [
                { name: 'Raver Cap', type: 'accessory', attack: 3, cost: 250, icon: '🎩', asset: 'RAVER-CAP.png' },
                { name: 'Halo', type: 'accessory', defense: 5, cost: 400, icon: '😇', asset: 'HALO.png' },
                { name: 'Droid', type: 'accessory', attack: 4, cost: 350, icon: '🤖', asset: 'DROID.png' },
                { name: 'BK', type: 'accessory', attack: 2, cost: 150, icon: '🍔', asset: 'BK.png' },
                { name: 'Hikkikomori', type: 'accessory', defense: 3, cost: 200, icon: '🏠', asset: 'HIKKIKOMORI.png' }
            ],
            skills: [
                { name: 'Slash', type: 'skill', cost: 0, icon: '⚔️', description: 'Basic light attack', unlocked: true },
                { name: 'Power-up', type: 'skill', cost: 0, icon: '⬆️', description: 'Increase attack strength', unlocked: true },
                { name: 'Defend', type: 'skill', cost: 0, icon: '🛡️', description: 'Increase defense', unlocked: true },
                { name: 'Dodge', type: 'skill', cost: 0, icon: '💨', description: '70% chance to dodge', unlocked: true },
                { name: 'Special', type: 'skill', cost: 500, icon: '⭐', description: 'Heavy attack (requires 3 power-ups)', unlocked: false },
                { name: 'Bonkler Beam', type: 'skill', cost: 1000, icon: '⚡', description: 'Devastating beam attack (65% hit rate)', unlocked: false },
                { name: 'Double Strike', type: 'skill', cost: 300, icon: '⚔️⚔️', description: 'Attack twice in one turn', unlocked: false },
                { name: 'Counter Attack', type: 'skill', cost: 400, icon: '🔄', description: 'Counter enemy attacks', unlocked: false },
                { name: 'Heal', type: 'skill', cost: 200, icon: '💚', description: 'Restore 30% health', unlocked: false },
                { name: 'Critical Strike', type: 'skill', cost: 600, icon: '💥', description: 'High chance of critical damage', unlocked: false }
            ]
        };

        const items = shopData[category] || [];
        
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
                    ${item.asset ? `<img src="${item.type === 'offhand' ? 'OFFHAND%20store' : item.type === 'accessory' ? 'store%20accessories' : item.type === 'pilot' ? 'store%20pilot' : item.type === 'body' ? 'BODIES' : item.type === 'armor' ? 'ARMORS' : item.type === 'hand' ? 'store%20hands' : item.type.toUpperCase()}/${item.asset}" alt="${item.name}" style="${item.type === 'accessory' || item.type === 'body' || item.type === 'armor' || item.type === 'hand' ? '' : 'width: 100%; height: 100%; object-fit: contain;'}">` : item.icon}
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
            const assetKey = item.type === 'hand' ? 'hands' : item.type + 's';
            if (!this.componentAssets[assetKey]) {
                this.componentAssets[assetKey] = [];
            }
            
            // Create component asset - convert store asset name to regular asset name
            let regularAssetName = item.asset;
            if (item.asset.includes('-store.png')) {
                regularAssetName = item.asset.replace('-store.png', '.png');
            }
            
            // Determine the correct folder path
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
            
            const componentAsset = {
                name: item.name,
                path: `${folderPath}/${regularAssetName}`,
                type: item.type,
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
            
            console.log('Item purchased:', purchasedItem);
            console.log('Total purchased items:', this.purchasedItems.length);
            
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
        this.populateShop();
        this.populateInventory();
        
        // Refresh purchased items in builder if it's currently visible
        if (document.querySelector('.fighter-builder-container').style.display !== 'none') {
            this.populatePurchasedItems();
        }
    }

    // Inventory System
    populateInventory() {
        this.populateInventoryNFTs();
        this.populateInventoryPurchased();
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
        
        // Carousel settings
        const itemsPerPage = 5;
        const totalPages = Math.ceil(this.userNFTs.length / itemsPerPage);
        
        // Create carousel pages
        for (let page = 0; page < totalPages; page++) {
            const pageContainer = document.createElement('div');
            pageContainer.className = 'carousel-page';
            pageContainer.style.display = 'flex';
            pageContainer.style.gap = '8px';
            pageContainer.style.minWidth = '100%';
            
            // Add NFTs for this page
            for (let i = 0; i < itemsPerPage; i++) {
                const nftIndex = page * itemsPerPage + i;
                if (nftIndex >= this.userNFTs.length) break;
                
                const nft = this.userNFTs[nftIndex];
                const nftCard = document.createElement('div');
                nftCard.className = 'nft-card';
                nftCard.dataset.nftId = nft.id;
                nftCard.style.flex = '1';
                nftCard.style.minWidth = '120px';
                
                // Add NFT indicator if it's an NFT
                const nftBadge = nft.isNFT ? `<div class="nft-badge">NFT</div>` : '';
                
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
                    <div class="nft-name">${nft.name}</div>
                    <div class="nft-description">${nft.description || ''}</div>
                    <div class="nft-stats">
                        <div>Level: ${nft.level}</div>
                        <div>Attack: ${nft.attack}</div>
                        <div>Defense: ${nft.defense}</div>
                        <div>Health: ${nft.health}/${nft.maxHealth}</div>
                        ${nft.tokenId ? `<div>Token ID: ${nft.tokenId}</div>` : ''}
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
                const indicator = document.createElement('div');
                indicator.className = 'carousel-indicator';
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
            backBtn.addEventListener('click', () => {
                this.showCarouselView();
            });
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
            prevBtn.addEventListener('click', () => {
                this.goToCarouselPage(this.currentCarouselPage - 1);
            });
        }
        
        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                this.goToCarouselPage(this.currentCarouselPage + 1);
            });
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
        
        const categories = ['bodies', 'armors', 'hands', 'offhands', 'heads', 'pilots', 'accessories'];
        
        categories.forEach(category => {
            const gridId = `purchased-${category}-grid`;
            const grid = document.getElementById(gridId);
            if (!grid) return;
            
            grid.innerHTML = '';
            
            // Get purchased items for this category
            const categoryItems = this.purchasedItems.filter(item => {
                const itemType = item.type === 'hand' ? 'hands' : item.type;
                return itemType === category.slice(0, -1); // Remove 's' from end
            });
            
            console.log(`Category ${category}:`, categoryItems);
            
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
                        imagePath = `OFFHAND/${item.asset}`;
                    } else if (item.type === 'head') {
                        imagePath = `HEADS/${item.asset}`;
                    } else if (item.type === 'pilot') {
                        imagePath = `PILOT/${item.asset}`;
                    } else if (item.type === 'accessory') {
                        imagePath = `ACCESSORIES/${item.asset}`;
                    }
                }
                
                itemElement.innerHTML = `
                    <img src="${imagePath}" alt="${item.name}">
                    <div class="purchased-item-name">${item.name}</div>
                    <button class="equip-btn" data-category="${item.type}" data-item="${item.name}">Equip</button>
                `;
                
                // Add click handler for equip button
                const equipBtn = itemElement.querySelector('.equip-btn');
                equipBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.equipItem(item);
                });
                
                grid.appendChild(itemElement);
            });
        });
    }

    equipItem(item) {
        if (!this.selectedNFT) {
            alert('Please select an NFT first');
            return;
        }
        
        // Update the builder components
        const category = item.type === 'hand' ? 'hands' : item.type;
        
        console.log(`Equipping ${item.name} to ${category}`);
        console.log('Item details:', item);
        console.log('Item path:', item.path);
        console.log('Selected NFT:', this.selectedNFT);
        
        // Create a new image and load it properly
        const image = new Image();
        image.crossOrigin = 'anonymous'; // Handle CORS if needed
        
        console.log('Attempting to load image from path:', item.path);
        
        image.onload = () => {
            console.log(`Image loaded successfully for ${item.name}:`, image.width, 'x', image.height);
            
            // Store the component with the loaded image
            this.builderComponents[category] = {
                name: item.name,
                path: item.path,
                image: image,
                attack: item.attack || 0,
                defense: item.defense || 0
            };
            
            console.log(`Stored component in builderComponents[${category}]:`, this.builderComponents[category]);
            
            // Immediately save the equipped component to the selected NFT
            if (this.selectedNFT) {
                if (!this.selectedNFT.components) {
                    this.selectedNFT.components = {};
                }
                this.selectedNFT.components[category] = {
                    name: item.name,
                    path: item.path,
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
                
                console.log(`Saved ${item.name} to NFT ${this.selectedNFT.name} components:`, this.selectedNFT.components);
            }
            

            
            // Re-render the NFT with the new component
            console.log('Re-rendering NFT with new component');
            this.renderNFTAsBase(this.selectedNFT);
            
            // Update the button text to show it's equipped
            const equipBtn = document.querySelector(`[data-item="${item.name}"]`);
            if (equipBtn) {
                equipBtn.textContent = 'Equipped';
                equipBtn.disabled = true;
            }
            
            console.log('Builder components after equip:', this.builderComponents);
            console.log(`Successfully equipped ${item.name} to ${category}`);
        };
        
        image.onerror = (error) => {
            console.error(`Failed to load image for ${item.name}:`, error);
            console.error('Image path:', item.path);
            
            // Still store the component but without image
            this.builderComponents[category] = {
                name: item.name,
                path: item.path,
                image: null,
                attack: item.attack || 0,
                defense: item.defense || 0
            };
            
            // Re-render anyway (will show placeholder)
            this.renderNFTAsBase(this.selectedNFT);
            
            // Update the button text
            const equipBtn = document.querySelector(`[data-item="${item.name}"]`);
            if (equipBtn) {
                equipBtn.textContent = 'Equipped';
                equipBtn.disabled = true;
            }
        };
        
        // Start loading the image
        image.src = item.path;
        
        console.log('Starting image load for:', item.path);
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
                
                // Ensure all component images are loaded
                Object.entries(this.builderComponents).forEach(([layer, component]) => {
                    if (component && component.path && !component.image) {
                        console.log(`Loading image for ${layer} component in builder view:`, component.name);
                        const image = new Image();
                        image.onload = () => {
                            console.log(`Image loaded for ${layer} component in builder view:`, component.name);
                            component.image = image;
                            // Re-render after image loads
                            this.renderNFTAsBase(this.selectedNFT);
                        };
                        image.onerror = (error) => {
                            console.error(`Failed to load image for ${layer} component in builder view:`, component.name, error);
                        };
                        image.src = component.path;
                    }
                });
            } else {
                // Use original NFT components if no customized ones exist
                const nftComponents = this.buildComponentsFromNFTMetadata(this.selectedNFT);
                this.builderComponents = nftComponents;
                console.log('Using original NFT components for builder view:', nftComponents);
            }
        }
        
        // Render the selected NFT in the builder
        if (this.selectedNFT) {
            this.renderNFTAsBase(this.selectedNFT);
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
        if (!purchasedGrid) return;
        
        purchasedGrid.innerHTML = '';
        
        if (this.purchasedItems.length === 0) {
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
            } else if (item.type === 'hand') {
                description = `Hand component with +${item.attack} attack`;
            } else if (item.type === 'offhand') {
                description = `Offhand component with +${item.attack || item.defense} ${item.attack ? 'attack' : 'defense'}`;
            } else if (item.type === 'accessory') {
                description = `Accessory component with +${item.attack || item.defense} ${item.attack ? 'attack' : 'defense'}`;
            }
            
            itemElement.innerHTML = `
                <div class="item-icon">
                    ${item.path ? `<img src="${item.path}" alt="${item.name}" style="width: 100%; height: 100%; object-fit: contain;">` : item.icon || '📦'}
                </div>
                <div class="item-name">${item.name}</div>
                <div class="item-description">${description}</div>
                <div class="item-price">Purchased</div>
            `;
            
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
            const icon = skillData ? skillData.icon : '⚔️';
            const description = skillData ? skillData.description : 'Skill';
            
            skillElement.innerHTML = `
                <div class="item-icon">
                    <div style="font-size: 48px; display: flex; align-items: center; justify-content: center; width: 100%; height: 100%;">${icon}</div>
                </div>
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
            const icon = skillData ? skillData.icon : '⚔️';
            const description = skillData ? skillData.description : 'Skill';
            
            skillElement.innerHTML = `
                <div class="item-icon">
                    <div style="font-size: 48px; display: flex; align-items: center; justify-content: center; width: 100%; height: 100%;">${icon}</div>
                </div>
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
            name: this.publicKey.substring(0, 8) + '...' + this.publicKey.substring(this.publicKey.length - 4),
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
        
        // Save to localStorage
        localStorage.setItem('bonkler_player_stats', JSON.stringify(playerData));
        
        // Update leaderboard data
        this.updateLeaderboardData(playerData);
    }
    
    updateLeaderboardData(playerData) {
        // Load existing leaderboard data
        const existingData = localStorage.getItem('bonkler_leaderboard');
        let leaderboardData = existingData ? JSON.parse(existingData) : [];
        
        // Find if player already exists
        const existingIndex = leaderboardData.findIndex(p => p.walletAddress === playerData.walletAddress);
        
        if (existingIndex !== -1) {
            // Update existing player
            leaderboardData[existingIndex] = { ...leaderboardData[existingIndex], ...playerData };
        } else {
            // Add new player
            leaderboardData.push(playerData);
        }
        
        // Sort by total experience (descending)
        leaderboardData.sort((a, b) => b.totalExp - a.totalExp);
        
        // Keep only top 100 players
        leaderboardData = leaderboardData.slice(0, 100);
        
        // Save updated leaderboard
        localStorage.setItem('bonkler_leaderboard', JSON.stringify(leaderboardData));
        this.leaderboardData = leaderboardData;
    }
    
    updateLeaderboard() {
        // Load current leaderboard data
        const existingData = localStorage.getItem('bonkler_leaderboard');
        this.leaderboardData = existingData ? JSON.parse(existingData) : [];
        
        // Update the display
        this.populateLeaderboard(this.currentLeaderboardTab);
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
                    <div class="player-avatar">👤</div>
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
        document.getElementById('modal-title').textContent = title;
        document.getElementById('modal-content').textContent = content;
        document.getElementById('modal-overlay').classList.add('active');
    }

    closeModal() {
        document.getElementById('modal-overlay').classList.remove('active');
    }

    // Loading Screen Methods
    startLoadingScreen() {
        this.loadingProgress = 0;
        this.assetIndex = 0;
        this.loadingBonklers = [];
        
        // Generate random Bonklers for loading screen
        this.generateLoadingBonklers();
        
        this.cycleAssetPreview();
    }

    generateLoadingBonklers() {
        // Available components for random generation
        const components = {
            pilot: ['WOLFIE', 'ALIEN-MILADY', 'BEAUTY-BEAST-BUNNY', 'BINKY', 'BLACK-FROST', 'BONK-BAT', 'CHARLIE\'S-DOG', 'DANCING-MAN-EMOJI', 'DR-KAWASHIMA', 'GUITAR-BEAR', 'HAMTARO', 'KASANE-TETO', 'MAPLE-STORY', 'MEW', 'MILADY', 'MINIFIG', 'NEKO', 'OKSHIA-MIKAN-UWASA-FRUIT-JUICER', 'PIKMIN', 'REI', 'ROVER', 'SHAKOKI-DOGU', 'SNOOPY-PLUSH', 'SPRITE-AUTOGRAPH', 'STUART', 'TIVO', 'ZATSUNE-MIKU'],
            body: ['ANOTHER-FREAKING-MACHINE', 'BEETLE', 'BRG-VOL1', 'BURGER-BONK-LASER', 'BURNER-PHONE', 'CHINESE-SPRITE', 'COSMIC-RAY-DETECTORS', 'DARK-MAGICIAN-GIRL', 'FIRE-BONKER-LASER', 'FRAGILE-HEARTS', 'GUAM', 'HARAJUKU-MOTOROLA', 'JACOB-JENSEN', 'JADE-CABBAGE', 'JUDD-CHAIR', 'LEGO-SKELETON', 'NOCTUA-HEATSINK', 'ORION-CAN', 'PELICAN-TERMINAL', 'RED-AND-BLUE-CHAIR', 'REI-LIGHTER', 'RILAKKUMA', 'RUG-PULL', 'RUMMIKUB', 'SONY-CD-PLAYER', 'SONY-POCKET-STATION', 'SONY-TABLET', 'SONY-TV', 'SUIT', 'TEKKEN-KING', 'VALET-CHAIR', 'VENDING-MACHINE', 'YMO-TOUR'],
            armor: ['ArmorAdamantine', 'ArmorBlack', 'ArmorBlack-Trim', 'ArmorBronze', 'ArmorBronze-Trim', 'ArmorCoal', 'ArmorComme-Des-Garcons-Homme-Plus-FW18-Dover-Street-Market-Installation-Dinosaur-Bones', 'ArmorDragon', 'ArmorGlory', 'ArmorHandycam', 'ArmorHarajuku-Sticker', 'ArmorJade', 'ArmorMithril', 'ArmorMithril-Trim', 'ArmorPhantom', 'ArmorSteel', 'ArmorSteel-Trim', 'ArmorTerminator', 'ArmorTerminator-Recolor', 'ArmorWhite', 'ArmorWhite-Trim'],
            hands: ['AGHANIM-SCEPTER', 'AMERICAN-FLAG', 'ANCIENT-GODSWORD', 'APE-ESCAPE-NET', 'ARMED-THREAT', 'ATARASHIKI-MURA', 'BALLOON', 'BIONICLE-AXE', 'BLADE-OF-THE-IMMORTAL', 'BLUDGEONING-ANGEL', 'BOOM-MIC', 'CATTLE-GUN', 'DREAMCAST-FISHING-CONTROLLER', 'ENERGY-SWORD', 'EVOLVED-ANTENNA', 'GOLDEN-AXE', 'IKEBANA', 'INSANITY-CATALYST', 'JORDAN', 'K\'NEX', 'NEWJEANS-HAMMER', 'PHONE-FLAIL', 'PORSCHE-SUSPENSION', 'RIBBON-STAFF', 'SIR-FETCH\'D', 'SKYLANDER-SWORD', 'SLY-COOPER-CANE', 'STYGIAN-REAVER', 'VELVET-CROWE', 'WATER-PISTOL', 'WINGED-STAFF-GOLD'],
            offhand: ['48-LAWS-OF-POWER', 'ADVENTURE-OF-COOKIE-AND-CREAM', 'AMEX-PLATINUM', 'BEAT-HAPPENING', 'BEETLE-GAME', 'BEYBLADE', 'BREIFCASE', 'CARLO-BUGATTI-CHAIR', 'CLOVER', 'COOKIE', 'DAIHATSU-MIDGET', 'DWARF-FORTRESS-GREEK-BEDROOM-BLUEPRINT', 'FBI-BADGE', 'FINAL-FANTASY', 'FOOBAR', 'G-SHOCK', 'GAME-AND-WATCH', 'GUTENBERG-BIBLE', 'HAND-CLOCK', 'HAUCHIWA', 'KETAMINE', 'NAUTILUS', 'PALETTE', 'POCKET-PET', 'POKEWALKER', 'QUAD-DAMAGE', 'RAYMAN-M-STEAL-SHIELD', 'REMILIA-CREST', 'REMILIA-ENGINEERING', 'REMILIA-FILMS', 'RX-78', 'SHOOTING-STAR', 'SUBMARINE-CABLE', 'SUPER-LOVER-WATCH', 'TEDDY-BEAR-ANNIVERSARY', 'TOKYO-MANHOLE-COVER', 'TORNADO-2', 'VAX-PASS', 'YEN'],
            accessory: ['BK', 'DROID', 'HALO', 'HIKKIKOMORI', 'RAVER-CAP'],
            head: ['ALIEN-BONK', 'BONK', 'EVIL-BONK', 'SPIRIT', 'WHITE']
        };

        // Generate 5 random Bonklers
        for (let i = 0; i < 5; i++) {
            const randomBonkler = {
                pilot: components.pilot[Math.floor(Math.random() * components.pilot.length)],
                body: components.body[Math.floor(Math.random() * components.body.length)],
                armor: components.armor[Math.floor(Math.random() * components.armor.length)],
                hands: components.hands[Math.floor(Math.random() * components.hands.length)],
                offhand: components.offhand[Math.floor(Math.random() * components.offhand.length)],
                accessory: components.accessory[Math.floor(Math.random() * components.accessory.length)],
                head: components.head[Math.floor(Math.random() * components.head.length)]
            };
            this.loadingBonklers.push(randomBonkler);
        }
    }

    updateLoadingProgress(progress, text) {
        this.loadingProgress = progress;
        
        // Update loading bar
        const loadingBarFill = document.getElementById('loading-bar-fill');
        const loadingText = document.getElementById('loading-text');
        const loadingTip = document.getElementById('loading-tip');
        
        if (loadingBarFill) {
            loadingBarFill.style.width = `${progress}%`;
        }
        
        if (loadingText) {
            loadingText.textContent = `${progress}%`;
        }
        
        if (loadingTip) {
            loadingTip.textContent = text;
        }
    }

    cycleAssetPreview() {
        if (this.assetIndex >= this.loadingBonklers.length) {
            this.assetIndex = 0;
        }
        
        const bonkler = this.loadingBonklers[this.assetIndex];
        const previewCanvas = document.getElementById('asset-preview-canvas');
        const previewText = document.getElementById('asset-preview-text');
        
        if (previewCanvas && previewText) {
            // Render random Bonkler on canvas
            this.renderLoadingBonkler(previewCanvas, bonkler);
            previewText.textContent = `Loading Bonkler ${this.assetIndex + 1}...`;
            
            // Show next Bonkler after 2 seconds
            setTimeout(() => {
                this.assetIndex++;
                if (this.loadingProgress < 100) {
                    this.cycleAssetPreview();
                }
            }, 2000);
        }
        
        // Continue cycling if still loading
        if (this.loadingProgress < 100) {
            setTimeout(() => this.cycleAssetPreview(), 3000);
        }
    }

    renderLoadingBonkler(canvas, bonkler) {
        const ctx = canvas.getContext('2d');
        const canvasWidth = canvas.width;
        const canvasHeight = canvas.height;
        
        // Clear canvas with transparent background
        ctx.clearRect(0, 0, canvasWidth, canvasHeight);
        
        // Set up drawing context
        ctx.imageSmoothingEnabled = false;
        
        // Calculate scale and position for centered rendering
        const scale = 0.25; // Reduced scale to fit everything
        const centerX = canvasWidth / 2;
        const centerY = canvasHeight / 2;
        
        // Render each component
        const components = ['pilot', 'body', 'armor', 'hands', 'offhand', 'accessory', 'head'];
        
        components.forEach(componentType => {
            const componentName = bonkler[componentType];
            if (componentName) {
                const img = new Image();
                img.onload = () => {
                    // Calculate position based on component type
                    let x = centerX;
                    let y = centerY;
                    
                    // Adjust position for different components - more conservative positioning
                    if (componentType === 'pilot') {
                        y = centerY - 15;
                    } else if (componentType === 'body') {
                        y = centerY;
                    } else if (componentType === 'armor') {
                        y = centerY;
                    } else if (componentType === 'hands') {
                        x = centerX - 20;
                        y = centerY + 5;
                    } else if (componentType === 'offhand') {
                        x = centerX + 20;
                        y = centerY + 5;
                    } else if (componentType === 'accessory') {
                        y = centerY - 25;
                    } else if (componentType === 'head') {
                        y = centerY - 35;
                    }
                    
                    // Draw the component
                    const scaledWidth = img.width * scale;
                    const scaledHeight = img.height * scale;
                    
                    // Ensure the component stays within canvas bounds
                    const drawX = Math.max(0, Math.min(canvasWidth - scaledWidth, x - scaledWidth / 2));
                    const drawY = Math.max(0, Math.min(canvasHeight - scaledHeight, y - scaledHeight / 2));
                    
                    ctx.drawImage(img, drawX, drawY, scaledWidth, scaledHeight);
                };
                
                // Set image source based on component type
                const folderMap = {
                    'pilot': 'PILOT',
                    'body': 'BODIES',
                    'armor': 'ARMORS',
                    'hands': 'HANDS',
                    'offhand': 'OFFHAND',
                    'accessory': 'ACCESSORIES',
                    'head': 'HEADS'
                };
                
                const folder = folderMap[componentType];
                img.src = `${folder}/${componentName}.png`;
            }
        });
    }

    hideLoadingScreen() {
        const loadingScreen = document.getElementById('loading-screen');
        const gameContainer = document.getElementById('game-container');
        
        if (loadingScreen) {
            loadingScreen.style.opacity = '0';
            loadingScreen.style.transition = 'opacity 0.5s ease';
            
            setTimeout(() => {
                loadingScreen.style.display = 'none';
                if (gameContainer) {
                    gameContainer.style.display = 'block';
                }
            }, 500);
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