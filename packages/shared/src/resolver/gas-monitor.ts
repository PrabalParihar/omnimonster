import { ethers } from 'ethers';

export interface GasBalance {
  chain: string;
  balance: bigint;
  formatted: string;
  isLow: boolean;
  minRequired: bigint;
}

export class GasMonitor {
  private minGasThresholds: Record<string, bigint> = {
    sepolia: ethers.parseEther('0.01'), // 0.01 ETH
    monadTestnet: ethers.parseEther('0.05'), // 0.05 MONAD
    polygonAmoy: ethers.parseEther('0.1'), // 0.1 MATIC
    etherlinkTestnet: ethers.parseEther('0.1'), // 0.1 XTZ
  };

  async checkGasBalance(
    provider: ethers.Provider,
    walletAddress: string,
    chainName: string
  ): Promise<GasBalance> {
    const balance = await provider.getBalance(walletAddress);
    const minRequired = this.minGasThresholds[chainName] || ethers.parseEther('0.01');
    
    return {
      chain: chainName,
      balance,
      formatted: ethers.formatEther(balance),
      isLow: balance < minRequired,
      minRequired
    };
  }

  async checkAllChains(wallets: { chainName: string; provider: ethers.Provider; address: string }[]): Promise<GasBalance[]> {
    const balances = await Promise.all(
      wallets.map(wallet => this.checkGasBalance(wallet.provider, wallet.address, wallet.chainName))
    );
    
    return balances;
  }

  getWarningMessage(gasBalance: GasBalance): string | null {
    if (!gasBalance.isLow) return null;
    
    const required = ethers.formatEther(gasBalance.minRequired);
    return `⚠️ LOW GAS on ${gasBalance.chain}: ${gasBalance.formatted} (need at least ${required})`;
  }
}