/* ═══════════════════════════════════════════════════════════
   Custodian Dashboard — Application Logic
   Frontend simulation of the multi-agent treasury pipeline
   ═══════════════════════════════════════════════════════════ */

// ── State ──
const state = {
  executed: 0,
  blocked: 0,
  escalated: 0,
  dailyVelocity: 0,
  lastExecutionAt: 0,
  activities: [],
  auditLedger: [],
  isRunning: false,
};

// ── Policy Configuration (mirrors src/policy-agent.ts) ──
const POLICY = {
  maxAmountPerTx: 0.01,
  maxDailyVelocity: 0.02,
  allowedProtocols: ['Superfluid', 'Ethereum'],
  allowedTokens: ['ETH'],
  allowedActions: ['transfer', 'contract-call'],
  minConfidence: 0.7,
  autoApprovalThreshold: 0.9,
  cooldownMs: 10_000,
};

// ── Utility ──
function generateIntentId() {
  return `intent-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

function generateHmac() {
  const chars = '0123456789abcdef';
  let hmac = '';
  for (let i = 0; i < 16; i++) hmac += chars[Math.floor(Math.random() * 16)];
  return hmac + '…';
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function timeAgo() {
  return 'just now';
}

// ── Hero: Liquid Obsidian Sphere ──
// A procedural WebGL scene: crisp at every size, no image/video asset needed.
function initLiquidSphere() {
  const canvas = document.getElementById('liquidSphere');
  if (!canvas || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const gl = canvas.getContext('webgl', { alpha: true, antialias: true, powerPreference: 'low-power' });
  if (!gl) return;
  const vertex = 'attribute vec2 p; void main(){ gl_Position=vec4(p,0.,1.); }';
  const fragment = `precision highp float;
    uniform vec2 r; uniform float t; uniform vec2 m;
    mat2 rot(float a){float s=sin(a),c=cos(a);return mat2(c,-s,s,c);}
    float hash(vec3 p){p=fract(p*.3183099+.1);p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
    float noise(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
    float fbm(vec3 p){float v=0.,a=.5;for(int i=0;i<4;i++){v+=a*noise(p);p=p*2.03+1.7;a*=.5;}return v;}
    void main(){vec2 uv=(2.*gl_FragCoord.xy-r.xy)/min(r.x,r.y);uv.y=-uv.y;vec3 ro=vec3(0.,0.,3.),rd=normalize(vec3(uv,-1.85));float wobble=.045*sin(t*.75+uv.y*5.)+.027*sin(t*1.3+uv.x*8.),b=dot(ro,rd),c=dot(ro,ro)-1.-wobble,h=b*b-c;if(h<0.)discard;float d=-b-sqrt(h);vec3 p=ro+rd*d;p.xy=rot(.12*sin(t*.3)+m.x*.13)*p.xy;float liquid=fbm(p*2.3+vec3(0.,t*.08,0.));vec3 n=normalize(p+.12*vec3(sin(p.y*8.+t),sin(p.z*8.-t*.7),sin(p.x*7.))*(liquid-.5)),view=normalize(ro-p),blue=normalize(vec3(-.7,.65,1.)),amber=normalize(vec3(.8,-.45,.55));float rim=pow(1.-max(0.,dot(n,view)),2.8),cool=pow(max(0.,dot(reflect(-view,n),blue)),7.),warm=pow(max(0.,dot(reflect(-view,n),amber)),14.),sheen=pow(max(0.,dot(n,normalize(vec3(-.4,.7,1.)))),8.);vec3 col=vec3(.004,.004,.006)+rim*vec3(.045,.055,.115)+cool*vec3(.12,.18,.38)+warm*vec3(.24,.105,.025)+sheen*vec3(.07,.085,.14);col+=(liquid-.52)*.012;float edge=smoothstep(1.03,.76,length(uv));gl_FragColor=vec4(col,edge*.98);}`;
  function shader(type, source) { const s = gl.createShader(type); gl.shaderSource(s, source); gl.compileShader(s); return s; }
  const program = gl.createProgram(); gl.attachShader(program, shader(gl.VERTEX_SHADER, vertex)); gl.attachShader(program, shader(gl.FRAGMENT_SHADER, fragment)); gl.linkProgram(program);
  const buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buffer); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]), gl.STATIC_DRAW);
  const position = gl.getAttribLocation(program, 'p'), resolution = gl.getUniformLocation(program, 'r'), time = gl.getUniformLocation(program, 't'), mouse = gl.getUniformLocation(program, 'm');
  let pointer = [0, 0], frame;
  const resize = () => { const scale = Math.min(window.devicePixelRatio || 1, 1.5); canvas.width = canvas.clientWidth * scale; canvas.height = canvas.clientHeight * scale; gl.viewport(0, 0, canvas.width, canvas.height); };
  const draw = now => { gl.useProgram(program); gl.bindBuffer(gl.ARRAY_BUFFER, buffer); gl.enableVertexAttribArray(position); gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0); gl.uniform2f(resolution, canvas.width, canvas.height); gl.uniform1f(time, now * .001); gl.uniform2f(mouse, pointer[0], pointer[1]); gl.drawArrays(gl.TRIANGLES, 0, 6); frame = requestAnimationFrame(draw); };
  window.addEventListener('resize', resize, { passive: true });
  window.addEventListener('pointermove', e => { pointer = [e.clientX / innerWidth - .5, e.clientY / innerHeight - .5]; }, { passive: true });
  resize(); frame = requestAnimationFrame(draw);
  document.addEventListener('visibilitychange', () => { if (document.hidden) cancelAnimationFrame(frame); else frame = requestAnimationFrame(draw); });
}

try { initLiquidSphere(); } catch (e) { console.warn('WebGL sphere skipped:', e); }

// ── Toast Notifications ──
function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('toast-out');
    setTimeout(() => toast.remove(), 250);
  }, 3000);
}

// ── Navigation ──
document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', (e) => {
    e.preventDefault();
    const sectionId = item.dataset.section;

    // Update nav
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    item.classList.add('active');

    // Update sections
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    const section = document.getElementById(`section-${sectionId}`);
    if (section) section.classList.add('active');
  });
});

// ── Confidence Slider ──
const confidenceSlider = document.getElementById('intentConfidence');
const confidenceValue = document.getElementById('confidenceValue');
if (confidenceSlider) {
  confidenceSlider.addEventListener('input', () => {
    confidenceValue.textContent = parseFloat(confidenceSlider.value).toFixed(2);
  });
}

// ── Stats Update ──
function updateStats() {
  animateNumber('statExecuted', state.executed);
  animateNumber('statBlocked', state.blocked);
  animateNumber('statEscalated', state.escalated);
  document.getElementById('statVelocity').textContent = state.dailyVelocity.toFixed(3);
}

function animateNumber(id, value) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = value;
  el.classList.add('bump');
  setTimeout(() => el.classList.remove('bump'), 300);
}

// ── Pipeline Visualization ──
function resetPipeline() {
  document.querySelectorAll('.pipeline-stage').forEach(s => {
    s.classList.remove('active', 'passed', 'failed', 'escalated');
  });
  document.querySelectorAll('.pipeline-connector').forEach(c => {
    c.classList.remove('active', 'passed');
  });
  document.getElementById('pipelineStatus').textContent = 'Idle';
  document.getElementById('pipelineStatus').className = 'meta-text';
}

async function activateStage(stageId, status = 'active') {
  const stage = document.getElementById(`stage-${stageId}`);
  if (!stage) return;

  // Activate connectors before this stage
  const stages = ['signal', 'strategist', 'policy', 'execution', 'audit'];
  const idx = stages.indexOf(stageId);

  stage.classList.add(status);

  if (status === 'active') {
    document.getElementById('pipelineStatus').textContent = 'Running';
    document.getElementById('pipelineStatus').className = 'meta-text';
  }

  // Mark connector as active/passed
  if (idx > 0) {
    const connectors = document.querySelectorAll('.pipeline-connector');
    if (connectors[idx - 1]) {
      connectors[idx - 1].classList.add(status === 'active' ? 'active' : 'passed');
    }
  }
}

async function finishStage(stageId, result) {
  const stage = document.getElementById(`stage-${stageId}`);
  if (!stage) return;
  stage.classList.remove('active');
  stage.classList.add(result);

  // Update connector
  const stages = ['signal', 'strategist', 'policy', 'execution', 'audit'];
  const idx = stages.indexOf(stageId);
  if (idx > 0) {
    const connectors = document.querySelectorAll('.pipeline-connector');
    if (connectors[idx - 1]) {
      connectors[idx - 1].classList.remove('active');
      connectors[idx - 1].classList.add(result === 'passed' ? 'passed' : '');
    }
  }
}

// ── Terminal Output ──
function appendTerminal(text, cls = '') {
  const terminal = document.getElementById('pipelineOutput');
  // Remove "Waiting" message on first output
  const waitingMsg = terminal.querySelector('.terminal-dim');
  if (waitingMsg && waitingMsg.textContent === 'Waiting for intent...') {
    waitingMsg.remove();
  }

  const line = document.createElement('div');
  line.className = `terminal-line ${cls}`;
  line.textContent = text;
  terminal.appendChild(line);
  terminal.scrollTop = terminal.scrollHeight;
}

function clearTerminal() {
  const terminal = document.getElementById('pipelineOutput');
  terminal.innerHTML = '<div class="terminal-line terminal-dim">Waiting for intent...</div>';
}

// ── Audit Ledger ──
function addAuditEntry(intentId, stage, data, verdict) {
  const entry = {
    intentId,
    stage,
    timestamp: new Date().toISOString(),
    data,
    hmac: generateHmac(),
    verified: true,
    verdict,
  };
  state.auditLedger.push(entry);
  renderLedger();
  return entry;
}

function renderLedger() {
  const tbody = document.getElementById('ledgerBody');
  const count = document.getElementById('ledgerCount');

  count.textContent = `${state.auditLedger.length} entries`;

  if (state.auditLedger.length === 0) {
    tbody.innerHTML = `
      <tr class="empty-row">
        <td colspan="5">
          <div class="empty-state">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" opacity="0.3"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            <p>No audit entries yet</p>
          </div>
        </td>
      </tr>`;
    return;
  }

  tbody.innerHTML = state.auditLedger.map(entry => `
    <tr class="ledger-row">
      <td>
        <span class="hmac-badge ${entry.verified ? 'verified' : 'failed'}">
          ${entry.verified ? '✓' : '✗'} ${entry.hmac}
        </span>
      </td>
      <td><span class="stage-badge ${entry.stage}">${entry.stage}</span></td>
      <td class="intent-id-cell">${entry.intentId}</td>
      <td style="font-size:0.75rem;color:var(--color-text-secondary)">${new Date(entry.timestamp).toLocaleTimeString()}</td>
      <td>${entry.verdict ? `<span class="status-pill ${entry.verdict.toLowerCase()}">${entry.verdict}</span>` : '—'}</td>
    </tr>
  `).join('');
}

// ── Activity Feed ──
function addActivity(title, detail, outcome) {
  const dotClass = outcome === 'executed' ? 'green' : outcome === 'blocked' ? 'red' : 'amber';

  state.activities.unshift({ title, detail, outcome, dotClass, time: timeAgo() });
  if (state.activities.length > 20) state.activities.pop();

  renderActivities();
}

function renderActivities() {
  const list = document.getElementById('activityList');
  if (state.activities.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" opacity="0.3"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
        <p>No pipeline runs yet</p>
        <span>Click "Run Pipeline" to start</span>
      </div>`;
    return;
  }

  list.innerHTML = state.activities.map(a => `
    <div class="activity-item">
      <div class="activity-dot ${a.dotClass}"></div>
      <div class="activity-body">
        <div class="activity-title">${a.title}</div>
        <div class="activity-detail">${a.detail}</div>
      </div>
      <span class="activity-time">${a.time}</span>
    </div>
  `).join('');
}

// ── Policy Evaluation (mirrors src/policy-agent.ts) ──
function evaluatePolicy(intent) {
  const reasons = [];

  // Amount check
  if (intent.amount > POLICY.maxAmountPerTx) {
    reasons.push(`Amount ${intent.amount} exceeds per-tx cap of ${POLICY.maxAmountPerTx}`);
  }

  // Protocol check
  if (!POLICY.allowedProtocols.includes(intent.protocol)) {
    reasons.push(`Protocol "${intent.protocol}" is not allowlisted [${POLICY.allowedProtocols.join(', ')}]`);
  }

  // Token check
  if (!POLICY.allowedTokens.includes(intent.token)) {
    reasons.push(`Token "${intent.token}" is not allowlisted [${POLICY.allowedTokens.join(', ')}]`);
  }

  // Action check
  if (!POLICY.allowedActions.includes(intent.action)) {
    reasons.push(`Action "${intent.action}" is not allowlisted`);
  }

  // Confidence check
  if (intent.confidence < POLICY.minConfidence) {
    reasons.push(`Confidence ${intent.confidence} below minimum ${POLICY.minConfidence}`);
  }

  // Velocity check
  if (state.dailyVelocity + intent.amount > POLICY.maxDailyVelocity) {
    reasons.push(`Daily velocity would reach ${(state.dailyVelocity + intent.amount).toFixed(3)}, exceeding cap of ${POLICY.maxDailyVelocity}`);
  }

  // Cooldown check
  const timeSinceLast = Date.now() - state.lastExecutionAt;
  if (state.lastExecutionAt > 0 && timeSinceLast < POLICY.cooldownMs) {
    reasons.push(`Cooldown: ${Math.ceil((POLICY.cooldownMs - timeSinceLast) / 1000)}s remaining`);
  }

  if (reasons.length > 0) {
    return { verdict: 'REJECTED', reasons };
  }

  // Escalation check
  if (intent.confidence < POLICY.autoApprovalThreshold) {
    return {
      verdict: 'ESCALATED',
      reasons: [`Confidence ${intent.confidence} is below auto-approval threshold (${POLICY.autoApprovalThreshold}) — requires human review`],
    };
  }

  return { verdict: 'APPROVED', reasons: ['All policy checks passed.'] };
}

// ── Update Policy Rule Cards ──
function updatePolicyVisual(intent, verdict) {
  // Amount
  const amountPct = Math.min((intent.amount / POLICY.maxAmountPerTx) * 100, 100);
  const amountMeter = document.getElementById('amountMeter');
  amountMeter.style.width = `${amountPct}%`;
  amountMeter.classList.toggle('over', intent.amount > POLICY.maxAmountPerTx);
  const amountOk = intent.amount <= POLICY.maxAmountPerTx;
  document.getElementById('amountStatus').textContent = amountOk ? '✓ Within cap' : `✗ ${intent.amount} > ${POLICY.maxAmountPerTx}`;
  document.getElementById('amountStatus').className = `rule-status ${amountOk ? 'pass' : 'fail'}`;
  document.getElementById('rule-amount').classList.toggle('pass', amountOk);
  document.getElementById('rule-amount').classList.toggle('fail', !amountOk);

  // Velocity
  const velPct = Math.min(((state.dailyVelocity + intent.amount) / POLICY.maxDailyVelocity) * 100, 100);
  const velMeter = document.getElementById('velocityMeter');
  velMeter.style.width = `${velPct}%`;
  const velOk = (state.dailyVelocity + intent.amount) <= POLICY.maxDailyVelocity;
  velMeter.classList.toggle('over', !velOk);
  document.getElementById('velocityStatus').textContent = velOk
    ? `✓ ${(state.dailyVelocity + intent.amount).toFixed(3)} / ${POLICY.maxDailyVelocity}`
    : `✗ Would exceed ${POLICY.maxDailyVelocity}`;
  document.getElementById('velocityStatus').className = `rule-status ${velOk ? 'pass' : 'fail'}`;
  document.getElementById('rule-velocity').classList.toggle('pass', velOk);
  document.getElementById('rule-velocity').classList.toggle('fail', !velOk);

  // Protocol
  const protOk = POLICY.allowedProtocols.includes(intent.protocol);
  document.getElementById('protocolStatus').textContent = protOk ? `✓ ${intent.protocol}` : `✗ ${intent.protocol} not allowed`;
  document.getElementById('protocolStatus').className = `rule-status ${protOk ? 'pass' : 'fail'}`;
  document.getElementById('rule-protocol').classList.toggle('pass', protOk);
  document.getElementById('rule-protocol').classList.toggle('fail', !protOk);

  // Token
  const tokOk = POLICY.allowedTokens.includes(intent.token);
  document.getElementById('tokenStatus').textContent = tokOk ? `✓ ${intent.token}` : `✗ ${intent.token} not allowed`;
  document.getElementById('tokenStatus').className = `rule-status ${tokOk ? 'pass' : 'fail'}`;
  document.getElementById('rule-token').classList.toggle('pass', tokOk);
  document.getElementById('rule-token').classList.toggle('fail', !tokOk);

  // Confidence
  const confPct = Math.min(intent.confidence * 100, 100);
  const confMeter = document.getElementById('confidenceMeter');
  confMeter.style.width = `${confPct}%`;
  const confOk = intent.confidence >= POLICY.minConfidence;
  confMeter.classList.toggle('over', !confOk);
  document.getElementById('confidenceStatus').textContent = confOk
    ? (intent.confidence >= POLICY.autoApprovalThreshold ? `✓ Auto-approved (${intent.confidence})` : `⚠ Escalated (${intent.confidence})`)
    : `✗ ${intent.confidence} < ${POLICY.minConfidence}`;
  document.getElementById('confidenceStatus').className = `rule-status ${confOk ? 'pass' : 'fail'}`;
  document.getElementById('rule-confidence').classList.toggle('pass', confOk);
  document.getElementById('rule-confidence').classList.toggle('fail', !confOk);

  // Cooldown
  const timeSinceLast = Date.now() - state.lastExecutionAt;
  const cooldownOk = state.lastExecutionAt === 0 || timeSinceLast >= POLICY.cooldownMs;
  const cooldownPct = state.lastExecutionAt === 0 ? 0 : Math.min(((POLICY.cooldownMs - Math.max(0, POLICY.cooldownMs - timeSinceLast)) / POLICY.cooldownMs) * 100, 100);
  document.getElementById('cooldownMeter').style.width = `${cooldownPct}%`;
  document.getElementById('cooldownStatus').textContent = cooldownOk ? '✓ Ready' : `✗ ${Math.ceil((POLICY.cooldownMs - timeSinceLast) / 1000)}s remaining`;
  document.getElementById('cooldownStatus').className = `rule-status ${cooldownOk ? 'pass' : 'fail'}`;
  document.getElementById('rule-cooldown').classList.toggle('pass', cooldownOk);
  document.getElementById('rule-cooldown').classList.toggle('fail', !cooldownOk);
}

// ── Run Pipeline ──
async function runPipeline(intent) {
  if (state.isRunning) return;
  state.isRunning = true;

  const runBtn = document.getElementById('runPipelineBtn');
  runBtn.disabled = true;

  resetPipeline();
  clearTerminal();

  appendTerminal('╔══════════════════════════════════════════════════════════╗', 'terminal-indigo');
  appendTerminal('║            🏛️  CUSTODIAN — Agent Treasury Swarm         ║', 'terminal-indigo');
  appendTerminal('╚══════════════════════════════════════════════════════════╝', 'terminal-indigo');
  appendTerminal('');

  // ── Stage 1: Signal Agent ──
  await activateStage('signal', 'active');
  appendTerminal('📡 [Signal Agent] [MOCK] Scanning on-chain state...', 'terminal-blue');
  await sleep(500);
  appendTerminal('   ✓ No anomalies detected', 'terminal-green');
  await finishStage('signal', 'passed');

  // ── Stage 2: Strategist Agent ──
  await activateStage('strategist', 'active');
  appendTerminal('');
  appendTerminal('📋 [Strategist Agent] [MOCK] Intent Proposed:', 'terminal-blue');
  appendTerminal(`   ID:         ${intent.id}`);
  appendTerminal(`   Action:     ${intent.action}`);
  appendTerminal(`   Amount:     ${intent.amount} ${intent.token}`);
  appendTerminal(`   Protocol:   ${intent.protocol}`);
  appendTerminal(`   Recipient:  ${intent.recipient}`);
  appendTerminal(`   Confidence: ${intent.confidence}`);
  appendTerminal(`   Rationale:  ${intent.rationale}`);
  await sleep(400);
  await finishStage('strategist', 'passed');

  // Add audit entry: proposal
  addAuditEntry(intent.id, 'proposal', intent, 'PENDING');

  // ── Stage 3: Policy Gate ──
  await activateStage('policy', 'active');
  appendTerminal('');
  appendTerminal('🛡️  [Policy Agent] [MOCK] Evaluating intent against rules...', 'terminal-blue');
  await sleep(600);

  const verdict = evaluatePolicy(intent);
  updatePolicyVisual(intent, verdict);

  // Add audit entry: policy
  addAuditEntry(intent.id, 'policy', verdict, verdict.verdict);

  if (verdict.verdict === 'REJECTED') {
    appendTerminal(`   ❌ REJECTED:`, 'terminal-red');
    for (const reason of verdict.reasons) {
      appendTerminal(`      → ${reason}`, 'terminal-red');
    }
    await finishStage('policy', 'failed');

    state.blocked++;
    updateStats();
    addActivity(`Blocked: ${intent.action} ${intent.amount} ${intent.token}`, intent.id, 'blocked');
    showToast(`Intent blocked: ${verdict.reasons[0]}`, 'error');

    document.getElementById('pipelineStatus').textContent = 'Blocked';
    document.getElementById('pipelineStatus').className = 'meta-text';

    state.isRunning = false;
    runBtn.disabled = false;
    return { outcome: 'blocked', verdict };
  }

  if (verdict.verdict === 'ESCALATED') {
    appendTerminal(`   ⚠️  ESCALATED to human review:`, 'terminal-amber');
    for (const reason of verdict.reasons) {
      appendTerminal(`      → ${reason}`, 'terminal-amber');
    }
    await finishStage('policy', 'escalated');

    state.escalated++;
    updateStats();
    addActivity(`Escalated: ${intent.action} ${intent.amount} ${intent.token}`, intent.id, 'escalated');
    showToast(`Intent escalated for human review`, 'warning');

    document.getElementById('pipelineStatus').textContent = 'Escalated';
    document.getElementById('pipelineStatus').className = 'meta-text';

    state.isRunning = false;
    runBtn.disabled = false;
    return { outcome: 'escalated', verdict };
  }

  appendTerminal(`   ✅ APPROVED: ${verdict.reasons[0]}`, 'terminal-green');
  await finishStage('policy', 'passed');

  // ── Stage 4: Execution Agent ──
  await activateStage('execution', 'active');
  appendTerminal('');
  appendTerminal('🔍 [Execution Agent] [MOCK] Simulating transaction...', 'terminal-blue');
  await sleep(500);
  appendTerminal('   ✅ Simulation passed (success: true, wouldRevert: false)', 'terminal-green');
  addAuditEntry(intent.id, 'simulation', { success: true, wouldRevert: false }, 'APPROVED');

  await sleep(300);
  appendTerminal('');
  appendTerminal('⚡ [Execution Agent] [MOCK] Broadcasting transaction...', 'terminal-blue');
  await sleep(700);

  const mockTxHash = `0x${Array.from({length: 64}, () => '0123456789abcdef'[Math.floor(Math.random() * 16)]).join('')}`;
  const explorerLink = `https://sepolia.etherscan.io/tx/${mockTxHash}`;

  appendTerminal(`   ✅ Transaction completed!`, 'terminal-green');
  appendTerminal(`   📦 Execution ID: mock-exec-${Date.now()}`);
  appendTerminal(`   🔗 Tx Hash:      ${mockTxHash}`);
  appendTerminal(`   🌐 Explorer:     ${explorerLink}`);
  appendTerminal(`   ⛽ Gas Used:     21000 wei`);

  await finishStage('execution', 'passed');
  addAuditEntry(intent.id, 'execution', { transactionHash: mockTxHash, status: 'completed' }, 'APPROVED');

  // ── Stage 5: Audit ──
  await activateStage('audit', 'active');
  appendTerminal('');
  appendTerminal(`📒 [Audit Agent] Ledger Summary (${state.auditLedger.length} entries):`, 'terminal-blue');

  const entries = state.auditLedger.filter(e => e.intentId === intent.id);
  for (const e of entries) {
    appendTerminal(`  [✓] ${e.stage.toUpperCase().padEnd(12)} | ${e.intentId} | ${e.timestamp}`, 'terminal-dim');
  }

  await sleep(300);
  await finishStage('audit', 'passed');

  // Update state
  state.dailyVelocity += intent.amount;
  state.lastExecutionAt = Date.now();
  state.executed++;
  updateStats();
  addActivity(`Executed: ${intent.action} ${intent.amount} ${intent.token}`, mockTxHash, 'executed');
  showToast(`Transaction executed successfully!`, 'success');

  appendTerminal('');
  appendTerminal('═'.repeat(60), 'terminal-indigo');
  appendTerminal('📊 PIPELINE RESULT', 'terminal-bold');
  appendTerminal('═'.repeat(60), 'terminal-indigo');
  appendTerminal(`  Outcome:     EXECUTED`, 'terminal-green');
  appendTerminal(`  Intent ID:   ${intent.id}`);
  appendTerminal(`  Tx Hash:     ${mockTxHash}`);

  document.getElementById('pipelineStatus').textContent = 'Completed';
  document.getElementById('pipelineStatus').className = 'meta-text';

  state.isRunning = false;
  runBtn.disabled = false;
  return { outcome: 'executed', verdict };
}

// ── Intent Form Submission ──
document.getElementById('intentForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (state.isRunning) return;

  const intent = {
    id: generateIntentId(),
    action: document.getElementById('intentAction').value,
    amount: parseFloat(document.getElementById('intentAmount').value),
    token: document.getElementById('intentToken').value,
    protocol: document.getElementById('intentProtocol').value,
    recipient: document.getElementById('intentRecipient').value,
    confidence: parseFloat(document.getElementById('intentConfidence').value),
    rationale: document.getElementById('intentRationale').value,
    createdAt: new Date().toISOString(),
  };

  await runPipeline(intent);
});

