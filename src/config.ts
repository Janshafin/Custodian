// ─── Custodian — Config ───
// Single source of truth for mock vs live mode and all env-dependent values.

import * as dotenv from 'dotenv';
dotenv.config();

export interface CustodianConfig {
  mode: 'mock' | 'live';
  keeperhubApiKey: string;
  keeperhubBaseUrl: string;
  keeperhubWalletAddress: string;
  chainId: string;        // "11155111" for Ethereum Sepolia
  networkName: string;     // "ethereum-sepolia" — what KeeperHub expects
  blockExplorerUrl: string;
}

export function loadConfig(): CustodianConfig {
  const mode = (process.env.CUSTODIAN_MODE || 'mock') as 'mock' | 'live';

  if (mode === 'live') {
    const apiKey = process.env.KEEPERHUB_API_KEY;
    const walletAddress = process.env.KEEPERHUB_WALLET_ADDRESS;
    if (!apiKey || !walletAddress) {
      console.error('❌ Live mode requires KEEPERHUB_API_KEY and KEEPERHUB_WALLET_ADDRESS in .env');
      process.exit(1);
    }
    return {
      mode: 'live',
      keeperhubApiKey: apiKey,
      keeperhubBaseUrl: process.env.KEEPERHUB_BASE_URL || 'https://app.keeperhub.com/api',
      keeperhubWalletAddress: walletAddress,
      chainId: '11155111',
      networkName: 'sepolia',
      blockExplorerUrl: 'https://sepolia.etherscan.io',
    };
  }

  // Mock mode — zero secrets needed
  return {
    mode: 'mock',
    keeperhubApiKey: 'kh_mock_key_for_demo',
    keeperhubBaseUrl: 'http://localhost:0', // never actually called
    keeperhubWalletAddress: '0x0000000000000000000000000000000000000001',
    chainId: '11155111',
    networkName: 'sepolia',
    blockExplorerUrl: 'https://sepolia.etherscan.io',
  };
}
