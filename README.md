# Bonkler NFT Battle Game

A browser-based NFT battle game where players use their NFTs to battle against AI opponents or other players. Earn experience, coins, and climb the leaderboard!

## 🎮 Features

### 🗡️ Battle System
- **AI Battles**: Fight against computer-controlled enemies
- **PvP Battles**: Challenge other players (coming soon)
- **Turn-based Combat**: Strategic battles with attack, special, and defend actions
- **Real-time Timer**: 30-second time limit per battle
- **Dynamic Damage**: Randomized damage based on character stats
- **Visual Effects**: Shake animations and damage numbers

### 🎨 Fighter Builder
- **Component Selection**: Choose from pilots, bodies, heads, armor, hands, offhand, and accessories
- **Visual Preview**: See your fighter rendered in real-time
- **Randomize**: Generate random fighter combinations
- **Confirm Fighter**: Lock in your fighter design for battles

### 🛒 Shop System
- **Weapons**: Swords, bows, and magic staffs
- **Armor**: Various armor types for defense
- **Potions**: Temporary stat boosts
- **NFTs**: Purchase new NFT characters
- **Categories**: Organized shopping experience

### 🏆 Leaderboard
- **Global Rankings**: See top players worldwide
- **Weekly/Monthly**: Time-based leaderboards
- **Player Stats**: Experience points and win counts
- **Visual Rankings**: Gold, silver, bronze medals

### 🎯 NFT Management
- **Multiple Characters**: Collect different NFT types
- **Unique Stats**: Each NFT has attack, defense, and health
- **Special Abilities**: Unique special attacks
- **Visual Avatars**: Emoji-based character representation

## 🚀 How to Play

### Getting Started
1. Open `index.html` in your web browser
2. The game will load with 1000 starting coins
3. Navigate between different sections using the top navigation

### Battle System
1. **Select Battle Mode**: Choose AI or PvP battles
2. **Choose Your NFT**: Click on an NFT from your collection
3. **Enter Battle Arena**: Your selected NFT will face an enemy
4. **Combat Actions**:
   - **Attack**: Basic attack with moderate damage
   - **Special**: Powerful attack with higher damage
   - **Defend**: Reduce incoming damage for next turn
5. **Win Rewards**: Earn experience points and coins for victories

### Building Your Fighter
1. Go to the **Builder** section
2. Navigate through different component categories using the arrow buttons
3. Select components for each category:
   - **Pilot**: The character piloting your mecha
   - **Body**: The main body structure
   - **Head**: The head/helmet component
   - **Armor**: Protective armor pieces
   - **Hands**: Weapons and hand-held items
   - **Offhand**: Secondary items and accessories
   - **Accessories**: Additional decorative elements
4. Use the **Randomize** button to generate random combinations
5. Click **Confirm Fighter** when satisfied with your design

### Shopping
1. Visit the **Shop** section
2. Browse different categories:
   - **Weapons**: Increase attack power
   - **Armor**: Improve defense
   - **Potions**: Temporary boosts
   - **NFTs**: New characters
3. Purchase items with your coins
4. New NFTs will be added to your collection

### Leaderboard
1. Check the **Leaderboard** section
2. View different time periods:
   - Global (all-time)
   - Weekly
   - Monthly
3. See your ranking and stats

## 🎨 Game Design

### Visual Style
- **Modern UI**: Clean, futuristic design
- **Gradient Backgrounds**: Purple and gold theme
- **Glass Morphism**: Translucent elements with blur effects
- **Responsive Design**: Works on desktop and mobile
- **Smooth Animations**: Hover effects and transitions

