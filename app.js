// ARIA Demo - Self-Learning Agent Visualization

// State
let running = false;
let iteration = 0;
let metrics = {
  totalActions: 0,
  successfulActions: 0,
  reflectionScores: [],
  strategiesLearned: 0,
  milestones: [],
};

const strategies = [
  { name: 'Web Research', successRate: 0.6 },
  { name: 'Market Monitor', successRate: 0.7 },
  { name: 'Wallet Analyzer', successRate: 0.65 },
];

const tools = ['search', 'fetch', 'prices', 'news', 'wallet'];

// DOM Elements
const activityLog = document.getElementById('activity-log');
const startBtn = document.getElementById('start-demo');
const resetBtn = document.getElementById('reset-demo');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  startBtn.addEventListener('click', toggleDemo);
  resetBtn.addEventListener('click', resetDemo);
});

function toggleDemo() {
  if (running) {
    running = false;
    startBtn.textContent = '▶️ Start Demo';
    log('Agent stopped', 'system');
  } else {
    running = true;
    startBtn.textContent = '⏸️ Pause';
    log('Starting ARIA agent...', 'system');
    log('Goals: Research crypto trends, Monitor prices', 'info');
    runLoop();
  }
}

function resetDemo() {
  running = false;
  iteration = 0;
  metrics = {
    totalActions: 0,
    successfulActions: 0,
    reflectionScores: [],
    strategiesLearned: 0,
    milestones: [],
  };
  strategies.forEach(s => s.successRate = 0.5 + Math.random() * 0.3);
  
  activityLog.innerHTML = '<div class="log-entry log-system">Click "Start Demo" to begin...</div>';
  startBtn.textContent = '▶️ Start Demo';
  updateMetricsDisplay();
  updateChart();
  document.getElementById('milestones-section').style.display = 'none';
}

async function runLoop() {
  while (running && iteration < 50) {
    iteration++;
    
    // 1. PERCEIVE
    log(`[Iteration ${iteration}] Perceiving environment...`, 'perceive');
    await sleep(300);
    
    // 2. REASON - Select strategy
    const strategy = selectStrategy();
    log(`Selected strategy: ${strategy.name} (${(strategy.successRate * 100).toFixed(0)}% success)`, 'reason');
    await sleep(300);
    
    // 3. ACT - Execute actions
    const actions = generateActions(strategy);
    const results = [];
    
    for (const action of actions) {
      const success = Math.random() < (strategy.successRate + (Math.random() * 0.2 - 0.1));
      results.push(success);
      metrics.totalActions++;
      if (success) metrics.successfulActions++;
      
      log(`Tool: ${action.tool} → ${success ? '✓ Success' : '✗ Failed'}`, success ? 'success' : 'error');
      await sleep(200);
    }
    
    // 4. REFLECT
    const score = results.filter(r => r).length / results.length;
    metrics.reflectionScores.push(score);
    
    const scoreClass = score >= 0.7 ? 'success' : score >= 0.5 ? 'warning' : 'error';
    log(`Reflection score: ${(score * 100).toFixed(0)}%`, scoreClass);
    
    // 5. LEARN - Update strategy
    if (score < 0.5) {
      log('Score below threshold, updating strategy...', 'learn');
      strategy.successRate = strategy.successRate * 0.7 + score * 0.3;
      
      // Maybe create new strategy
      if (score < 0.3 && Math.random() < 0.3) {
        const newStrategy = {
          name: `${strategy.name} v${strategies.length}`,
          successRate: 0.55,
        };
        strategies.push(newStrategy);
        metrics.strategiesLearned++;
        log(`Created new strategy: ${newStrategy.name}`, 'learn');
      }
    } else {
      // Reinforce successful strategy
      strategy.successRate = Math.min(0.95, strategy.successRate * 0.9 + score * 0.1);
    }
    
    // 6. CHECK MILESTONES
    if (metrics.reflectionScores.length >= 10) {
      const recent = metrics.reflectionScores.slice(-10);
      const recentAvg = recent.reduce((a, b) => a + b, 0) / 10;
      
      const older = metrics.reflectionScores.slice(-20, -10);
      if (older.length >= 5) {
        const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
        const improvement = recentAvg - olderAvg;
        
        if (improvement >= 0.15) {
          recordMilestone({
            type: 'success_rate_improved',
            description: `Success rate improved by ${(improvement * 100).toFixed(1)}%`,
            before: olderAvg,
            after: recentAvg,
          });
        }
      }
    }
    
    updateMetricsDisplay();
    updateChart();
    
    await sleep(500);
  }
  
  if (iteration >= 50) {
    running = false;
    startBtn.textContent = '▶️ Start Demo';
    log('Demo complete! Agent ran 50 iterations.', 'system');
  }
}

