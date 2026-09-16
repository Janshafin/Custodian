// ─── Custodian — Audit Agent Tests ───

import { describe, it, expect } from 'vitest';
import { AuditAgent } from '../src/audit-agent.js';

describe('AuditAgent', () => {
  it('should log entries with HMAC signatures', () => {
    const agent = new AuditAgent();
    const entry = agent.log({
      intentId: 'test-1',
      stage: 'proposal',
      timestamp: new Date().toISOString(),
      data: { test: true } as any,
    });

    expect(entry.hmac).toBeDefined();
    expect(entry.hmac!.length).toBe(64);
  });

  it('should verify valid entries', () => {
    const agent = new AuditAgent();
    const entry = agent.log({
      intentId: 'test-2',
      stage: 'policy',
      timestamp: new Date().toISOString(),
      data: { verdict: 'APPROVED' } as any,
    });

    expect(agent.verify(entry)).toBe(true);
  });

  it('should detect tampered entries', () => {
    const agent = new AuditAgent();
    const entry = agent.log({
      intentId: 'test-3',
      stage: 'execution',
      timestamp: new Date().toISOString(),
      data: { status: 'completed' } as any,
    });

    // Tamper with the entry
    const tampered = { ...entry, intentId: 'tampered-id' };
    expect(agent.verify(tampered)).toBe(false);
  });

  it('should maintain append-only ledger', () => {
    const agent = new AuditAgent();
    agent.log({ intentId: '1', stage: 'proposal', timestamp: '', data: {} as any });
    agent.log({ intentId: '2', stage: 'policy', timestamp: '', data: {} as any });

    const ledger = agent.getFullLedger();
    expect(ledger.length).toBe(2);
    expect(ledger[0].intentId).toBe('1');
    expect(ledger[1].intentId).toBe('2');
  });

  it('should export valid JSON', () => {
    const agent = new AuditAgent();
    agent.log({ intentId: '1', stage: 'proposal', timestamp: '', data: {} as any });
    const json = agent.exportJSON();
    expect(() => JSON.parse(json)).not.toThrow();
  });
});
