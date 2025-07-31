// Game State Management
class GameState {
    constructor() {
        this.coins = 1000;
        this.exp = 0;
        this.level = 1;
        this.selectedNFT = null;
        this.battleMode = 'ai';
        this.currentBattle = null;
        this.nfts = [];

        this.fighterBuilt = false;
        this.userNFTs = [];
        this.purchasedItems = [];
        this.currentFighter = {
            pilot: null,
            body: null,
            head: null,
            armor: null,
            hands: null,
            offhand: null,
            accessory: null
        };
        this.canvas = null;
        this.ctx = null;
        
        // Battle animation properties
        this.battleCanvas = null;
        this.battleCtx = null;
        this.playerFighter = null;
        this.enemyFighter = null;
        this.battleBackground = null;
        
        this.init();
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
        this.loadGameData();
        this.setupEventListeners();
        await this.initFighterBuilder(); // Wait for component assets to load
        await this.loadNFTBonklers(); // Load NFT bonklers
        this.reprocessNFTsWithAssets(); // Process all NFTs with loaded assets
        this.populateNFTs(); // Populate NFTs after everything is loaded
        this.populateShop();
        this.populateInventory();
        this.populateLeaderboard();
        this.updateUI();
        
        // Preload battle background
        this.preloadBattleBackground();
        
        // Check if fighter is already built
        if (this.fighterBuilt) {
            this.switchScreen('battle');
        }
    }

    loadGameData() {
        // Load saved data from localStorage
        const savedData = localStorage.getItem('bonklerGameData');
        if (savedData) {
            const data = JSON.parse(savedData);
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
        }
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
            purchasedItems: this.purchasedItems
        };
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
            countElement.textContent = `Loaded: ${this.nfts.length} NFTs`;
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

    async connectWallet() {
        // For testing: Simulate wallet connection with your NFTs
        const testAddress = '0x1234567890123456789012345678901234567890'; // Placeholder
        
        console.log('Connected wallet (test mode):', testAddress);
        
        // Update wallet button
        const walletBtn = document.getElementById('wallet-connect-btn');
        walletBtn.innerHTML = `<i class="fas fa-wallet"></i> ${testAddress.slice(0, 6)}...${testAddress.slice(-4)}`;
        walletBtn.disabled = true;
        
        // Load test NFTs from your collection
        await this.loadUserNFTs(testAddress);
        
        this.showModal('Wallet Connected (Test Mode)', `Connected to test wallet. Loaded your NFT collection!`);
        
        // Real wallet connection (uncomment for production)
        /*
        if (typeof window.ethereum !== 'undefined') {
            try {
                const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
                const account = accounts[0];
                
                console.log('Connected wallet:', account);
                
                const walletBtn = document.getElementById('wallet-connect-btn');
                walletBtn.innerHTML = `<i class="fas fa-wallet"></i> ${account.slice(0, 6)}...${account.slice(-4)}`;
                walletBtn.disabled = true;
                
                await this.loadUserNFTs(account);
                
                this.showModal('Wallet Connected', `Successfully connected wallet: ${account}`);
                
            } catch (error) {
                console.error('Error connecting wallet:', error);
                this.showModal('Connection Failed', 'Failed to connect wallet. Please try again.');
            }
        } else {
            this.showModal('No Wallet Found', 'Please install MetaMask or another Web3 wallet to connect.');
        }
        */
    }

    async loadUserNFTs(account) {
        console.log('Loading NFTs for account:', account);
        
        // Load a selection of your NFTs for testing
        // In production, this would query the blockchain for user's owned NFTs
        const userTokenIds = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]; // Sample of your NFTs
        
        let loadedCount = 0;
        this.userNFTs = []; // Clear existing user NFTs
        
        for (const tokenId of userTokenIds) {
            try {
                const response = await fetch(`nft-metadata/output-jsons/${tokenId}.json`);
                if (response.ok) {
                    const nftData = await response.json();
                    const gameBonkler = this.convertNFTToGameFormat(nftData, tokenId);
                    gameBonkler.isUserNFT = true;
                    gameBonkler.owner = account; // Mark as owned by this wallet
                    this.userNFTs.push(gameBonkler); // Add to user NFTs array only
                    loadedCount++;
                }
            } catch (error) {
                console.warn(`Failed to load user NFT ${tokenId}:`, error);
            }
        }
        
