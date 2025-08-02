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
      address: '0x5FC8d32690cc91D4c39d9d3abcBD16989F875707',
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
      symbol: 'OMNI',
      name: 'Omni Token',
      address: '0x74DfeC5497e890d182eACAbEDf92bcA9021Aaad3',
      decimals: 18,
      chainId: 10143,
      icon: '🌟'
    },
    {
      symbol: 'MONSTER',
      name: 'Monster Token',
      address: '0x1C2D085DdF3c3FE877f3Bc0709c97F8342FCF868',
      decimals: 18,
      chainId: 10143,
      icon: '🦄'
    },
    {
      symbol: 'OMNIMONSTER',
      name: 'Omni Monster Token',
      address: '0x242BD3e422a946b5D2EB83C8c9A9B5c6499EEcFa',
      decimals: 18,
      chainId: 10143,
      icon: '🦄🌟'
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
    to: { chain: 'monadTestnet', token: 'OMNI' },
    description: 'Monster Token → Omni Token (Cross-chain)'
  },
  {
    from: { chain: 'monadTestnet', token: 'OMNI' },
    to: { chain: 'sepolia', token: 'MONSTER' },
    description: 'Omni Token → Monster Token (Cross-chain)'
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