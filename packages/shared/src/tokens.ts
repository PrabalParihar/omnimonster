export interface Token {
  symbol: string;
  name: string;
  address: string;
  decimals: number;
  chainId: string | number;
  icon?: string;
}

// Token configurations by chain
export const CHAIN_TOKENS: Record<string, Token[]> = {
  sepolia: [
    {
      symbol: 'MONSTER',
      name: 'Monster Token',
      address: '0x34604F9A9b00B49E70Cbf32e4417c75469abF03E',
      decimals: 18,
      chainId: 11155111,
      icon: '🦄'
    },
    {
      symbol: 'USDC',
      name: 'USD Coin',
      address: '0xA0b86a33E6441E175C5E2c3B5c8c2f6B3d14b3E6',
      decimals: 6,
      chainId: 11155111,
      icon: '💵'
    },
    {
      symbol: 'USDT',
      name: 'Tether USD',
      address: '0x5BCcA94B7E2D5E7E9E2c4F3B4e2B8dD3e6c4F3B4',
      decimals: 6,
      chainId: 11155111,
      icon: '💴'
    }
  ],
  polygonAmoy: [
    {
      symbol: 'USDC',
      name: 'USD Coin',
      address: '0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582',
      decimals: 6,
      chainId: 80002,
      icon: '💵'
    },
    {
      symbol: 'USDT', 
      name: 'Tether USD',
      address: '0xf9d78d5A0E83Ad16b0f68e6fF4FF39f0D1b1e3dE',
      decimals: 6,
      chainId: 80002,
      icon: '💴'
    },
    {
      symbol: 'MATIC',
      name: 'Polygon',
      address: '0x0000000000000000000000000000000000001010',
      decimals: 18,
      chainId: 80002,
      icon: '🟣'
    }
  ],
  monadTestnet: [
    {
      symbol: 'MONSTER',
      name: 'Monster Token',
      address: '0x6f086D3a6430567d444aA55b9B37DF229Fb4677B',
      decimals: 18,
      chainId: 10143,
      icon: '🦄'
    },
    {
      symbol: 'OMNIMONSTER',
      name: 'Omni Monster Token',
      address: '0x415B0CE8b921647Dd8C0B298cAe3588ffE487E24',
      decimals: 18,
      chainId: 10143,
      icon: '🌟'
    }
  ],
  etherlinkTestnet: [
    {
      symbol: 'DRAGON',
      name: 'Dragon Token',
      address: '0x74DfeC5497e890d182eACAbEDf92bcA9021Aaad3',
      decimals: 18,
      chainId: 128123,
      icon: '🐉'
    },
    {
      symbol: 'XTZ',
      name: 'Tezos',
      address: '0x0000000000000000000000000000000000000000', // Native token
      decimals: 18,
      chainId: 128123,
      icon: '🔷'
    }
  ],
  cosmosTestnet: [
    {
      symbol: 'ATOM',
      name: 'Cosmos',
      address: 'uatom',
      decimals: 6,
      chainId: 'theta-testnet-001',
      icon: '⚛️'
    }
  ]
};

// Get tokens for a specific chain
export const getTokensForChain = (chainKey: string): Token[] => {
  return CHAIN_TOKENS[chainKey] || [];
};

// Get token by symbol and chain
export const getToken = (chainKey: string, symbol: string): Token | undefined => {
  const tokens = getTokensForChain(chainKey);
  return tokens.find(token => token.symbol === symbol);
};

// Get all unique tokens across all chains
export const getAllTokens = (): Token[] => {
  const allTokens: Token[] = [];
  Object.values(CHAIN_TOKENS).forEach(chainTokens => {
    allTokens.push(...chainTokens);
  });
  return allTokens;
};

// Common token pairs for cross-chain swaps
export const SUPPORTED_SWAP_PAIRS = [
  {
    from: { chain: 'sepolia', token: 'MONSTER' },
    to: { chain: 'monadTestnet', token: 'OMNIMONSTER' },
    description: 'Monster Token → OmniMonster Token (Cross-chain)'
  },
  {
    from: { chain: 'monadTestnet', token: 'OMNIMONSTER' },
    to: { chain: 'sepolia', token: 'MONSTER' },
    description: 'OmniMonster Token → Monster Token (Cross-chain)'
  },
  {
    from: { chain: 'sepolia', token: 'USDC' },
    to: { chain: 'polygonAmoy', token: 'USDC' },
    description: 'USDC Cross-chain Bridge'
  },
  {
    from: { chain: 'polygonAmoy', token: 'USDT' },
    to: { chain: 'sepolia', token: 'USDT' },
    description: 'USDT Cross-chain Bridge'
  },
  // Etherlink Dragon token pairs
  {
    from: { chain: 'sepolia', token: 'MONSTER' },
    to: { chain: 'etherlinkTestnet', token: 'DRAGON' },
    description: 'Monster Token → Dragon Token (Cross-chain)'
  },
  {
    from: { chain: 'etherlinkTestnet', token: 'DRAGON' },
    to: { chain: 'sepolia', token: 'MONSTER' },
    description: 'Dragon Token → Monster Token (Cross-chain)'
  },
  {
    from: { chain: 'monadTestnet', token: 'OMNIMONSTER' },
    to: { chain: 'etherlinkTestnet', token: 'DRAGON' },
    description: 'OmniMonster Token → Dragon Token (Cross-chain)'
  },
  {
    from: { chain: 'etherlinkTestnet', token: 'DRAGON' },
    to: { chain: 'monadTestnet', token: 'OMNIMONSTER' },
    description: 'Dragon Token → OmniMonster Token (Cross-chain)'
  }
];

// Helper to check if a swap pair is supported
export const isSwapPairSupported = (fromChain: string, fromToken: string, toChain: string, toToken: string): boolean => {
  return SUPPORTED_SWAP_PAIRS.some(pair => 
    pair.from.chain === fromChain && 
    pair.from.token === fromToken && 
    pair.to.chain === toChain && 
    pair.to.token === toToken
  );
};

// Get available destination tokens for a given source
export const getAvailableDestinations = (fromChain: string, fromToken: string): Array<{chain: string, token: string, description: string}> => {
  return SUPPORTED_SWAP_PAIRS
    .filter(pair => pair.from.chain === fromChain && pair.from.token === fromToken)
    .map(pair => ({
      chain: pair.to.chain,
      token: pair.to.token,
      description: pair.description
    }));
};