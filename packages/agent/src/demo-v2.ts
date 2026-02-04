/**
 * ARIA v2 Demo - Full ML Learning Stack
 * 
 * Watch the agent learn using:
 * - Experience Replay + TD Learning
 * - Reflexion (self-critique)
 * - Skill Synthesis
 * - Textual Gradients
 * - Contrastive Learning
 */

import { ARIAv2 } from './aria-v2.js';
import { createMilestoneRecorder } from './solana.js';

console.log(`
╔══════════════════════════════════════════════════════════════╗
║     🧠 ARIA v2 - ML-Powered Self-Learning Agent              ║
║                                                              ║
║   Learning Stack:                                            ║
║   • Experience Replay + TD Learning (Q-values)               ║
║   • Reflexion (LLM self-critique)                            ║
║   • Skill Synthesis (extract reusable skills)                ║
║   • Textual Gradients (LLM-computed updates)                 ║
║   • Contrastive Learning (success vs failure)                ║
║   • Solana Milestones (on-chain proof)                       ║
╚══════════════════════════════════════════════════════════════╝
`);

// Simple mock LLM for demo (replace with real API)
async function mockLLM(prompt: string): Promise<string> {
  // Simulate LLM delay
  await sleep(100);
  
  // Generate reasonable mock responses based on prompt content
  if (prompt.includes('reflection') || prompt.includes('Analyze this trajectory')) {
    return JSON.stringify({
      diagnosis: 'Some actions failed due to rate limiting or network issues',
      lessons: [
        'Add retry logic for transient failures',
        'Check API availability before calling',
      ],
      corrections: ['Implement exponential backoff', 'Add fallback tools'],
      confidence: 0.75,
    });
  }
  
  if (prompt.includes('textual gradient') || prompt.includes('optimizing')) {
    return JSON.stringify({
      reasoning: 'Success rate is below target, need to adjust approach',
      magnitude: 0.6,
      modifications: {
        addHeuristics: ['Verify tool availability before use'],
        removeHeuristics: [],
        modifySteps: [],
        promptAdjustments: ['Focus on reliable data sources'],
      },
    });
  }
  
  if (prompt.includes('reusable skill') || prompt.includes('Extract')) {
    return JSON.stringify({
      name: 'Market Research',
      description: 'Research crypto market trends',
      preconditions: {
        goalPatterns: ['research.*market', 'crypto.*trend'],
        requiredTools: ['search', 'news'],
        contextIndicators: ['market', 'crypto', 'price'],
      },
      steps: [
        { action: 'Search for topic', tool: 'search', paramTemplate: { query: '{{topic}}' }, expectedOutcome: 'Get results' },
        { action: 'Get news', tool: 'news', paramTemplate: { topic: '{{topic}}' }, expectedOutcome: 'Get headlines' },
      ],
      postconditions: {
        successIndicators: ['Found relevant data'],
        expectedOutputFormat: 'Summary of findings',
      },
    });
  }
  
  if (prompt.includes('Compare these two')) {
    return JSON.stringify({
      differences: {
        toolUsage: ['Winner used search first, loser skipped it'],
        parameterChoices: ['Winner used more specific queries'],
        sequencing: ['Winner gathered context before acting'],
        contextFactors: ['Winner checked prices first'],
      },
      insight: 'Always gather context with search before taking action',
      applicability: ['research', 'market', 'analysis'],
      confidence: 0.8,
    });
  }
  
  return JSON.stringify({ result: 'ok' });
}

// Create ARIA v2 with full learning stack
const aria = new ARIAv2({
  name: 'ARIA-v2-Demo',
  goals: [
    {
      id: 'research-crypto',
      description: 'Research cryptocurrency market trends and Solana ecosystem',
      priority: 8,
      status: 'active',
    },
  ],
  llmCall: mockLLM,
  learning: {
    experienceBufferSize: 1000,
    alpha: 0.15,         // TD learning rate
    gamma: 0.95,         // Discount factor
    epsilon: 0.3,        // Start with 30% exploration
    reflexionThreshold: 0.5,
    gradientThreshold: 0.4,
    skillConfidence: 0.7,
  },
  tools: ['search', 'fetch', 'prices', 'news'],
});

