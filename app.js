// Cortex Demo - Real-time Agent Visualization
// Connects to live SSE stream from backend

// Configuration
const API_URL = window.location.hostname === 'localhost' 
  ? 'http://localhost:4021' 
  : 'https://api.crtx.tech'; // Update when deployed

// State
let eventSource = null;
let metrics = {
  totalActions: 0,
  successfulActions: 0,
  reflectionScores: [],
  strategiesLearned: 0,
  milestones: [],
  qTableSize: 0,
  epsilon: 0.3,
  lessonsLearned: 0,
  skillsExtracted: 0,
};

// DOM Elements
const activityLog = document.getElementById('activity-log');
const startBtn = document.getElementById('start-demo');
const resetBtn = document.getElementById('reset-demo');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  startBtn?.addEventListener('click', toggleDemo);
  resetBtn?.addEventListener('click', resetDemo);
});

function toggleDemo() {
  if (eventSource) {
    stopDemo();
  } else {
    startDemo();
  }
}

async function startDemo() {
  // Check for API key
  let apiKey = localStorage.getItem('anthropic_api_key');
  
  if (!apiKey) {
    apiKey = prompt('Enter your Anthropic API key to run the live demo:');
    if (!apiKey) {
      log('❌ API key required for live demo', 'error');
      return;
    }
    localStorage.setItem('anthropic_api_key', apiKey);
  }

  startBtn.textContent = '⏸️ Stop';
  startBtn.classList.add('running');
  log('🚀 Connecting to Cortex agent...', 'system');

  try {
    // Connect to SSE stream
    const url = `${API_URL}/agent/stream?apiKey=${encodeURIComponent(apiKey)}&iterations=15`;
    eventSource = new EventSource(url);

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      handleEvent(data);
    };

    eventSource.onerror = (error) => {
      console.error('SSE Error:', error);
      log('❌ Connection error. Check API key and try again.', 'error');
      stopDemo();
    };

  } catch (error) {
    log(`❌ Failed to connect: ${error.message}`, 'error');
    stopDemo();
  }
}

function stopDemo() {
  if (eventSource) {
    eventSource.close();
    eventSource = null;
  }
  startBtn.textContent = '▶️ Start Demo';
  startBtn.classList.remove('running');
  log('Agent stopped', 'system');
}

function resetDemo() {
  stopDemo();
  metrics = {
    totalActions: 0,
    successfulActions: 0,
    reflectionScores: [],
    strategiesLearned: 0,
    milestones: [],
    qTableSize: 0,
    epsilon: 0.3,
    lessonsLearned: 0,
    skillsExtracted: 0,
  };
  activityLog.innerHTML = '<div class="log-entry log-system">Click "Start Demo" to run live Cortex agent...</div>';
  updateMetricsDisplay();
  updateChart();
  document.getElementById('milestones-section').style.display = 'none';
}

