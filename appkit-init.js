// Reown AppKit Configuration
import { createAppKit } from '@reown/appkit';
import { SolanaAdapter } from '@reown/appkit-adapter-solana';

// Project ID from Reown Dashboard
const projectId = '557b2b564270241b876f63153290ae90';

// Configure Solana adapter
const solanaAdapter = new SolanaAdapter({
    projectId,
    networks: ['mainnet-beta', 'devnet', 'testnet']
});

// Configure metadata
const metadata = {
    name: 'Bonkler Battle Game',
    description: 'NFT Battle Game on Solana',
    url: window.location.origin,
    icons: ['https://avatars.githubusercontent.com/u/179229932']
};

// Create the AppKit modal
const modal = createAppKit({
    adapters: [solanaAdapter],
    networks: ['mainnet-beta', 'devnet', 'testnet'],
    metadata,
    projectId,
    features: {
        analytics: true
    }
});

// Make modal available globally
window.appkitModal = modal;

// Initialize connection state
window.appkitState = {
    isConnected: false,
    publicKey: null,
    wallet: null
};

// Listen for connection events
modal.subscribeModal((state) => {
    if (state.open) {
        console.log('AppKit modal opened');
    }
});

// Listen for wallet connection events
modal.subscribeWallet((state) => {
    window.appkitState.isConnected = state.connected;
    window.appkitState.publicKey = state.address;
    window.appkitState.wallet = state.wallet;
    
    console.log('Wallet state changed:', {
        connected: state.connected,
        address: state.address,
        wallet: state.wallet
    });
    
    // Trigger game update if game is loaded
    if (window.game && window.game.updateWalletButton) {
        window.game.updateWalletButton();
    }
});

console.log('Reown AppKit initialized with project ID:', projectId); 