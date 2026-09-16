// ─── Custodian — Execution Agent ───
// The ONLY component with KeeperHub credentials.
// Takes an APPROVED intent, simulates, diffs, executes. Never re-derives actions.

import { randomUUID } from 'crypto';
import type { CustodianConfig } from './config.js';
import type { Intent, SimulationResult, ExecutionReceipt } from './types.js';

interface KeeperHubTransferPayload {
  network: string;
  recipientAddress: string;
  amount: string;
  tokenAddress?: string;
  simulate?: boolean;
}

interface KeeperHubWriteResult {
  executionId: string;
  status: string;
}

interface KeeperHubExecutionStatus {
  executionId: string;
  status: string;
  transactionHash?: string;
  transactionLink?: string;
  gasUsedWei?: string;
  error?: string | null;
}

export class ExecutionAgent {
  private config: CustodianConfig;

  constructor(config: CustodianConfig) {
    this.config = config;
  }

  // ─── Simulate ───
  async simulate(intent: Intent): Promise<SimulationResult> {
    const now = new Date().toISOString();

    if (this.config.mode === 'mock') {
      return this.mockSimulate(intent, now);
    }

    // Live mode: call KeeperHub with simulate: true
    const payload: KeeperHubTransferPayload = {
      network: this.config.networkName,
      recipientAddress: intent.recipient,
      amount: intent.amount.toString(),
      simulate: true,
    };

    try {
      const response = await fetch(`${this.config.keeperhubBaseUrl}/execute/transfer`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.keeperhubApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const body = await response.json() as any;

      if (!response.ok) {
        return {
          intentId: intent.id,
          success: false,
          wouldRevert: true,
          details: { error: body.error || body.message || response.statusText, statusCode: response.status },
          simulatedAt: now,
        };
      }

      return {
        intentId: intent.id,
        success: body.success !== false,
        wouldRevert: body.wouldRevert === true,
        executionId: body.executionId,
        details: body,
        simulatedAt: now,
      };
    } catch (err: any) {
      return {
        intentId: intent.id,
        success: false,
        wouldRevert: true,
        details: { error: err.message },
        simulatedAt: now,
      };
    }
  }

  // ─── Execute (only after simulation passes) ───
  async execute(intent: Intent, simulationResult: SimulationResult): Promise<ExecutionReceipt> {
    const now = new Date().toISOString();

    // SAFETY: Never execute if simulation failed
    if (!simulationResult.success || simulationResult.wouldRevert) {
      throw new Error(`Cannot execute: simulation failed or would revert for intent ${intent.id}`);
    }

    if (this.config.mode === 'mock') {
      return this.mockExecute(intent, now);
    }

    // Live mode: call KeeperHub WITHOUT simulate, WITH Idempotency-Key
    const idempotencyKey = randomUUID();
    const payload: KeeperHubTransferPayload = {
      network: this.config.networkName,
      recipientAddress: intent.recipient,
      amount: intent.amount.toString(),
    };

    const response = await fetch(`${this.config.keeperhubBaseUrl}/execute/transfer`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.keeperhubApiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify(payload),
    });

    const body = await response.json() as KeeperHubWriteResult;

    if (!response.ok) {
      throw new Error(`KeeperHub execution failed: ${JSON.stringify(body)}`);
    }

    // Poll for completion
    const receipt = await this.pollStatus(body.executionId, intent.id);
    return receipt;
  }

  // ─── Poll Status ───
  private async pollStatus(executionId: string, intentId: string): Promise<ExecutionReceipt> {
    const maxAttempts = 30;
    let attempt = 0;
    let pollInterval = 2000; // start with 2s

    while (attempt < maxAttempts) {
      attempt++;

      const response = await fetch(`${this.config.keeperhubBaseUrl}/execute/${executionId}/status`, {
        headers: {
          'Authorization': `Bearer ${this.config.keeperhubApiKey}`,
        },
      });

      // Respect X-Poll-Interval-Hint if present
      const hintHeader = response.headers.get('X-Poll-Interval-Hint');
      if (hintHeader) {
        const hintMs = parseInt(hintHeader, 10) * 1000;
        if (!isNaN(hintMs) && hintMs > 0) {
          pollInterval = hintMs;
        }
      }

      const body = await response.json() as KeeperHubExecutionStatus;
      const terminalStatuses = new Set(['completed', 'success', 'failed', 'error', 'cancelled']);

      if (terminalStatuses.has(body.status)) {
        return {
          intentId,
          executionId,
          status: body.status,
          transactionHash: body.transactionHash,
          transactionLink: body.transactionLink,
          gasUsedWei: body.gasUsedWei,
          completedAt: new Date().toISOString(),
        };
      }

      // "unconfirmed" is non-terminal — never resend, just keep polling
      console.log(`    ⏳ Status: ${body.status} (attempt ${attempt}/${maxAttempts}), polling again in ${pollInterval}ms...`);
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    throw new Error(`Execution ${executionId} did not reach terminal status after ${maxAttempts} attempts`);
  }

  // ─── Mock Implementations ───
  private mockSimulate(intent: Intent, now: string): SimulationResult {
    return {
      intentId: intent.id,
      success: true,
      wouldRevert: false,
      executionId: `mock-exec-${Date.now()}`,
      details: {
        mode: 'mock',
        simulatedPayload: {
          network: this.config.networkName,
          recipientAddress: intent.recipient,
          amount: intent.amount.toString(),
        },
      },
      simulatedAt: now,
    };
  }

  private mockExecute(intent: Intent, now: string): ExecutionReceipt {
    const mockTxHash = `0x${randomUUID().replace(/-/g, '')}${randomUUID().replace(/-/g, '').substring(0, 32)}`;
    return {
      intentId: intent.id,
      executionId: `mock-exec-${Date.now()}`,
      status: 'completed',
      transactionHash: mockTxHash,
      transactionLink: `${this.config.blockExplorerUrl}/tx/${mockTxHash}`,
      gasUsedWei: '21000',
      completedAt: now,
    };
  }
}
