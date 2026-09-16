#!/usr/bin/env npx tsx
// ─── Custodian — Demo: Full Pipeline ───
// Checkpoint 1: Hand-written Intent → Policy → Simulate → Execute → Receipt
//
// Usage:
//   npm run demo          # mock mode (zero secrets, instant)
//   npm run demo:live     # live mode (requires .env with KeeperHub API key)

import { loadConfig } from './config.js';
import { CustodianPipeline } from './pipeline.js';
import { generateIntentId } from './types.js';
import type { Intent } from './types.js';

async function main() {
  const config = loadConfig();

  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║            🏛️  CUSTODIAN — Agent Treasury Swarm         ║');
  console.log('║     Multi-agent pipeline with KeeperHub execution       ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log(`\n  Mode:    ${config.mode.toUpperCase()}`);
  console.log(`  Chain:   ${config.networkName} (${config.chainId})`);
  console.log(`  Wallet:  ${config.keeperhubWalletAddress}`);

  const pipeline = new CustodianPipeline(config);

  // Create a hand-written intent (Checkpoint 1)
  const intent: Intent = {
    id: generateIntentId(),
    action: 'transfer',
    protocol: 'Ethereum',
    amount: 0.001,                     // well under 0.02 ETH/day cap
    token: 'ETH',
    recipient: config.keeperhubWalletAddress, // self-transfer for safe testing
    rationale: 'Checkpoint 1: Prove full pipeline execution on Sepolia testnet via KeeperHub',
    confidence: 0.95,
    createdAt: new Date().toISOString(),
  };

  const result = await pipeline.run(intent);

  // ─── Final Summary ───
  console.log('\n' + '═'.repeat(60));
  console.log('📊 PIPELINE RESULT');
  console.log('═'.repeat(60));
  console.log(`  Outcome:     ${result.outcome.toUpperCase()}`);
  console.log(`  Intent ID:   ${result.intent.id}`);
  console.log(`  Verdict:     ${result.policyVerdict.verdict}`);

  if (result.receipt?.transactionHash) {
    console.log(`\n  🎯 TRANSACTION HASH: ${result.receipt.transactionHash}`);
    console.log(`  🌐 EXPLORER LINK:   ${result.receipt.transactionLink}`);
  }

  console.log('\n' + '═'.repeat(60));

  // Export audit ledger
  const auditPath = './audit-ledger.json';
  const fs = await import('fs');
  fs.writeFileSync(auditPath, pipeline.getAuditJSON());
  console.log(`\n💾 Audit ledger exported to: ${auditPath}`);
}

main().catch((err) => {
  console.error('\n💥 Pipeline failed:', err);
  process.exit(1);
});
