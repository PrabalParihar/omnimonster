import { Window as KeplrWindow } from '@keplr-wallet/types';

declare global {
  interface Window extends KeplrWindow {}
}

export const cosmosTestnetChainInfo = {
  chainId: 'cosmoshub-testnet',
  chainName: 'Cosmos Hub Testnet',
  rpc: 'https://rpc.testnet.cosmos.network',
  rest: 'https://api.testnet.cosmos.network',
  bip44: {
    coinType: 118,
  },
  bech32Config: {
    bech32PrefixAccAddr: 'cosmos',
    bech32PrefixAccPub: 'cosmospub',
    bech32PrefixValAddr: 'cosmosvaloper',
    bech32PrefixValPub: 'cosmosvaloperpub',
    bech32PrefixConsAddr: 'cosmosvalcons',
    bech32PrefixConsPub: 'cosmosvalconspub',
  },
  currencies: [
    {
      coinDenom: 'ATOM',
      coinMinimalDenom: 'uatom',
      coinDecimals: 6,
    },
  ],
  feeCurrencies: [
    {
      coinDenom: 'ATOM',
      coinMinimalDenom: 'uatom',
      coinDecimals: 6,
    },
  ],
  stakeCurrency: {
    coinDenom: 'ATOM',
    coinMinimalDenom: 'uatom',
    coinDecimals: 6,
  },
  gasPriceStep: {
    low: 0.01,
    average: 0.025,
    high: 0.04,
  },
};

export class KeplrWallet {
  async isAvailable(): Promise<boolean> {
    return !!(window.keplr && window.getOfflineSigner);
  }

  async connect(): Promise<{ address: string; isConnected: boolean }> {
    if (!window.keplr) {
      throw new Error('Keplr extension not found. Please install Keplr.');
    }

    try {
      // Suggest the chain to Keplr
      await window.keplr.experimentalSuggestChain(cosmosTestnetChainInfo);
      
      // Enable the chain
      await window.keplr.enable(cosmosTestnetChainInfo.chainId);
      
      // Get the offline signer
      const offlineSigner = window.getOfflineSigner!(cosmosTestnetChainInfo.chainId);
      const accounts = await offlineSigner.getAccounts();
      
      if (accounts.length === 0) {
        throw new Error('No accounts found in Keplr wallet.');
      }

      return {
        address: accounts[0].address,
        isConnected: true,
      };
    } catch (error) {
      console.error('Failed to connect to Keplr:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    // Keplr doesn't have a programmatic disconnect method
    // Users need to disconnect from the Keplr extension
    console.log('To disconnect Keplr, please do so from the Keplr extension.');
  }

  async getAddress(): Promise<string | null> {
    if (!window.keplr) return null;

    try {
      const offlineSigner = window.getOfflineSigner!(cosmosTestnetChainInfo.chainId);
      const accounts = await offlineSigner.getAccounts();
      return accounts.length > 0 ? accounts[0].address : null;
    } catch (error) {
      console.error('Failed to get Keplr address:', error);
      return null;
    }
  }

  async switchChain(chainId: string): Promise<void> {
    if (!window.keplr) {
      throw new Error('Keplr extension not found.');
    }

    try {
      await window.keplr.enable(chainId);
    } catch (error) {
      console.error('Failed to switch chain in Keplr:', error);
      throw error;
    }
  }
}

export const keplrWallet = new KeplrWallet(); 