        console.log(`Loaded ${loadedCount} NFTs for wallet ${account}`);
        
        // Refresh inventory display only
        this.populateInventory();
        
        // Show success message
        this.showModal('NFTs Loaded', `Successfully loaded ${loadedCount} of your NFTs!`);
    }

    updateUI() {
        document.getElementById('coins').textContent = this.coins;
        document.getElementById('exp').textContent = this.exp;
        document.getElementById('level').textContent = this.level;
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
        // Navigation
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
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
        document.getElementById('attack-btn').addEventListener('click', () => this.performAttack());
        document.getElementById('special-btn').addEventListener('click', () => this.performSpecial());
        document.getElementById('defend-btn').addEventListener('click', () => this.performDefend());

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
        document.querySelectorAll('.inventory-tab').forEach(btn => {
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

        document.getElementById('randomize-fighter-btn').addEventListener('click', () => {
            this.randomizeFighter();
        });

        // Wallet connect
        document.getElementById('wallet-connect-btn').addEventListener('click', () => {
            this.connectWallet();
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
        
        await this.loadComponentAssets();
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
        
        this.setupComponentNavigation();
        
        // Create randomized placeholder after assets are loaded
        this.createRandomizedPlaceholder();
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
        const assets = this.componentAssets[category] || [];
        if (assets[index]) {
            this.currentFighter[category] = assets[index];
            this.componentIndices[category] = index;
            // Don't render here - let the caller handle rendering
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

    createRandomizedPlaceholder() {
        const categories = ['pilot', 'body', 'head', 'armor', 'hands', 'offhand', 'accessory'];
        
        categories.forEach(category => {
            const assets = this.componentAssets[category] || [];
            
            if (assets.length > 0) {
                const randomIndex = Math.floor(Math.random() * assets.length);
                this.componentIndices[category] = randomIndex;
                this.selectComponent(category, randomIndex);
                this.updateComponentDisplay(category);
            }
        });
        
        // Render the randomized fighter
        this.renderFighter();
    }

    randomizeFighter() {
        const categories = ['pilot', 'body', 'head', 'armor', 'hands', 'offhand', 'accessory'];
        
        categories.forEach(category => {
            const assets = this.componentAssets[category] || [];
            if (assets.length > 0) {
                const randomIndex = Math.floor(Math.random() * assets.length);
                this.componentIndices[category] = randomIndex;
                this.selectComponent(category, randomIndex);
                this.updateComponentDisplay(category);
            }
        });
    }

    confirmFighter() {
        // Check if all components are selected
        const requiredComponents = ['pilot', 'body', 'head', 'armor', 'hands', 'offhand', 'accessory'];
        const missingComponents = requiredComponents.filter(comp => !this.currentFighter[comp]);
        
        if (missingComponents.length > 0) {
            this.showModal('Incomplete Fighter', `Please select all components: ${missingComponents.join(', ')}`);
            return;
        }
        
        // Create the fighter NFT
        const fighterName = `${this.currentFighter.pilot.name} ${this.currentFighter.body.name}`;
        const fighterNFT = {
            id: Date.now(),
            name: fighterName,
            level: 1,
            attack: 50 + Math.floor(Math.random() * 20),
            defense: 30 + Math.floor(Math.random() * 20),
            health: 100 + Math.floor(Math.random() * 50),
            maxHealth: 100 + Math.floor(Math.random() * 50),
            special: 'Custom Attack',
            avatar: '⚔️',
            components: { ...this.currentFighter }
        };
        
        // Add to NFT collection
        this.nfts = [fighterNFT];
        this.fighterBuilt = true;
        
        // Save and switch to battle screen
        this.saveGameData();
        this.populateNFTs();
        this.switchScreen('battle');
        
        this.showModal('Fighter Created!', `Your fighter "${fighterName}" is ready for battle!`);
    }

    switchScreen(screenName) {
        // Update navigation buttons
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-screen="${screenName}"]`).classList.add('active');

        // Update screens
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });
        document.getElementById(`${screenName}-screen`).classList.add('active');
        
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
        document.querySelectorAll('.inventory-tab').forEach(btn => btn.classList.remove('active'));
        document.querySelector(`[data-tab="${tab}"]`).classList.add('active');
        
        // Update tab content
        document.querySelectorAll('.inventory-tab-content').forEach(content => content.classList.remove('active'));
        document.getElementById(`inventory-${tab}`).classList.add('active');
    }

    setLeaderboardTab(tab) {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tab}"]`).classList.add('active');
        this.populateLeaderboard(tab);
    }

    // NFT Management
    reprocessNFTsWithAssets() {
        console.log('Re-processing NFTs with loaded assets...');
        // Re-process all NFTs with the now-loaded component assets
        this.nfts.forEach(nft => {
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
        });
        
        // Re-populate the NFT display
        this.populateNFTs();
    }

    populateNFTs() {
        if (this.nfts.length === 0) {
            // Show inventory if no NFTs are available
            this.switchScreen('inventory');
            return;
        }

        const nftGrid = document.getElementById('nft-grid');
        nftGrid.innerHTML = '';

        this.nfts.forEach(nft => {
            const nftCard = document.createElement('div');
            nftCard.className = 'nft-card';
            nftCard.dataset.nftId = nft.id;
            
            // Add NFT indicator if it's an NFT
            const nftBadge = nft.isNFT ? `<div class="nft-badge">NFT</div>` : '';
            const rarityBadge = nft.rarity ? `<div class="rarity-badge ${nft.rarity}">${nft.rarity.toUpperCase()}</div>` : '';
            
            // Always create a fighter preview canvas
            nftCard.innerHTML = `
                <div class="nft-avatar custom-fighter">
                    <canvas class="fighter-preview" width="120" height="180"></canvas>
                    ${nftBadge}
                    ${rarityBadge}
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
        this.selectedNFT = nft;
        
        // Update visual selection
        document.querySelectorAll('.nft-card').forEach(card => {
            card.classList.remove('selected');
        });
        document.querySelector(`[data-nft-id="${nft.id}"]`).classList.add('selected');

        // Start battle if NFT is selected
        this.startBattle();
    }

    startBattle() {
        if (!this.currentFighter.pilot) return;

        // Initialize battle canvas
        this.initBattleCanvas();
        
        // Create enemy fighter
        this.enemyFighter = this.createRandomEnemy();
        this.playerFighter = {
            name: 'Your Fighter',
            level: this.level,
            attack: 50 + Math.floor(Math.random() * 20),
            defense: 30 + Math.floor(Math.random() * 20),
            health: 500,
            maxHealth: 500,
            components: this.currentFighter
        };
        
        // Set up battle state
        this.currentBattle = {
            player: { ...this.playerFighter },
            enemy: { ...this.enemyFighter },
            turn: 'player',
            timer: 30
        };

        // Show battle arena
        document.getElementById('battle-arena').style.display = 'block';
        
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
        if (!this.battleCtx || !fighter || !fighter.components) return;

        // Clear area for this fighter
        this.battleCtx.clearRect(x - 50, y - 100, 100, 200);

        // Render layers in order: body → armor → hands → offhand → head → pilot → accessories
        const layerOrder = ['body', 'armor', 'hands', 'offhand', 'head', 'pilot', 'accessory'];
        
        layerOrder.forEach(layer => {
            const component = fighter.components[layer];
            if (component && component.image && component.image.complete && component.image.naturalWidth > 0) {
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
            }
        });
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
        if (healthBar) {
            const healthPercentage = (character.health / character.maxHealth) * 100;
            healthBar.style.width = `${healthPercentage}%`;
            console.log(`Updated ${side} health bar to ${healthPercentage}%`);
        }
        // Health bar might not exist if battle arena isn't shown yet - this is normal
    }



    enableBattleControls() {
        document.querySelectorAll('.battle-btn').forEach(btn => {
            btn.disabled = false;
        });
    }

    disableBattleControls() {
        document.querySelectorAll('.battle-btn').forEach(btn => {
            btn.disabled = true;
        });
    }

    performAttack() {
        if (!this.currentBattle || this.currentBattle.turn !== 'player') return;

        const damage = Math.floor(this.currentBattle.player.attack * (0.8 + Math.random() * 0.4));
        this.currentBattle.enemy.health = Math.max(0, this.currentBattle.enemy.health - damage);
        
        // Animate the attack
        this.animateAttack(this.currentBattle.player, this.currentBattle.enemy, true);
        
        this.updateCharacterDisplay('enemy', this.currentBattle.enemy);
        this.showBattleEffect('attack', damage);
        
        if (this.currentBattle.enemy.health <= 0) {
            // Enemy dies
            this.currentBattle.enemy.health = 0;
            this.updateCharacterDisplay('enemy', this.currentBattle.enemy);
            this.showBattleEffect('enemy-death', 0);
            setTimeout(() => this.endBattle('victory'), 2000);
        } else {
            this.currentBattle.turn = 'enemy';
            setTimeout(() => this.enemyTurn(), 1500);
        }
    }

    performSpecial() {
        if (!this.currentBattle || this.currentBattle.turn !== 'player') return;

        const damage = Math.floor(this.currentBattle.player.attack * (1.2 + Math.random() * 0.6));
        this.currentBattle.enemy.health = Math.max(0, this.currentBattle.enemy.health - damage);
        
        // Special attack with enhanced visual effects
        this.animateSpecialAttack(this.currentBattle.player, this.currentBattle.enemy, true);
        
        this.updateCharacterDisplay('enemy', this.currentBattle.enemy);
        this.showBattleEffect('special', damage);
        
        if (this.currentBattle.enemy.health <= 0) {
            // Enemy dies
            this.currentBattle.enemy.health = 0;
            this.updateCharacterDisplay('enemy', this.currentBattle.enemy);
            this.showBattleEffect('enemy-death', 0);
            setTimeout(() => this.endBattle('victory'), 2000);
        } else {
            this.currentBattle.turn = 'enemy';
            setTimeout(() => this.enemyTurn(), 1500);
        }
    }

    performDefend() {
        if (!this.currentBattle || this.currentBattle.turn !== 'player') return;

        // Reduce incoming damage for next turn
        this.currentBattle.player.defense *= 1.5;
        this.showBattleEffect('defend', 0);
        
        this.currentBattle.turn = 'enemy';
        setTimeout(() => this.enemyTurn(), 1000);
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
        } else if (action === 'special') {
            damage = Math.floor(this.currentBattle.enemy.attack * (1.2 + Math.random() * 0.6));
            console.log('Enemy special damage:', damage);
        }
        
        // Always show some effect for enemy actions
        if (action === 'defend') {
            // Enemy defends - no damage but show effect
            console.log('Enemy defends');
            this.showBattleEffect('enemy-defend', 0);
        } else if (damage > 0) {
            // Enemy attacks
            console.log('Enemy attacks for', damage, 'damage');
            this.currentBattle.player.health = Math.max(0, this.currentBattle.player.health - damage);
            
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
            // Reset defense bonus
            this.currentBattle.player.defense = this.currentFighter.defense || 10;
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
        } else if (result === 'defeat') {
            expReward = 10;
            this.addExp(expReward);
        }
        
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
                { name: 'Wolfie', type: 'pilot', attack: 5, cost: 500, icon: '👤', asset: 'WOLFIE.png' },
                { name: 'Tivo', type: 'pilot', attack: 8, cost: 800, icon: '👤', asset: 'TIVO.png' },
                { name: 'Stuart', type: 'pilot', attack: 6, cost: 600, icon: '👤', asset: 'STUART.png' },
                { name: 'Rover', type: 'pilot', attack: 7, cost: 700, icon: '👤', asset: 'ROVER.png' }
            ],
            bodies: [
                { name: 'Suit', type: 'body', defense: 10, cost: 400, icon: '👔', asset: 'SUIT.png' },
                { name: 'Tekken King', type: 'body', defense: 15, cost: 600, icon: '👑', asset: 'TEKKEN-KING.png' },
                { name: 'Sony TV', type: 'body', defense: 12, cost: 500, icon: '📺', asset: 'SONY-TV.png' },
                { name: 'Rilakkuma', type: 'body', defense: 8, cost: 300, icon: '🐻', asset: 'RILAKKUMA.png' }
            ],
            heads: [
                { name: 'Bonk', type: 'head', attack: 3, cost: 200, icon: '🎭', asset: 'BONK.png' },
                { name: 'Alien Bonk', type: 'head', attack: 5, cost: 350, icon: '👽', asset: 'ALIEN-BONK.png' },
                { name: 'Evil Bonk', type: 'head', attack: 7, cost: 500, icon: '😈', asset: 'EVIL-BONK.png' },
                { name: 'Spirit', type: 'head', attack: 4, cost: 300, icon: '👻', asset: 'SPIRIT.png' }
            ],
            armors: [
                { name: 'White Armor', type: 'armor', defense: 15, cost: 300, icon: '🛡️', asset: 'ArmorWhite.png' },
                { name: 'Steel Armor', type: 'armor', defense: 20, cost: 500, icon: '🛡️', asset: 'ArmorSteel.png' },
                { name: 'Black Armor', type: 'armor', defense: 18, cost: 400, icon: '🛡️', asset: 'ArmorBlack.png' },
                { name: 'Jade Armor', type: 'armor', defense: 25, cost: 800, icon: '🛡️', asset: 'ArmorJade.png' }
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
            accessories: [
                { name: 'Raver Cap', type: 'accessory', attack: 3, cost: 250, icon: '🎩', asset: 'RAVER-CAP.png' },
                { name: 'Halo', type: 'accessory', defense: 5, cost: 400, icon: '😇', asset: 'HALO.png' },
                { name: 'Droid', type: 'accessory', attack: 4, cost: 350, icon: '🤖', asset: 'DROID.png' },
                { name: 'BK', type: 'accessory', attack: 2, cost: 150, icon: '🍔', asset: 'BK.png' }
            ],
            potions: [
                { name: 'Health Potion', type: 'potion', health: 50, cost: 100, icon: '❤️' },
                { name: 'Strength Potion', type: 'potion', attack: 10, cost: 150, icon: '💪' },
                { name: 'Defense Potion', type: 'potion', defense: 10, cost: 150, icon: '🛡️' }
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
            } else if (item.type === 'head') {
                description = `Head component with +${item.attack} attack`;
            } else if (item.type === 'armor') {
                description = `Armor component with +${item.defense} defense`;
            } else if (item.type === 'offhand') {
                description = `Offhand component with +${item.attack || item.defense} ${item.attack ? 'attack' : 'defense'}`;
            } else if (item.type === 'accessory') {
                description = `Accessory component with +${item.attack || item.defense} ${item.attack ? 'attack' : 'defense'}`;
            } else if (item.type === 'potion') {
                description = `Temporary boost to your fighter`;
            }
            
            shopItem.innerHTML = `
                <div class="item-icon">
                    ${item.asset ? `<img src="${item.type === 'offhand' ? 'OFFHAND store' : item.type.toUpperCase()}/${item.asset}" alt="${item.name}" style="width: 100%; height: 100%; object-fit: contain;">` : item.icon}
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
        if (['pilot', 'body', 'head', 'armor', 'offhand', 'accessory'].includes(item.type)) {
            // Add component to available assets for future use
            if (!this.componentAssets) {
                this.componentAssets = {};
            }
            if (!this.componentAssets[item.type + 's']) {
                this.componentAssets[item.type + 's'] = [];
            }
            
            // Create component asset
            const componentAsset = {
                name: item.name,
                path: `${item.type.toUpperCase()}/${item.asset}`,
                type: item.type,
                attack: item.attack || 0,
                defense: item.defense || 0,
                cost: item.cost
            };
            
            this.componentAssets[item.type + 's'].push(componentAsset);
            
            // Add to purchased items inventory
            const purchasedItem = {
                ...componentAsset,
                id: Date.now() + Math.random(), // Unique ID
                purchasedAt: new Date().toISOString()
            };
            this.purchasedItems.push(purchasedItem);
            
            this.showModal('Component Unlocked', `You unlocked ${item.name}! You can now use this component in the fighter builder.`);
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
    }

    // Inventory System
    populateInventory() {
        this.populateInventoryNFTs();
        this.populateInventoryPurchased();
    }

    populateInventoryNFTs() {
        const nftsGrid = document.getElementById('inventory-nfts-grid');
        if (!nftsGrid) return;
        
        nftsGrid.innerHTML = '';
        
        if (this.userNFTs.length === 0) {
            nftsGrid.innerHTML = '<div class="inventory-empty">No NFTs found. Connect your wallet to load your NFTs.</div>';
            return;
        }
        
        this.userNFTs.forEach((nft, index) => {
            const item = document.createElement('div');
            item.className = 'inventory-item';
            item.dataset.index = index;
            
            // Add rarity class if available
            if (nft.rarity) {
                item.classList.add(`rarity-${nft.rarity.toLowerCase()}`);
            }
            
            item.innerHTML = `
                <div class="inventory-item-name">${nft.name}</div>
                <div class="inventory-item-type">NFT #${nft.tokenId}</div>
            `;
            
            item.addEventListener('click', () => {
                // Remove previous selection
                document.querySelectorAll('.inventory-item.selected').forEach(el => el.classList.remove('selected'));
                item.classList.add('selected');
                
                // Show NFT details
                this.showModal('NFT Details', `
                    <strong>${nft.name}</strong><br>
                    Token ID: ${nft.tokenId}<br>
                    Attack: ${nft.attack}<br>
                    Defense: ${nft.defense}<br>
                    Health: ${nft.health}<br>
                    Rarity: ${nft.rarity || 'Common'}
                `);
            });
            
            nftsGrid.appendChild(item);
        });
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
            itemElement.className = 'inventory-item';
            itemElement.dataset.index = index;
            
            itemElement.innerHTML = `
                <div class="inventory-item-name">${item.name}</div>
                <div class="inventory-item-type">${item.type}</div>
            `;
            
            itemElement.addEventListener('click', () => {
                // Remove previous selection
                document.querySelectorAll('.inventory-item.selected').forEach(el => el.classList.remove('selected'));
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

    // Leaderboard System
    populateLeaderboard(tab = 'global') {
        const leaderboardList = document.getElementById('leaderboard-list');
        leaderboardList.innerHTML = '';

        // Generate sample leaderboard data
        const leaderboardData = [
            { name: 'Player1', level: 15, exp: 2500, wins: 45, avatar: '👤' },
            { name: 'Player2', level: 12, exp: 1800, wins: 38, avatar: '👤' },
            { name: 'Player3', level: 10, exp: 1500, wins: 32, avatar: '👤' },
            { name: 'Player4', level: 8, exp: 1200, wins: 28, avatar: '👤' },
            { name: 'Player5', level: 6, exp: 900, wins: 22, avatar: '👤' },
            { name: 'Player6', level: 4, exp: 600, wins: 18, avatar: '👤' },
            { name: 'Player7', level: 3, exp: 400, wins: 15, avatar: '👤' },
            { name: 'Player8', level: 2, exp: 200, wins: 12, avatar: '👤' },
            { name: 'Player9', level: 1, exp: 100, wins: 8, avatar: '👤' },
            { name: 'Player10', level: 1, exp: 50, wins: 5, avatar: '👤' }
        ];

        leaderboardData.forEach((player, index) => {
            const entry = document.createElement('div');
            entry.className = 'leaderboard-entry';
            
            let rankClass = '';
            if (index === 0) rankClass = 'gold';
            else if (index === 1) rankClass = 'silver';
            else if (index === 2) rankClass = 'bronze';
            
            entry.innerHTML = `
                <div class="rank ${rankClass}">#${index + 1}</div>
                <div class="player-info">
                    <div class="player-avatar">${player.avatar}</div>
                    <div class="player-details">
                        <h3>${player.name}</h3>
                        <p>Level ${player.level}</p>
                    </div>
                </div>
                <div class="player-stats">
                    <div class="stat-value">${player.exp}</div>
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
}

// Initialize the game when the page loads
document.addEventListener('DOMContentLoaded', async () => {
    window.gameState = new GameState();
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