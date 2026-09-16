// ─── Custodian — Audit Agent ───
// HMAC-signed, append-only ledger of every pipeline stage.

import { createHmac, randomBytes } from 'crypto';
import type { AuditEntry } from './types.js';

const HMAC_SECRET = process.env.CUSTODIAN_HMAC_SECRET || randomBytes(32).toString('hex');

export class AuditAgent {
  private ledger: AuditEntry[] = [];

  log(entry: Omit<AuditEntry, 'hmac'>): AuditEntry {
    const payload = JSON.stringify({
      intentId: entry.intentId,
      stage: entry.stage,
      timestamp: entry.timestamp,
      data: entry.data,
    });

    const hmac = createHmac('sha256', HMAC_SECRET).update(payload).digest('hex');
    const signedEntry: AuditEntry = { ...entry, hmac };
    this.ledger.push(signedEntry);
    return signedEntry;
  }

  getFullLedger(): AuditEntry[] {
    return [...this.ledger];
  }

  verify(entry: AuditEntry): boolean {
    const payload = JSON.stringify({
      intentId: entry.intentId,
      stage: entry.stage,
      timestamp: entry.timestamp,
      data: entry.data,
    });
    const expected = createHmac('sha256', HMAC_SECRET).update(payload).digest('hex');
    return expected === entry.hmac;
  }

  exportJSON(): string {
    return JSON.stringify(this.ledger, null, 2);
  }

  printSummary(): void {
    console.log(`\n📒 [Audit Agent] Ledger Summary (${this.ledger.length} entries):`);
    for (const entry of this.ledger) {
      const verified = this.verify(entry) ? '✓' : '✗';
      console.log(`  [${verified}] ${entry.stage.toUpperCase().padEnd(12)} | ${entry.intentId} | ${entry.timestamp}`);
    }
  }
}
