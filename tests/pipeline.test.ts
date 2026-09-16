// ─── Custodian — Pipeline Tests (Mock Mode) ───

import { describe, it, expect } from 'vitest';
import { CustodianPipeline } from '../src/pipeline.js';
import { generateIntentId } from '../src/types.js';
import type { Intent } from '../src/types.js';
import type { CustodianConfig } from '../src/config.js';

const MOCK_CONFIG: CustodianConfig = {
  mode: 'mock',
  keeperhubApiKey: 'kh_test',
  keeperhubBaseUrl: 'http://localhost:0',
  keeperhubWalletAddress: '0x0000000000000000000000000000000000000001',
  chainId: '11155111',
  networkName: 'ethereum-sepolia',
  blockExplorerUrl: 'https://sepolia.etherscan.io',
};

function makeIntent(overrides: Partial<Intent> = {}): Intent {
  return {
    id: generateIntentId(),
    action: 'transfer',
    protocol: 'Ethereum',
    amount: 0.001,
    token: 'ETH',
    recipient: '0x0000000000000000000000000000000000000001',
    rationale: 'Test pipeline intent',
    confidence: 0.95,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('CustodianPipeline (mock mode)', () => {
  it('should execute a valid intent through the full pipeline', async () => {
    const pipeline = new CustodianPipeline(MOCK_CONFIG);
    const result = await pipeline.run(makeIntent());

    expect(result.outcome).toBe('executed');
    expect(result.policyVerdict.verdict).toBe('APPROVED');
    expect(result.simulation?.success).toBe(true);
    expect(result.simulation?.wouldRevert).toBe(false);
    expect(result.receipt?.status).toBe('completed');
    expect(result.receipt?.transactionHash).toBeDefined();
  });

  it('should block an oversized intent', async () => {
    const pipeline = new CustodianPipeline(MOCK_CONFIG);
    const result = await pipeline.run(makeIntent({ amount: 999 }));

    expect(result.outcome).toBe('blocked');
    expect(result.policyVerdict.verdict).toBe('REJECTED');
    expect(result.simulation).toBeUndefined();
    expect(result.receipt).toBeUndefined();
  });

  it('should escalate a low-confidence intent', async () => {
    const pipeline = new CustodianPipeline(MOCK_CONFIG);
    const result = await pipeline.run(makeIntent({ confidence: 0.8 }));

    expect(result.outcome).toBe('escalated');
    expect(result.policyVerdict.verdict).toBe('ESCALATED');
  });

  it('should produce an audit ledger with all stages', async () => {
    const pipeline = new CustodianPipeline(MOCK_CONFIG);
    await pipeline.run(makeIntent());
    const ledger = pipeline.getAuditLedger();

    expect(ledger.length).toBe(4); // proposal, policy, simulation, execution
    expect(ledger[0].stage).toBe('proposal');
    expect(ledger[1].stage).toBe('policy');
    expect(ledger[2].stage).toBe('simulation');
    expect(ledger[3].stage).toBe('execution');

    // All entries should have HMAC signatures
    for (const entry of ledger) {
      expect(entry.hmac).toBeDefined();
      expect(entry.hmac!.length).toBe(64); // sha256 hex
    }
  });

  it('should export audit ledger as valid JSON', async () => {
    const pipeline = new CustodianPipeline(MOCK_CONFIG);
    await pipeline.run(makeIntent());
    const json = pipeline.getAuditJSON();
    expect(() => JSON.parse(json)).not.toThrow();
  });
});
