import { WEB3AUTH_NETWORK } from "@web3auth/modal";
import { type Web3AuthContextConfig } from "@web3auth/modal/react";
import { CHAIN_NAMESPACES } from "@web3auth/base";
import { frontendConfig } from "./config";

const clientId = frontendConfig.web3Auth.clientId;

export const web3AuthContextConfig: Web3AuthContextConfig = {
  web3AuthOptions: {
    clientId,
    web3AuthNetwork: WEB3AUTH_NETWORK.SAPPHIRE_DEVNET,
    chainConfig: {
      chainNamespace: CHAIN_NAMESPACES.EIP155,
      chainId: "0xaa36a7", // Sepolia - matches CLI default network
      rpcTarget: frontendConfig.networks.sepolia.rpcUrl,
      displayName: frontendConfig.networks.sepolia.name,
      blockExplorerUrl: "https://sepolia.etherscan.io",
      ticker: "ETH",
      tickerName: "Ethereum",
      decimals: 18,
    },
    uiConfig: {
      appName: "Fusion Swap",
      mode: "auto",
      loginMethodsOrder: ["google", "twitter", "github", "discord"],
      logoLight: "https://web3auth.io/images/web3authlog.png",
      logoDark: "https://web3auth.io/images/web3authlogodark.png",
      defaultLanguage: "en",
    },
  },
};