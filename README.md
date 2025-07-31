# Bonkler Game

A web-based fighting game where players can build custom fighters using NFT components and battle against each other.

## Features

- **Fighter Builder**: Create custom fighters by selecting different components (pilot, body, head, armor, hands, offhand, accessories)
- **NFT Integration**: Load and display NFT characters from metadata files
- **Inventory System**: View your NFT collection and purchased items
- **Battle System**: Turn-based combat with custom fighters
- **Shop System**: Purchase new components and items
- **Responsive Design**: Works on desktop and mobile devices

## Setup

### Prerequisites
- A modern web browser
- Python 3.x (for local server)
- Git

### Installation

1. Clone the repository:
```bash
git clone https://github.com/chakra3301/Bonkler-game.git
cd Bonkler-game
```

2. **Important: NFT Metadata Setup**
   
   The game requires NFT metadata files to function properly. The repository includes sample files, but for the full experience you need the complete dataset:

   **Option A: Use Sample Data (Quick Start)**
   - The repository includes 3 sample NFT files (`sample-0.json`, `sample-1.json`, `sample-2.json`)
   - The game will work with these samples for testing

   **Option B: Add Full NFT Dataset**
   - Place your complete NFT metadata files in `nft-metadata/output-jsons/`
   - The full dataset should contain 1500+ JSON files (0.json to 1499.json)
   - Each file should contain NFT attributes like pilot, body, head, armor, etc.

   **Option C: Generate Sample Data**
   - If you don't have the full dataset, you can create additional sample files
   - Copy the existing sample files and modify the attributes as needed

3. Start the local server:
```bash
python -m http.server 3001
```

4. Open your browser and navigate to:
```
http://localhost:3001
```

## Game Structure

### Core Files
- `index.html` - Main game interface
- `game.js` - Game logic and NFT integration
- `styles.css` - Styling and responsive design

### Asset Directories
- `ACCESSORIES/` - Accessory component images
- `ARMORS/` - Armor component images
- `BODIES/` - Body component images
- `HANDS/` - Hand/weapon component images
- `HEADS/` - Head component images
- `OFFHAND/` - Offhand component images
- `PILOT/` - Pilot component images

### NFT Metadata
- `nft-metadata/output-jsons/` - NFT metadata files
- `NFT_INTEGRATION.md` - Documentation for NFT integration

## How to Play

1. **Inventory Screen**: View your NFT collection and purchased items
2. **Fighter Builder**: Create your custom fighter by selecting components
3. **Battle Screen**: Select your fighter and battle against opponents
4. **Shop**: Purchase new components and items

## NFT Integration

The game loads NFT metadata from JSON files and converts them into playable fighters. Each NFT contains attributes that map to game components:

```json
{
  "attributes": [
    {"trait_type": "Pilot", "value": "HAMTARO"},
    {"trait_type": "Body", "value": "YMO-TOUR"},
    {"trait_type": "Head", "value": "BONK"},
    {"trait_type": "Armor", "value": "ArmorCoal"},
    {"trait_type": "Hands", "value": "EVOLVED-ANTENNA"},
    {"trait_type": "Offhand", "value": "POCKET-PET"},
    {"trait_type": "Accessories", "value": "RAVER-CAP"}
  ]
}
```

## Development

### Adding New Components
1. Add component images to the appropriate asset directory
2. Update the game logic in `game.js` to handle new components
3. Test the component selection in the fighter builder

### Modifying NFT Loading
- Edit the `loadNFTBonklers()` function in `game.js`
- Modify the `convertNFTToGameFormat()` function for different attribute structures
- Update asset mapping logic as needed

## Troubleshooting

### NFT Images Not Loading
- Ensure all asset directories contain the required PNG files
- Check that NFT attribute values match asset filenames
- Verify the asset loading sequence in `game.js`

### Game Not Starting
- Check browser console for JavaScript errors
- Ensure all required files are present
- Verify the local server is running on the correct port

### Missing NFT Data
- Add sample NFT files to `nft-metadata/output-jsons/`
- Or obtain the full NFT dataset and place files in the metadata directory

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is open source and available under the MIT License.

## Support

For issues or questions, please open an issue on the GitHub repository. 