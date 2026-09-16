// ─── Custodian — Pipeline ───
// The core pipeline: Intent → Policy → Simulate → Execute → Audit
// Shared between all demo scripts and the eventual LangGraph orchestrator.

import type { CustodianConfig } from './config.js';
import type { Intent, PolicyVerdict, SimulationResult, ExecutionReceipt } from './types.js';
import { PolicyAgent, PolicyConfig, DEFAULT_POLICY } from './policy-agent.js';
import { ExecutionAgent } from './execution-agent.js';
import { AuditAgent } from './audit-agent.js';

export interface PipelineResult {
  intent: Intent;
  policyVerdict: PolicyVerdict;
  simulation?: SimulationResult;
  receipt?: ExecutionReceipt;
  outcome: 'executed' | 'blocked' | 'escalated' | 'simulation-failed';
}

export class CustodianPipeline {
  private policyAgent: PolicyAgent;
  private executionAgent: ExecutionAgent;
  private auditAgent: AuditAgent;
  private config: CustodianConfig;

  constructor(config: CustodianConfig, policyConfig?: PolicyConfig) {
    this.config = config;
    this.policyAgent = new PolicyAgent(policyConfig || DEFAULT_POLICY);
    this.executionAgent = new ExecutionAgent(config);
    this.auditAgent = new AuditAgent();
  }

  async run(intent: Intent): Promise<PipelineResult> {
    const now = () => new Date().toISOString();
    const modeTag = this.config.mode === 'mock' ? '[MOCK]' : '[LIVE]';

    // ─── Stage 1: Log Proposal ───
    console.log(`\n📋 [Strategist Agent] ${modeTag} Intent Proposed:`);
    console.log(`   ID:         ${intent.id}`);
    console.log(`   Action:     ${intent.action}`);
    console.log(`   Amount:     ${intent.amount} ${intent.token}`);
    console.log(`   Protocol:   ${intent.protocol}`);
    console.log(`   Recipient:  ${intent.recipient}`);
    console.log(`   Confidence: ${intent.confidence}`);
    console.log(`   Rationale:  ${intent.rationale}`);

    this.auditAgent.log({
      intentId: intent.id,
      stage: 'proposal',
      timestamp: now(),
      data: intent,
    });

    // ─── Stage 2: Policy Gate ───
    console.log(`\n🛡️  [Policy Agent] ${modeTag} Evaluating intent against rules...`);
    const verdict = await this.policyAgent.evaluate(intent);

    this.auditAgent.log({
      intentId: intent.id,
      stage: 'policy',
      timestamp: now(),
      data: verdict,
    });

    if (verdict.verdict === 'REJECTED') {
      console.log(`   ❌ REJECTED:`);
      for (const reason of verdict.reasons) {
        console.log(`      → ${reason}`);
      }
      this.auditAgent.printSummary();
      return { intent, policyVerdict: verdict, outcome: 'blocked' };
    }

    if (verdict.verdict === 'ESCALATED') {
      console.log(`   ⚠️  ESCALATED to human review:`);
      for (const reason of verdict.reasons) {
        console.log(`      → ${reason}`);
      }
      this.auditAgent.printSummary();
      return { intent, policyVerdict: verdict, outcome: 'escalated' };
    }

    console.log(`   ✅ APPROVED: ${verdict.reasons[0]}`);

    // ─── Stage 3: Simulation ───
    console.log(`\n🔍 [Execution Agent] ${modeTag} Simulating transaction...`);
    const simulation = await this.executionAgent.simulate(intent);

    this.auditAgent.log({
      intentId: intent.id,
      stage: 'simulation',
      timestamp: now(),
      data: simulation,
    });

    if (!simulation.success || simulation.wouldRevert) {
      console.log(`   ❌ Simulation FAILED:`);
      console.log(`      success: ${simulation.success}, wouldRevert: ${simulation.wouldRevert}`);
      if (simulation.details) {
        console.log(`      details: ${JSON.stringify(simulation.details, null, 2)}`);
      }
      this.auditAgent.printSummary();
      return { intent, policyVerdict: verdict, simulation, outcome: 'simulation-failed' };
    }

    console.log(`   ✅ Simulation passed (success: true, wouldRevert: false)`);

    // ─── Stage 4: Execute ───
    console.log(`\n⚡ [Execution Agent] ${modeTag} Broadcasting transaction...`);
    const receipt = await this.executionAgent.execute(intent, simulation);

    this.auditAgent.log({
      intentId: intent.id,
      stage: 'execution',
      timestamp: now(),
      data: receipt,
    });

    console.log(`   ✅ Transaction ${receipt.status}!`);
    console.log(`   📦 Execution ID: ${receipt.executionId}`);
    if (receipt.transactionHash) {
      console.log(`   🔗 Tx Hash:      ${receipt.transactionHash}`);
    }
    if (receipt.transactionLink) {
      console.log(`   🌐 Explorer:     ${receipt.transactionLink}`);
    }
    if (receipt.gasUsedWei) {
      console.log(`   ⛽ Gas Used:     ${receipt.gasUsedWei} wei`);
    }

    // ─── Print Audit Summary ───
    this.auditAgent.printSummary();

    return { intent, policyVerdict: verdict, simulation, receipt, outcome: 'executed' };
  }

  getAuditLedger() {
    return this.auditAgent.getFullLedger();
  }

  getAuditJSON() {
    return this.auditAgent.exportJSON();
  }
}
