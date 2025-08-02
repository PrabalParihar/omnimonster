import { http, createConfig } from 'wagmi'
import { sepolia } from 'wagmi/chains'
import { frontendConfig } from './config'

// Get chain configurations from our unified config that matches CLI
const networks = frontendConfig.networks

// Custom chain configurations for your testnets (matches CLI config)
const polygonAmoy = {
  id: networks.polygonAmoy.chainId,
  name: networks.polygonAmoy.name,
  network: 'polygon-amoy',
  nativeCurrency: {
    decimals: 18,
    name: 'MATIC',
    symbol: 'MATIC',
  },
  rpcUrls: {
    public: { http: [networks.polygonAmoy.rpcUrl] },
    default: { http: [networks.polygonAmoy.rpcUrl] },
  },
  blockExplorers: {
    default: { name: 'PolygonScan', url: 'https://amoy.polygonscan.com' },
  },
} as const

const monadTestnet = {
  id: networks.monadTestnet.chainId,
  name: networks.monadTestnet.name,
  network: 'monad-testnet',
  nativeCurrency: {
    decimals: 18,
    name: 'MON',
    symbol: 'MON',
  },
  rpcUrls: {
    public: { http: [networks.monadTestnet.rpcUrl] },
    default: { http: [networks.monadTestnet.rpcUrl] },
  },
  blockExplorers: {
    default: { name: 'Monad Explorer', url: 'https://testnet.monadexplorer.com' },
  },
} as const

// Override Sepolia with our config
const sepoliaWithConfig = {
  ...sepolia,
  rpcUrls: {
    ...sepolia.rpcUrls,
    default: { http: [networks.sepolia.rpcUrl] },
    public: { http: [networks.sepolia.rpcUrl] },
  }
}

export const config = createConfig({
  chains: [sepoliaWithConfig, polygonAmoy, monadTestnet],
  transports: {
    [sepoliaWithConfig.id]: http(networks.sepolia.rpcUrl),
    [polygonAmoy.id]: http(networks.polygonAmoy.rpcUrl),
    [monadTestnet.id]: http(networks.monadTestnet.rpcUrl),
  },
})

// Export chains for use in other components
export { sepoliaWithConfig as sepolia, polygonAmoy, monadTestnet }