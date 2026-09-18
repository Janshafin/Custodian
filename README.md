# 🏛️ Custodian

**A multi-agent treasury swarm with KeeperHub as its execution boundary.**

> Built for [KeeperHub — The Agent Economy Hackathon](https://dorahacks.io/hackathon/agent-economy/detail) (DoraHacks, Sep 2026)

## Architecture

Custodian splits the classic "agent decides and executes" monolith into **five agents** with strict privilege isolation. Reasoning is allowed to be probabilistic; the boundary where fuzziness meets money transfer is not.

```
┌─────────────────────────────────────────────────────────────────┐
│                      CUSTODIAN PIPELINE                        │
│                                                                 │
│  ┌──────────────┐    ┌─────────────────┐    ┌───────────────┐  │
│  │ Signal Agent  │───▶│ Strategist Agent │───▶│  Intent {}    │  │
│  │  (LLM, R/O)  │    │   (LLM)         │    │  Structured   │  │
│  └──────────────┘    └─────────────────┘    └───────┬───────┘  │
│                                                      │          │
│                                              ┌───────▼───────┐  │
│                                              │ Policy Agent  │  │
│                                              │ (Rules Engine)│  │
│                                              │ FAIL-CLOSED   │  │
│                                              └───┬───────┬───┘  │
│                                       APPROVED   │       │ REJECTED
│                                              ┌───▼───┐   │      │
│                                              │Exec.  │   └──▶ ✋ │
│                                              │Agent  │         │
│                                              │(KH)   │         │
│                                              └───┬───┘         │
│                                                  │              │
│  ┌──────────────┐                        ┌───────▼───────┐     │
│  │ Audit Agent  │◀───────────────────────│  KeeperHub    │     │
│  │ HMAC Ledger  │                        │  simulate →   │     │
│  └──────────────┘                        │  execute →    │     │
│                                          │  poll status  │     │
│                                          └───────────────┘     │
└─────────────────────────────────────────────────────────────────┘
```

| Agent | Nature | Job | Access |
|---|---|---|---|
| **Signal Agent** | Probabilistic (LLM) | Watches on-chain/off-chain state, proposes actions | Read-only |
| **Strategist Agent** | Probabilistic (LLM) | Turns signals into structured Intent objects | Read-only |
| **Policy Agent** | Deterministic (json-rules-engine) | Evaluates intents: caps, allowlists, cooldowns, velocity | Read-only over Intents |
| **Execution Agent** | Deterministic | The ONLY component with KeeperHub credentials | KeeperHub API only |
| **Audit Agent** | Deterministic | HMAC-signed append-only ledger of every stage | Read-only over ledger |

## Quick Start

### Prerequisites
- Node.js 20+
- npm

### Install
```bash
git clone https://github.com/Janshafin/Custodian.git
cd Custodian
npm install
```

### Run in Mock Mode (zero secrets, instant — for judges)
```bash
npm run demo           # Full pipeline: Intent → Policy → Simulate → Execute → Receipt
npm run demo:blocked   # Adversarial: 4 malicious intents blocked by Policy Agent
npm test               # 19 tests covering policy, pipeline, and audit integrity
```

### Run in Live Mode (real KeeperHub testnet)
```bash
# 1. Create .env file:
echo "CUSTODIAN_MODE=live" > .env
echo "KEEPERHUB_API_KEY=kh_your_key" >> .env
echo "KEEPERHUB_WALLET_ADDRESS=0xYourAddress" >> .env

# 2. Ensure wallet has Sepolia ETH

# 3. Run:
npm run demo:live
```

## Demo Commands

| Command | What it does |
|---|---|
| `npm run demo` | Mock mode: full pipeline, prints mock tx hash |
| `npm run demo:live` | Live mode: real KeeperHub API calls on Ethereum Sepolia |
| `npm run demo:blocked` | Adversarial tests proving policy gate blocks unauthorized intents |
| `npm run dashboard` | Opens the interactive dashboard UI at http://localhost:8080 |
| `npm test` | Run all 19 unit/integration tests |

## Live Transaction Proof

> **🔗 Transaction Hash:** *(will be populated after first live run)*
>
> **🌐 Explorer:** *(Sepolia Etherscan link)*

## Integration Target: Superfluid

We integrate with **Superfluid** — a token streaming protocol for continuous payments. The agents evaluate treasury conditions and decide whether to start/stop/modify payment streams. The Policy Agent enforces hard limits on flow rates, protecting the treasury from runaway agent behavior.

**Why Superfluid fits:**
- Real-time streaming payments = continuous decision surface for agents
- Flow rate caps = natural fit for Policy Agent rules
- KeeperHub already has a [Superfluid plugin](https://docs.keeperhub.com/plugins/superfluid)
- Not saturated in prior hackathon submissions

## What's Genuinely Live vs. Testnet vs. Mocked

| Component | Status |
|---|---|
| **Policy Agent** (json-rules-engine) | ✅ Fully live — runs locally, no API needed |
| **Audit Agent** (HMAC ledger) | ✅ Fully live — cryptographic integrity verification |
| **Execution Agent** (KeeperHub REST) | ✅ Live on Ethereum Sepolia testnet (with API key) |
| **Signal Agent** (Superfluid data) | 🚧 Checkpoint 3 — reads real on-chain data |
| **Strategist Agent** (LLM confidence) | 🚧 Checkpoint 4 — uses LLM for rationale |
| **Dashboard** | ✅ Interactive glassmorphism UI — pipeline runner, policy visualizer, audit ledger |
| **Mock mode** | ✅ Fully functional — same code path, zero secrets |

## Test Coverage

```
 ✓ tests/policy-agent.test.ts    — 9 tests (approval, rejection, escalation, velocity, fail-closed)
 ✓ tests/pipeline.test.ts        — 5 tests (full flow, blocking, escalation, audit ledger, JSON export)
 ✓ tests/audit-agent.test.ts     — 5 tests (HMAC signing, verification, tamper detection, append-only)
```

## Tech Stack

- **Orchestration:** TypeScript + tsx runtime (LangGraph-ready architecture)
- **Policy Engine:** [json-rules-engine](https://npmjs.com/package/json-rules-engine) — deterministic, YAML-definable
- **Execution:** KeeperHub Direct Execution REST API (simulate → execute → poll)
- **Wallet:** KeeperHub's Turnkey-backed non-custodial wallet — no custom key management
- **Audit:** HMAC-SHA256 signed append-only ledger with tamper detection
- **Testing:** Vitest — 19 tests, <400ms

## Project Structure

```
src/
├── config.ts          # Mock/Live mode switching, env loading
├── types.ts           # Intent, PolicyVerdict, SimulationResult, ExecutionReceipt
├── policy-agent.ts    # Deterministic rules engine (json-rules-engine)
├── execution-agent.ts # KeeperHub API integration (simulate → execute → poll)
├── audit-agent.ts     # HMAC-signed append-only ledger
├── pipeline.ts        # Orchestrates all agents in sequence
├── demo.ts            # npm run demo / npm run demo:live
└── demo-blocked.ts    # npm run demo:blocked (adversarial tests)
dashboard/
├── index.html         # Dashboard UI — single-page app
├── styles.css         # Glassmorphism light theme design system
└── app.js             # Pipeline simulation, policy engine, audit ledger
tests/
├── policy-agent.test.ts
├── pipeline.test.ts
└── audit-agent.test.ts
```

## License

MIT
