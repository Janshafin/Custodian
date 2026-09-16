#!/usr/bin/env npx tsx
// ─── Custodian — Demo: Adversarial Blocked Intent ───
// Checkpoint 2: Prove the Policy Agent rejects unauthorized intents
//               BEFORE they ever reach KeeperHub.
//
// Usage:
//   npm run demo:blocked

import { loadConfig } from './config.js';
import { CustodianPipeline } from './pipeline.js';
import { generateIntentId } from './types.js';
import type { Intent } from './types.js';

async function main() {
  const config = loadConfig();

  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║      🛡️  CUSTODIAN — Adversarial Policy Test            ║');
  console.log('║   Proving the safety boundary isn\'t decorative          ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log(`\n  Mode: ${config.mode.toUpperCase()} (policy runs locally — no API calls needed)\n`);

  const pipeline = new CustodianPipeline(config);
  let allBlocked = true;

  // ─── Test 1: Oversized Amount ───
  console.log('━'.repeat(60));
  console.log('  TEST 1: Oversized amount (5 ETH vs 0.01 ETH cap)');
  console.log('━'.repeat(60));

  const oversized: Intent = {
    id: generateIntentId(),
    action: 'transfer',
    protocol: 'Ethereum',
    amount: 5.0,           // way over the 0.01 cap
    token: 'ETH',
    recipient: '0x0000000000000000000000000000000000000002',
    rationale: 'Adversarial test: oversized transfer',
    confidence: 0.95,
    createdAt: new Date().toISOString(),
  };

  const r1 = await pipeline.run(oversized);
  if (r1.outcome !== 'blocked') allBlocked = false;

  // ─── Test 2: Disallowed Protocol ───
  console.log('\n' + '━'.repeat(60));
  console.log('  TEST 2: Disallowed protocol (UnknownDEX not in allowlist)');
  console.log('━'.repeat(60));

  const badProtocol: Intent = {
    id: generateIntentId(),
    action: 'transfer',
    protocol: 'UnknownDEX',   // not in allowlist
    amount: 0.001,
    token: 'ETH',
    recipient: '0x0000000000000000000000000000000000000002',
    rationale: 'Adversarial test: disallowed protocol',
    confidence: 0.95,
    createdAt: new Date().toISOString(),
  };

  const r2 = await pipeline.run(badProtocol);
  if (r2.outcome !== 'blocked') allBlocked = false;

  // ─── Test 3: Disallowed Token ───
  console.log('\n' + '━'.repeat(60));
  console.log('  TEST 3: Disallowed token (SHIB not in allowlist)');
  console.log('━'.repeat(60));

  const badToken: Intent = {
    id: generateIntentId(),
    action: 'transfer',
    protocol: 'Ethereum',
    amount: 0.001,
    token: 'SHIB',            // not in allowlist
    recipient: '0x0000000000000000000000000000000000000002',
    rationale: 'Adversarial test: disallowed token',
    confidence: 0.95,
    createdAt: new Date().toISOString(),
  };

  const r3 = await pipeline.run(badToken);
  if (r3.outcome !== 'blocked') allBlocked = false;

  // ─── Test 4: Low Confidence (should escalate, not execute) ───
  console.log('\n' + '━'.repeat(60));
  console.log('  TEST 4: Low confidence (0.5 → should escalate to human)');
  console.log('━'.repeat(60));

  const lowConfidence: Intent = {
    id: generateIntentId(),
    action: 'transfer',
    protocol: 'Ethereum',
    amount: 0.001,
    token: 'ETH',
    recipient: '0x0000000000000000000000000000000000000002',
    rationale: 'Adversarial test: low confidence intent',
    confidence: 0.5,           // below 0.7 threshold → rejected; between 0.7-0.9 → escalated
    createdAt: new Date().toISOString(),
  };

  const r4 = await pipeline.run(lowConfidence);
  if (r4.outcome !== 'blocked') allBlocked = false;

  // ─── Final Summary ───
  console.log('\n' + '═'.repeat(60));
  console.log('📊 ADVERSARIAL TEST RESULTS');
  console.log('═'.repeat(60));
  console.log(`  Test 1 (oversized amount):     ${r1.outcome === 'blocked' ? '✅ BLOCKED' : '❌ NOT BLOCKED'}`);
  console.log(`  Test 2 (bad protocol):         ${r2.outcome === 'blocked' ? '✅ BLOCKED' : '❌ NOT BLOCKED'}`);
  console.log(`  Test 3 (bad token):            ${r3.outcome === 'blocked' ? '✅ BLOCKED' : '❌ NOT BLOCKED'}`);
  console.log(`  Test 4 (low confidence):       ${r4.outcome === 'blocked' ? '✅ BLOCKED' : r4.outcome === 'escalated' ? '⚠️  ESCALATED' : '❌ NOT BLOCKED'}`);
  console.log(`\n  Overall: ${allBlocked ? '✅ ALL adversarial intents were stopped before reaching KeeperHub' : '⚠️  Some intents were NOT blocked — check policy config'}`);
  console.log('═'.repeat(60));
}

main().catch((err) => {
  console.error('\n💥 Test failed:', err);
  process.exit(1);
});
