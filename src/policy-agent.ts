// ─── Custodian — Policy Agent ───
// Deterministic rules engine (json-rules-engine). NOT an LLM.
// Fail-closed: anything not explicitly allowed is REJECTED.

import { Engine, RuleProperties } from 'json-rules-engine';
import type { Intent, PolicyVerdict } from './types.js';

export interface PolicyConfig {
  maxAmountPerTx: number;       // e.g. 0.01 ETH
  maxDailyVelocity: number;     // e.g. 0.02 ETH (matches KeeperHub default)
  allowedProtocols: string[];   // e.g. ['Superfluid', 'Base', 'Ethereum']
  allowedTokens: string[];      // e.g. ['ETH', 'USDC']
  allowedActions: string[];     // e.g. ['transfer', 'contract-call']
  minConfidence: number;        // e.g. 0.7
  cooldownMs: number;           // milliseconds between executions
}

// Default conservative policy
export const DEFAULT_POLICY: PolicyConfig = {
  maxAmountPerTx: 0.01,         // well under 0.02 ETH/day spend cap
  maxDailyVelocity: 0.02,
  allowedProtocols: ['Superfluid', 'Ethereum'],
  allowedTokens: ['ETH'],
  allowedActions: ['transfer', 'contract-call'],
  minConfidence: 0.7,
  cooldownMs: 10_000,           // 10s cooldown
};

export class PolicyAgent {
  private engine: Engine;
  private dailySpent: number = 0;
  private lastExecutionAt: number = 0;
  private policy: PolicyConfig;

  constructor(policy: PolicyConfig = DEFAULT_POLICY) {
    this.policy = policy;
    this.engine = new Engine();
    this.setupRules();
  }

  private setupRules(): void {
    // Rule 1: Amount must be within per-tx cap
    const amountRule: RuleProperties = {
      conditions: {
        all: [{
          fact: 'amount',
          operator: 'lessThanInclusive',
          value: this.policy.maxAmountPerTx,
        }],
      },
      event: { type: 'amount-ok' },
      priority: 10,
    };

    // Rule 2: Protocol must be allowlisted
    const protocolRule: RuleProperties = {
      conditions: {
        all: [{
          fact: 'protocol',
          operator: 'in',
          value: this.policy.allowedProtocols,
        }],
      },
      event: { type: 'protocol-ok' },
      priority: 10,
    };

    // Rule 3: Token must be allowlisted
    const tokenRule: RuleProperties = {
      conditions: {
        all: [{
          fact: 'token',
          operator: 'in',
          value: this.policy.allowedTokens,
        }],
      },
      event: { type: 'token-ok' },
      priority: 10,
    };

    // Rule 4: Action must be allowlisted
    const actionRule: RuleProperties = {
      conditions: {
        all: [{
          fact: 'action',
          operator: 'in',
          value: this.policy.allowedActions,
        }],
      },
      event: { type: 'action-ok' },
      priority: 10,
    };

    // Rule 5: Confidence must meet minimum
    const confidenceRule: RuleProperties = {
      conditions: {
        all: [{
          fact: 'confidence',
          operator: 'greaterThanInclusive',
          value: this.policy.minConfidence,
        }],
      },
      event: { type: 'confidence-ok' },
      priority: 10,
    };

    this.engine.addRule(amountRule);
    this.engine.addRule(protocolRule);
    this.engine.addRule(tokenRule);
    this.engine.addRule(actionRule);
    this.engine.addRule(confidenceRule);
  }

  async evaluate(intent: Intent): Promise<PolicyVerdict> {
    const now = new Date().toISOString();
    const reasons: string[] = [];

    // Run rules engine
    const { events, failureEvents } = await this.engine.run({
      amount: intent.amount,
      protocol: intent.protocol,
      token: intent.token,
      action: intent.action,
      confidence: intent.confidence,
    });

    const passedChecks = new Set(events.map((e: { type: string }) => e.type));
    const allChecks = ['amount-ok', 'protocol-ok', 'token-ok', 'action-ok', 'confidence-ok'];

    for (const check of allChecks) {
      if (!passedChecks.has(check)) {
        switch (check) {
          case 'amount-ok':
            reasons.push(`Amount ${intent.amount} exceeds per-tx cap of ${this.policy.maxAmountPerTx}`);
            break;
          case 'protocol-ok':
            reasons.push(`Protocol "${intent.protocol}" is not allowlisted [${this.policy.allowedProtocols.join(', ')}]`);
            break;
          case 'token-ok':
            reasons.push(`Token "${intent.token}" is not allowlisted [${this.policy.allowedTokens.join(', ')}]`);
            break;
          case 'action-ok':
            reasons.push(`Action "${intent.action}" is not allowlisted [${this.policy.allowedActions.join(', ')}]`);
            break;
          case 'confidence-ok':
            reasons.push(`Confidence ${intent.confidence} below minimum ${this.policy.minConfidence}`);
            break;
        }
      }
    }

    // Daily velocity check (not in rules engine — stateful)
    if (this.dailySpent + intent.amount > this.policy.maxDailyVelocity) {
      reasons.push(`Daily velocity would reach ${this.dailySpent + intent.amount}, exceeding cap of ${this.policy.maxDailyVelocity}`);
    }

    // Cooldown check
    const timeSinceLast = Date.now() - this.lastExecutionAt;
    if (this.lastExecutionAt > 0 && timeSinceLast < this.policy.cooldownMs) {
      reasons.push(`Cooldown: ${this.policy.cooldownMs - timeSinceLast}ms remaining`);
    }

    // Escalation check
    if (reasons.length === 0 && intent.confidence < 0.9) {
      return {
        intentId: intent.id,
        verdict: 'ESCALATED',
        reasons: [`Confidence ${intent.confidence} is below auto-approval threshold (0.9) — requires human review`],
        evaluatedAt: now,
      };
    }

    if (reasons.length > 0) {
      return {
        intentId: intent.id,
        verdict: 'REJECTED',
        reasons,
        evaluatedAt: now,
      };
    }

    // Approved — update state
    this.dailySpent += intent.amount;
    this.lastExecutionAt = Date.now();

    return {
      intentId: intent.id,
      verdict: 'APPROVED',
      reasons: ['All policy checks passed.'],
      evaluatedAt: now,
    };
  }

  // Reset daily counters (for testing / cron)
  resetDaily(): void {
    this.dailySpent = 0;
  }
}
