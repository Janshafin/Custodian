import * as dotenv from 'dotenv';
import { Engine } from 'json-rules-engine';
import fs from 'fs';
import path from 'path';

dotenv.config();

const KEEPERHUB_API_KEY = process.env.KEEPERHUB_API_KEY;
const KEEPERHUB_WALLET_ADDRESS = process.env.KEEPERHUB_WALLET_ADDRESS;

if (!KEEPERHUB_API_KEY || !KEEPERHUB_WALLET_ADDRESS) {
  console.error("❌ ERROR: KEEPERHUB_API_KEY and KEEPERHUB_WALLET_ADDRESS must be set in the .env file.");
  process.exit(1);
}

// 1. Define a hand-written Intent
const intent = {
  action: 'transfer',
  amount: 0.001, // well under the 0.02 ETH/day limit
  protocol: 'Base',
  rationale: 'Funding operational wallet on Base Sepolia',
  confidence: 0.99
};

console.log(`\n📋 [Strategist Agent] Created Intent:`);
console.log(JSON.stringify(intent, null, 2));

// 2. Policy Agent Evaluates the Intent
async function evaluatePolicy(intent: any) {
  console.log(`\n🛡️  [Policy Agent] Evaluating Intent against rules...`);
  const engine = new Engine();
  
  // Load policy rules
  const policyPath = path.join(__dirname, 'policy.json');
  const policyContent = fs.readFileSync(policyPath, 'utf8');
  const policy = JSON.parse(policyContent);
  
  engine.addRule(policy);
  
  const results = await engine.run({ intent });
  
  if (results.events.length > 0) {
    console.log(`✅ [Policy Agent] APPROVED: ${results.events[0].params?.message}`);
    return true;
  } else {
    console.log(`❌ [Policy Agent] REJECTED: Intent violates policy.`);
    return false;
  }
}

// 3 & 4. Execution Agent: Simulates and Executes via KeeperHub
async function executeIntent(intent: any) {
  console.log(`\n⚙️  [Execution Agent] Preparing to execute...`);
  
  // For Checkpoint 1, we will do a basic transfer using the Direct Execution REST API
  // Note: This requires KeeperHub API integration which we will flesh out next.
  
  const payload = {
    simulate: true,
    chainId: 84532, // Base Sepolia
    to: KEEPERHUB_WALLET_ADDRESS, // Sending to ourselves for testing
    value: (intent.amount * 10 ** 18).toString(), // convert ETH to Wei
  };

  console.log(`\n🔍 [Execution Agent] Simulating via KeeperHub REST API...`);
  console.log(JSON.stringify(payload, null, 2));
  
  // TODO: Call https://app.keeperhub.com/api/execute/transfer
  console.log(`\n⚠️  Waiting for API integration...`);
}

async function main() {
  const isApproved = await evaluatePolicy(intent);
  if (isApproved) {
    await executeIntent(intent);
  }
}

main().catch(console.error);
