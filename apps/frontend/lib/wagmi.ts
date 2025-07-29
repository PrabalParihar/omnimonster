import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { sepolia, polygonAmoy } from 'wagmi/chains';

export const config = getDefaultConfig({
  appName: 'Swap Sage',
  projectId: 'YOUR_PROJECT_ID', // Get this from WalletConnect Cloud
  chains: [sepolia, polygonAmoy],
  ssr: true, // If your dApp uses server side rendering (SSR)
});

export const supportedChains = {
  sepolia: {
    id: sepolia.id,
    name: sepolia.name,
    nativeCurrency: sepolia.nativeCurrency,
    rpcUrls: sepolia.rpcUrls,
    blockExplorers: sepolia.blockExplorers,
  },
  polygonAmoy: {
    id: polygonAmoy.id,
    name: polygonAmoy.name,
    nativeCurrency: polygonAmoy.nativeCurrency,
    rpcUrls: polygonAmoy.rpcUrls,
    blockExplorers: polygonAmoy.blockExplorers,
  },
} as const;

export type SupportedChainId = keyof typeof supportedChains; 