function handleEvent(event) {
  switch (event.type) {
    case 'start':
      log(`🧠 ${event.data.message}`, 'system');
      if (event.data.model) {
        log(`   Using ${event.data.model}`, 'info');
      }
      break;

    case 'perceive':
      log(`👁️ ${event.data.message}`, 'perceive');
      break;

    case 'reason':
      log(`🤔 ${event.data.message}`, 'reason');
      break;

    case 'act':
      if (event.data.level === 'success') {
        log(`✓ ${event.data.message}`, 'success');
        metrics.successfulActions++;
      } else if (event.data.level === 'error') {
        log(`✗ ${event.data.message}`, 'error');
      } else {
        log(`⚡ ${event.data.message}`, 'info');
      }
      metrics.totalActions++;
      break;

    case 'reflect':
      const score = parseFloat(event.data.message.match(/(\d+)%/)?.[1] || '50') / 100;
      metrics.reflectionScores.push(score);
      const scoreClass = score >= 0.7 ? 'success' : score >= 0.5 ? 'warning' : 'error';
      log(`📊 ${event.data.message}`, scoreClass);
      break;

    case 'learn':
      log(`📚 ${event.data.message}`, 'learn');
      if (event.data.message.includes('Skill')) {
        metrics.skillsExtracted++;
      }
      if (event.data.message.includes('lesson') || event.data.message.includes('Learned')) {
        metrics.lessonsLearned++;
      }
      break;

    case 'milestone':
      log(`🎯 MILESTONE: ${event.data.description}`, 'milestone');
      if (event.data.txSignature) {
        log(`   ⛓️ On-chain: ${event.data.txSignature.slice(0, 24)}...`, 'chain');
      }
      metrics.milestones.push(event.data);
      updateMilestonesDisplay();
      break;

    case 'metrics':
      // Final metrics from agent
      const m = event.data.metrics;
      metrics.qTableSize = m.qTableSize || 0;
      metrics.epsilon = m.epsilon || 0.3;
      metrics.lessonsLearned = m.totalLessons || 0;
      metrics.skillsExtracted = m.totalSkills || 0;
      log(`📈 Final: ${m.successfulActions}/${m.totalActions} actions succeeded`, 'info');
      break;

    case 'complete':
      log(`✅ ${event.data.message}`, 'system');
      log(`   Final success rate: ${event.data.finalSuccessRate}%`, 'success');
      stopDemo();
      break;

    case 'error':
      log(`❌ Error: ${event.data.message}`, 'error');
      break;
  }

  updateMetricsDisplay();
  updateChart();
}

function updateMetricsDisplay() {
  const setElement = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  };

  setElement('total-actions', metrics.totalActions);
  
  const successRate = metrics.totalActions > 0 
    ? (metrics.successfulActions / metrics.totalActions * 100).toFixed(1) 
    : '0';
  setElement('success-rate', successRate + '%');
  
  const avgReflection = metrics.reflectionScores.length > 0
    ? (metrics.reflectionScores.reduce((a, b) => a + b, 0) / metrics.reflectionScores.length * 100).toFixed(1)
    : '0';
  setElement('reflection-avg', avgReflection + '%');
  
  setElement('strategies-learned', metrics.skillsExtracted);
  setElement('milestones', metrics.milestones.length);
}

function updateChart() {
  const chart = document.getElementById('chart');
  if (!chart) return;
  
  const scores = metrics.reflectionScores.slice(-20);
  
  if (scores.length === 0) {
    chart.innerHTML = '<div class="chart-placeholder">Waiting for data...</div>';
    return;
  }
  
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
  if (!section || !list) return;
  
  if (metrics.milestones.length > 0) {
    section.style.display = 'block';
    list.innerHTML = metrics.milestones.map(m => `
      <div class="milestone-card">
        <div class="milestone-type">${(m.type || 'milestone').replace(/_/g, ' ')}</div>
        <div class="milestone-desc">${m.description}</div>
        ${m.metrics ? `
          <div class="milestone-metrics">
            <span>Before: ${(m.metrics.before * 100).toFixed(1)}%</span>
            <span>After: ${(m.metrics.after * 100).toFixed(1)}%</span>
          </div>
        ` : ''}
        ${m.txSignature ? `
          <div class="milestone-tx">
            <a href="https://solscan.io/tx/${m.txSignature}?cluster=devnet" target="_blank">
              ⛓️ ${m.txSignature.slice(0, 24)}...
            </a>
          </div>
        ` : ''}
      </div>
    `).join('');
  }
}

function log(message, type = 'info') {
  if (!activityLog) return;
  
  const entry = document.createElement('div');
  entry.className = `log-entry log-${type}`;
  entry.textContent = message;
  activityLog.appendChild(entry);
  activityLog.scrollTop = activityLog.scrollHeight;
  
  // Keep only last 100 entries
  while (activityLog.children.length > 100) {
    activityLog.removeChild(activityLog.firstChild);
  }
}