// ── Run Pipeline Button (header) ──
document.getElementById('runPipelineBtn').addEventListener('click', async () => {
  if (state.isRunning) return;

  const intent = {
    id: generateIntentId(),
    action: 'transfer',
    amount: 0.001,
    token: 'ETH',
    protocol: 'Ethereum',
    recipient: '0x0000000000000000000000000000000000000001',
    confidence: 0.95,
    rationale: 'Quick pipeline test via dashboard',
    createdAt: new Date().toISOString(),
  };

  await runPipeline(intent);
});

// ── Adversarial Tests ──
const adversarialIntents = {
  'oversized': {
    action: 'transfer', amount: 5.0, token: 'ETH', protocol: 'Ethereum',
    recipient: '0x0000000000000000000000000000000000000002',
    confidence: 0.95, rationale: 'Adversarial test: oversized transfer (5 ETH vs 0.01 cap)',
  },
  'bad-protocol': {
    action: 'transfer', amount: 0.001, token: 'ETH', protocol: 'UnknownDEX',
    recipient: '0x0000000000000000000000000000000000000002',
    confidence: 0.95, rationale: 'Adversarial test: disallowed protocol',
  },
  'bad-token': {
    action: 'transfer', amount: 0.001, token: 'SHIB', protocol: 'Ethereum',
    recipient: '0x0000000000000000000000000000000000000002',
    confidence: 0.95, rationale: 'Adversarial test: disallowed token (SHIB)',
  },
  'low-confidence': {
    action: 'transfer', amount: 0.001, token: 'ETH', protocol: 'Ethereum',
    recipient: '0x0000000000000000000000000000000000000002',
    confidence: 0.5, rationale: 'Adversarial test: low confidence intent',
  },
};

document.querySelectorAll('.test-btn').forEach(btn => {
  btn.addEventListener('click', async () => {
    if (state.isRunning) return;

    const testId = btn.dataset.test;
    const template = adversarialIntents[testId];
    if (!template) return;

    const intent = {
      ...template,
      id: generateIntentId(),
      createdAt: new Date().toISOString(),
    };

    btn.disabled = true;
    const result = await runPipeline(intent);

    if (result.outcome === 'blocked') {
      btn.classList.add('blocked');
    }

    btn.disabled = false;
  });
});

// ── Clear Buttons ──
document.getElementById('clearActivity').addEventListener('click', () => {
  state.activities = [];
  renderActivities();
});

document.getElementById('clearOutput').addEventListener('click', () => {
  clearTerminal();
});

// ── Export Ledger ──
document.getElementById('exportLedger').addEventListener('click', () => {
  if (state.auditLedger.length === 0) {
    showToast('No entries to export', 'warning');
    return;
  }
  const json = JSON.stringify(state.auditLedger, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'audit-ledger.json';
  a.click();
  URL.revokeObjectURL(url);
  showToast('Ledger exported!', 'success');
});

// ── Initialize ──
updateStats();
renderActivities();
renderLedger();
