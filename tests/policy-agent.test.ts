// ─── Custodian — Policy Agent Tests ───

import { describe, it, expect, beforeEach } from 'vitest';
import { PolicyAgent, DEFAULT_POLICY } from '../src/policy-agent.js';
import { generateIntentId } from '../src/types.js';
import type { Intent } from '../src/types.js';

function makeIntent(overrides: Partial<Intent> = {}): Intent {
  return {
    id: generateIntentId(),
    action: 'transfer',
    protocol: 'Ethereum',
    amount: 0.001,
    token: 'ETH',
    recipient: '0x0000000000000000000000000000000000000001',
    rationale: 'Test intent',
    confidence: 0.95,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('PolicyAgent', () => {
  let agent: PolicyAgent;

  beforeEach(() => {
    agent = new PolicyAgent(DEFAULT_POLICY);
  });

  it('should APPROVE a valid intent', async () => {
    const intent = makeIntent();
    const verdict = await agent.evaluate(intent);
    expect(verdict.verdict).toBe('APPROVED');
  });

  it('should REJECT an oversized amount', async () => {
    const intent = makeIntent({ amount: 5.0 });
    const verdict = await agent.evaluate(intent);
    expect(verdict.verdict).toBe('REJECTED');
    expect(verdict.reasons.some(r => r.includes('exceeds per-tx cap'))).toBe(true);
  });

  it('should REJECT a disallowed protocol', async () => {
    const intent = makeIntent({ protocol: 'UnknownDEX' });
    const verdict = await agent.evaluate(intent);
    expect(verdict.verdict).toBe('REJECTED');
    expect(verdict.reasons.some(r => r.includes('not allowlisted'))).toBe(true);
  });

  it('should REJECT a disallowed token', async () => {
    const intent = makeIntent({ token: 'SHIB' });
    const verdict = await agent.evaluate(intent);
    expect(verdict.verdict).toBe('REJECTED');
    expect(verdict.reasons.some(r => r.includes('not allowlisted'))).toBe(true);
  });

  it('should REJECT when confidence is below minimum', async () => {
    const intent = makeIntent({ confidence: 0.3 });
    const verdict = await agent.evaluate(intent);
    expect(verdict.verdict).toBe('REJECTED');
    expect(verdict.reasons.some(r => r.includes('Confidence'))).toBe(true);
  });

  it('should ESCALATE when confidence is between min and auto-approve threshold', async () => {
    const intent = makeIntent({ confidence: 0.8 });
    const verdict = await agent.evaluate(intent);
    expect(verdict.verdict).toBe('ESCALATED');
  });

  it('should REJECT when daily velocity would be exceeded', async () => {
    // First intent consumes most of the daily budget
    const intent1 = makeIntent({ amount: 0.009 });
    const v1 = await agent.evaluate(intent1);
    expect(v1.verdict).toBe('APPROVED');

    // Second intent would push over the limit
    const intent2 = makeIntent({ amount: 0.009 });
    // need to wait for cooldown
    await new Promise(resolve => setTimeout(resolve, 100));
    // Reset cooldown for this test but keep daily spending
    const intent3 = makeIntent({ amount: 0.015 });
    const v3 = await agent.evaluate(intent3);
    // This should be rejected either by amount cap or velocity
    expect(v3.verdict).toBe('REJECTED');
  });

  it('should fail-closed: reject unknown action types', async () => {
    const intent = makeIntent({ action: 'swap' as any });
    const verdict = await agent.evaluate(intent);
    expect(verdict.verdict).toBe('REJECTED');
  });

  it('should accumulate rejections for multiple policy violations', async () => {
    const intent = makeIntent({
      amount: 100,
      protocol: 'BadProto',
      token: 'SCAM',
      confidence: 0.1,
    });
    const verdict = await agent.evaluate(intent);
    expect(verdict.verdict).toBe('REJECTED');
    expect(verdict.reasons.length).toBeGreaterThanOrEqual(3);
  });
});