// Register mock tools
aria.registerTool('search', async (params) => {
  await sleep(200);
  if (Math.random() > 0.25) {
    return { results: [{ title: 'Solana Trends 2026', url: 'https://...' }] };
  }
  throw new Error('Search API rate limited');
});

aria.registerTool('fetch', async (params) => {
  await sleep(150);
  if (Math.random() > 0.2) {
    return { text: 'Article content about crypto markets...' };
  }
  throw new Error('Fetch timeout');
});

aria.registerTool('prices', async (params) => {
  await sleep(100);
  return {
    prices: [
      { coin: 'solana', price: 142.50 + Math.random() * 10, change24h: (Math.random() - 0.5) * 10 },
      { coin: 'bitcoin', price: 97500 + Math.random() * 1000, change24h: (Math.random() - 0.5) * 5 },
    ],
  };
});

aria.registerTool('news', async (params) => {
  await sleep(180);
  if (Math.random() > 0.3) {
    return { articles: [{ title: 'Solana hits new ATH', pubDate: '1h ago' }] };
  }
  throw new Error('News feed unavailable');
});

// Set up Solana milestone recording
const recorder = createMilestoneRecorder('https://api.devnet.solana.com');
aria.setMilestoneHandler(async (milestone) => {
  const txSig = await recorder.record(milestone);
  console.log(`   ⛓️  On-chain: ${txSig}`);
});

// Custom log handler for nice output
aria.setLogHandler((message, level) => {
  const colors: Record<string, string> = {
    system: '\x1b[36m',    // Cyan
    info: '\x1b[37m',      // White
    perceive: '\x1b[35m',  // Magenta
    reason: '\x1b[34m',    // Blue
    success: '\x1b[32m',   // Green
    warning: '\x1b[33m',   // Yellow
    error: '\x1b[31m',     // Red
    learn: '\x1b[96m',     // Bright Cyan
    milestone: '\x1b[93m', // Bright Yellow
  };
  const reset = '\x1b[0m';
  const color = colors[level] || '\x1b[37m';
  console.log(`${color}${message}${reset}`);
});

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Run the demo
console.log('\n🚀 Starting ARIA v2 demo (20 iterations)...\n');

aria.run(20).then(() => {
  const metrics = aria.getMetrics();
  
  console.log('\n' + '═'.repeat(60));
  console.log('📊 FINAL METRICS');
  console.log('═'.repeat(60));
  console.log(`
   Iterations:        ${metrics.iteration}
   Total Actions:     ${metrics.totalActions}
   Successful:        ${metrics.successfulActions}
   Success Rate:      ${((metrics.successfulActions / metrics.totalActions) * 100).toFixed(1)}%
   
   📚 LEARNING:
   Experience Buffer: ${metrics.experienceBuffer}
   Q-Table States:    ${metrics.qTableSize}
   Exploration (ε):   ${(metrics.epsilon * 100).toFixed(1)}%
   
   Reflexions:        ${metrics.reflectionsTriggered}
   Lessons Learned:   ${metrics.totalLessons}
   Gradients Applied: ${metrics.gradientsApplied}
   
   Skills Extracted:  ${metrics.totalSkills}
   Insights Found:    ${metrics.totalInsights}
   Win Rate:          ${(metrics.winRate * 100).toFixed(1)}%
   
   ⛓️  MILESTONES:     ${metrics.milestonesRecorded}
  `);
  
  const strategies = aria.getStrategies();
  console.log('🧠 EVOLVED STRATEGIES:');
  strategies.forEach(s => {
    console.log(`   - ${s.name}: ${(s.successRate * 100).toFixed(0)}% (${s.usageCount} uses)`);
    if (s.heuristics.length > 0) {
      console.log(`     Heuristics: ${s.heuristics.slice(0, 2).join('; ')}`);
    }
  });
  
  const skills = aria.getSkills();
  if (skills.length > 0) {
    console.log('\n🔧 SYNTHESIZED SKILLS:');
    skills.forEach(s => {
      console.log(`   - ${s.name} (${(s.successRate * 100).toFixed(0)}% success)`);
    });
  }
  
  console.log('\n' + '═'.repeat(60));
});
