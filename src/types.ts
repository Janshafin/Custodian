// ─── Custodian — Intent Schema ───
// The structured object that flows through every agent in the pipeline.

export type IntentAction = 'transfer' | 'contract-call';
export type IntentVerdict = 'PENDING' | 'APPROVED' | 'REJECTED' | 'ESCALATED';

export interface Intent {
  id: string;
  action: IntentAction;
  protocol: string;
  amount: number;         // human-readable (e.g. 0.001 ETH)
  token: string;          // 'ETH', 'USDC', etc.
  recipient: string;      // address or ENS
  rationale: string;
  confidence: number;     // 0–1, set by Strategist
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface PolicyVerdict {
  intentId: string;
  verdict: IntentVerdict;
  reasons: string[];
  evaluatedAt: string;
}

export interface SimulationResult {
  intentId: string;
  success: boolean;
  wouldRevert: boolean;
  executionId?: string;
  details?: Record<string, unknown>;
  simulatedAt: string;
}

export interface ExecutionReceipt {
  intentId: string;
  executionId: string;
  status: string;
  transactionHash?: string;
  transactionLink?: string;
  gasUsedWei?: string;
  completedAt: string;
}

export interface AuditEntry {
  intentId: string;
  stage: 'proposal' | 'policy' | 'simulation' | 'execution' | 'error';
  timestamp: string;
  data: Intent | PolicyVerdict | SimulationResult | ExecutionReceipt | { error: string };
  hmac?: string;
}

// Generate a simple unique ID
export function generateIntentId(): string {
  return `intent-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}