function selectStrategy() {
  // Exploration vs exploitation
  if (Math.random() < 0.2) {
    return strategies[Math.floor(Math.random() * strategies.length)];
  }
  return strategies.reduce((best, s) => s.successRate > best.successRate ? s : best);
}

function generateActions(strategy) {
  const numActions = 2 + Math.floor(Math.random() * 2);
  const actions = [];
  for (let i = 0; i < numActions; i++) {
    actions.push({
      tool: tools[Math.floor(Math.random() * tools.length)],
      purpose: 'Execute step ' + (i + 1),
    });
  }
  return actions;
}

function recordMilestone(milestone) {
  milestone.timestamp = Date.now();
  milestone.txSignature = `demo_${Math.random().toString(36).slice(2, 10)}_${Date.now()}`;
  metrics.milestones.push(milestone);
  
  log(`🎯 MILESTONE: ${milestone.description}`, 'milestone');
  log(`   On-chain: ${milestone.txSignature.slice(0, 20)}...`, 'chain');
  
  updateMilestonesDisplay();
}

function updateMetricsDisplay() {
  document.getElementById('total-actions').textContent = metrics.totalActions;
  
  const successRate = metrics.totalActions > 0 
    ? (metrics.successfulActions / metrics.totalActions * 100).toFixed(1) 
    : 0;
  document.getElementById('success-rate').textContent = successRate + '%';
  
  const avgReflection = metrics.reflectionScores.length > 0
    ? (metrics.reflectionScores.reduce((a, b) => a + b, 0) / metrics.reflectionScores.length * 100).toFixed(1)
    : 0;
  document.getElementById('reflection-avg').textContent = avgReflection + '%';
  
  document.getElementById('strategies-learned').textContent = metrics.strategiesLearned;
  document.getElementById('milestones').textContent = metrics.milestones.length;
}

function updateChart() {
  const chart = document.getElementById('chart');
  const scores = metrics.reflectionScores.slice(-20);
  
  if (scores.length === 0) {
    chart.innerHTML = '<div class="chart-line"></div>';
    return;
  }
  
  // Create SVG chart
  const width = chart.offsetWidth || 300;
  const height = 80;
  const points = scores.map((s, i) => ({
    x: (i / Math.max(scores.length - 1, 1)) * width,
    y: height - (s * height),
  }));
  
  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  
  chart.innerHTML = `
    <svg width="${width}" height="${height}" class="chart-svg">
      <defs>
        <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" style="stop-color:#0891b2;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#22d3ee;stop-opacity:1" />
        </linearGradient>
      </defs>
      <path d="${pathD}" fill="none" stroke="url(#lineGradient)" stroke-width="2"/>
      ${points.map(p => `<circle cx="${p.x}" cy="${p.y}" r="3" fill="#22d3ee"/>`).join('')}
    </svg>
  `;
}

function updateMilestonesDisplay() {
  const section = document.getElementById('milestones-section');
  const list = document.getElementById('milestones-list');
  
  if (metrics.milestones.length > 0) {
    section.style.display = 'block';
    list.innerHTML = metrics.milestones.map(m => `
      <div class="milestone-card">
        <div class="milestone-type">${m.type.replace(/_/g, ' ')}</div>
        <div class="milestone-desc">${m.description}</div>
        <div class="milestone-metrics">
          <span>Before: ${(m.before * 100).toFixed(1)}%</span>
          <span>After: ${(m.after * 100).toFixed(1)}%</span>
        </div>
        <div class="milestone-tx">
          <a href="#" onclick="return false;">⛓️ ${m.txSignature.slice(0, 24)}...</a>
        </div>
      </div>
    `).join('');
  }
}

function log(message, type = 'info') {
  const entry = document.createElement('div');
  entry.className = `log-entry log-${type}`;
  entry.textContent = message;
  activityLog.appendChild(entry);
  activityLog.scrollTop = activityLog.scrollHeight;
  
  // Keep only last 50 entries
  while (activityLog.children.length > 50) {
    activityLog.removeChild(activityLog.firstChild);
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