### Color Scheme
- **Primary**: Purple gradients (#2d1b69, #4a1b8a, #6a1b9a)
- **Accent**: Gold (#ffd700)
- **Background**: Dark gradients (#0f0f23, #1a1a3a)
- **Text**: White and light gray

### Typography
- **Font**: Orbitron (monospace)
- **Weights**: 400, 700, 900
- **Style**: Futuristic, gaming aesthetic

## 💾 Data Persistence

The game automatically saves your progress using localStorage:
- **Coins**: Your current coin balance
- **Experience**: Total experience points
- **Level**: Current player level
- **NFTs**: Your NFT collection and their stats
- **Upgrades**: Applied upgrades to your NFTs

## 🛠️ Technical Features

### Browser Compatibility
- **Modern Browsers**: Chrome, Firefox, Safari, Edge
- **No Dependencies**: Pure HTML, CSS, and JavaScript
- **Offline Play**: Works without internet connection
- **Mobile Responsive**: Optimized for mobile devices

### Performance
- **Lightweight**: Minimal file size
- **Fast Loading**: Optimized assets
- **Smooth Animations**: 60fps animations
- **Memory Efficient**: Clean code structure

## 🎯 Game Mechanics

### Experience System
- **Level Progression**: Gain levels with experience
- **Experience Rewards**: Win battles to earn XP
- **Level Bonuses**: Coins awarded for leveling up
- **Experience Formula**: Level × 100 XP needed for next level

### Economy System
- **Coins**: Primary currency
- **Earning**: Win battles, level up
- **Spending**: Upgrades, shop items
- **Balance**: Strategic resource management

### Battle Mechanics
- **Turn-based**: Player and enemy take turns
- **Random Damage**: 80-120% of base attack
- **Special Attacks**: 120-180% of base attack
- **Defense**: Reduces incoming damage
- **Health System**: Characters have max health

## 🔮 Future Enhancements

### Planned Features
- **PvP Battles**: Real player vs player combat
- **Guild System**: Join guilds and team battles
- **Tournaments**: Special event competitions
- **Achievements**: Unlockable achievements
- **Sound Effects**: Audio feedback
- **More NFT Types**: Additional character classes
- **Trading System**: NFT marketplace
- **Seasonal Events**: Limited-time content

### Technical Improvements
- **Backend Integration**: Server-side data storage
- **Multiplayer**: Real-time multiplayer battles
- **Blockchain Integration**: True NFT ownership
- **Mobile App**: Native mobile application
- **Social Features**: Friends and chat system

## 📁 File Structure

```
bonkler-game/
├── index.html          # Main game file
├── styles.css          # Game styling
├── game.js            # Game logic
└── README.md          # This file
```

## 🚀 Quick Start

1. **Download**: Save all files to a folder
2. **Open**: Double-click `index.html`
3. **Play**: Start battling with your NFTs!

## 🎮 Game Controls

### Navigation
- **Battle**: Click "Battle" in navigation
- **Upgrades**: Click "Upgrades" in navigation
- **Shop**: Click "Shop" in navigation
- **Leaderboard**: Click "Leaderboard" in navigation

### Battle Controls
- **Attack**: Click "Attack" button
- **Special**: Click "Special" button
- **Defend**: Click "Defend" button
- **Select NFT**: Click on NFT card

### Shop Controls
- **Browse Categories**: Click category buttons
- **Purchase**: Click "Buy" button on items
- **View Details**: Hover over items

## 🏆 Tips for Success

1. **Start with AI Battles**: Easier opponents to build up coins
2. **Upgrade Strategically**: Focus on one NFT at a time
3. **Balance Stats**: Don't neglect defense for attack
4. **Save Coins**: Don't spend everything at once
5. **Use Special Attacks**: Higher damage but strategic timing
6. **Defend When Low**: Use defend when health is low
7. **Buy New NFTs**: Expand your collection for variety

## 🐛 Troubleshooting

### Common Issues
- **Game not loading**: Check browser compatibility
- **Saves not working**: Enable localStorage in browser
- **Slow performance**: Close other browser tabs
- **Visual glitches**: Refresh the page

### Browser Support
- **Chrome**: Full support
- **Firefox**: Full support
- **Safari**: Full support
- **Edge**: Full support
- **Internet Explorer**: Not supported

## 📞 Support

For issues or questions:
1. Check this README for solutions
2. Try refreshing the page
3. Clear browser cache if needed
4. Ensure JavaScript is enabled

---

**Enjoy the game! May your NFTs be victorious! 🏆⚔️** 