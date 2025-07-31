# NFT Integration Guide for Bonkler Battle Game

## Overview

This guide explains how to integrate NFTs into your Bonkler Battle Game. The game supports both local JSON metadata and wallet-connected NFTs.

## Current Implementation

### 1. Local JSON Metadata (Development)

The game currently supports loading NFT bonklers from a local JSON file:

**File Structure:**
```
bonkler game/
├── nft-metadata/
│   └── bonklers.json
├── game.js
├── index.html
└── styles.css
```

**JSON Format:**
```json
{
  "bonklers": [
    {
      "id": "bonkler_001",
      "name": "Cyber Bonkler",
      "description": "A futuristic bonkler with cyber enhancements",
      "image": "https://example.com/bonkler_001.png",
      "attributes": {
        "pilot": "WOLFIE",
        "body": "SONY-TV",
        "head": "BONK",
        "armor": "ArmorSteel",
        "hands": "ENERGY-SWORD",
        "offhand": "YEN",
        "accessory": "HALO"
      },
      "stats": {
        "attack": 75,
        "defense": 60,
        "health": 450,
        "maxHealth": 450,
        "level": 1
      },
      "rarity": "rare",
      "tokenId": "1"
    }
  ]
}
```

### 2. Wallet Connect (Production)

The game includes a wallet connect button that:
- Connects to MetaMask or other Web3 wallets
- Loads user's NFTs from blockchain
- Displays them in the game

## How to Use

### For Development:

1. **Add NFT Metadata:**
   - Edit `nft-metadata/bonklers.json`
   - Add your bonkler NFTs with proper attributes
   - Make sure component names match your asset folders

2. **Test Locally:**
   - The game will automatically load NFTs from the JSON file
   - NFTs will appear in the battle selection screen

### For Production:

1. **Deploy Smart Contract:**
   - Create an ERC-721 contract for Bonkler NFTs
   - Store metadata on IPFS or Arweave
   - Mint NFTs to users

2. **Update Wallet Integration:**
   - Modify `loadUserNFTs()` in `game.js`
   - Query blockchain for user's NFTs
   - Fetch metadata from IPFS/Arweave

3. **Deploy Game:**
   - Host on IPFS or traditional web server
   - Users can connect wallets and use their NFTs

## NFT Attributes

Each bonkler NFT should have these attributes:

- **pilot**: Character pilot (e.g., "WOLFIE", "TIVO")
- **body**: Body component (e.g., "SONY-TV", "RILAKKUMA")
- **head**: Head component (e.g., "BONK", "ALIEN-BONK")
- **armor**: Armor component (e.g., "ArmorSteel", "ArmorJade")
- **hands**: Weapon component (e.g., "ENERGY-SWORD", "GOLDEN-AXE")
- **offhand**: Offhand item (e.g., "YEN", "GAME-AND-WATCH")
- **accessory**: Accessory item (e.g., "HALO", "DROID")

## Stats System

Each NFT has battle stats:
- **attack**: Damage dealt in battles
- **defense**: Damage reduction
- **health**: Maximum health points
- **level**: Fighter level (affects rewards)

## Rarity System

NFTs can have different rarities:
- **common**: Basic bonklers
- **rare**: Better stats, blue badge
- **epic**: High stats, purple badge
- **legendary**: Best stats, orange badge

## Future Enhancements

1. **Cross-Chain Support:**
   - Support multiple blockchains (Ethereum, Polygon, etc.)
   - Bridge NFTs between chains

2. **Dynamic NFTs:**
   - NFTs that level up through battles
   - Stats change based on performance

3. **NFT Trading:**
   - In-game marketplace
   - Trade bonklers for coins

4. **Staking System:**
   - Stake NFTs to earn rewards
   - Breeding system for new bonklers

## Technical Notes

- The game converts NFT metadata to internal fighter format
- Components are matched by name to asset folders
- Missing components fall back to default values
- Wallet connection requires MetaMask or similar Web3 wallet

## Example NFT Creation

```javascript
// Example of creating a bonkler NFT
const bonklerNFT = {
  id: "bonkler_001",
  name: "Cyber Bonkler",
  description: "A futuristic bonkler with cyber enhancements",
  attributes: {
    pilot: "WOLFIE",
    body: "SONY-TV", 
    head: "BONK",
    armor: "ArmorSteel",
    hands: "ENERGY-SWORD",
    offhand: "YEN",
    accessory: "HALO"
  },
  stats: {
    attack: 75,
    defense: 60,
    health: 450,
    maxHealth: 450,
    level: 1
  },
  rarity: "rare",
  tokenId: "1"
};
```

This NFT would create a bonkler with the specified components and stats in the game. 