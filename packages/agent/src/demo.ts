/**
 * Cortex Demo - Full ML Learning Stack with Real Claude LLM
 * 
 * Watch the agent learn using:
 * - Experience Replay + TD Learning
 * - Reflexion (Claude self-critique)
 * - Skill Synthesis
 * - Textual Gradients
 * - Contrastive Learning
 */

import { CortexAgent } from './cortex-agent.js';
import { createMilestoneRecorder } from './solana.js';
import { createClaudeLLM } from './llm.js';

console.log(`
╔══════════════════════════════════════════════════════════════╗
║     🧠 Cortex - ML-Powered Self-Learning Agent               ║
║                                                              ║
║   Learning Stack:                                            ║
║   • Experience Replay + TD Learning (Q-values)               ║
║   • Reflexion (Claude self-critique)                         ║
║   • Skill Synthesis (extract reusable skills)                ║
║   • Textual Gradients (Claude-computed updates)              ║
║   • Contrastive Learning (success vs failure)                ║
║   • Solana Milestones (on-chain proof)                       ║
╚══════════════════════════════════════════════════════════════╝
`);

// Get API key from environment variable
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
if (!ANTHROPIC_API_KEY) {
  console.error('❌ ANTHROPIC_API_KEY environment variable required');
  console.error('   Run: ANTHROPIC_API_KEY=your-key node packages/agent/dist/demo.js');
  process.exit(1);
}

// Create Claude LLM function
const claudeLLM = createClaudeLLM(ANTHROPIC_API_KEY, 'claude-sonnet-4-20250514');

console.log('🤖 Using Claude claude-sonnet-4-20250514 for learning...\n');

// Create Cortex with full learning stack
const cortex = new CortexAgent({
  name: 'Cortex-Demo',
  goals: [
    {
      id: 'research-crypto',
      description: 'Research cryptocurrency market trends and Solana ecosystem',
      priority: 8,
      status: 'active',
    },
  ],
  llmCall: claudeLLM,
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

// Register tools (simulated for demo, but with realistic behavior)
cortex.registerTool('search', async (params) => {
  await sleep(300);
  // 75% success rate
  if (Math.random() > 0.25) {
    return { 
      results: [
        { title: 'Solana DeFi Trends 2026', url: 'https://solana.com/news/defi' },
        { title: 'SOL Price Analysis', url: 'https://coindesk.com/sol' },
      ],
      query: params.query,
    };
  }
  throw new Error('Search API rate limited');
});

cortex.registerTool('fetch', async (params) => {
  await sleep(200);
  // 80% success rate
  if (Math.random() > 0.2) {
    return { 
      text: 'Article content: Solana continues to show strong growth in DeFi TVL...',
      url: params.url || 'https://example.com',
    };
  }
  throw new Error('Fetch timeout');
});

cortex.registerTool('prices', async (params) => {
  await sleep(150);
  // 95% success rate
  if (Math.random() > 0.05) {
    return {
      prices: [
        { coin: 'solana', price: 142.50 + (Math.random() - 0.5) * 20, change24h: (Math.random() - 0.5) * 10 },
        { coin: 'bitcoin', price: 97500 + (Math.random() - 0.5) * 2000, change24h: (Math.random() - 0.5) * 5 },
        { coin: 'ethereum', price: 3200 + (Math.random() - 0.5) * 200, change24h: (Math.random() - 0.5) * 8 },
      ],
      timestamp: new Date().toISOString(),
    };
  }
  throw new Error('Price API unavailable');
});

cortex.registerTool('news', async (params) => {
  await sleep(250);
  // 70% success rate
  if (Math.random() > 0.3) {
    return { 
      articles: [
        { title: 'Solana hits new TVL record', pubDate: '2h ago', source: 'CoinDesk' },
        { title: 'Jupiter DEX volume surges', pubDate: '4h ago', source: 'The Block' },
      ],
      topic: params.topic,
    };
  }
  throw new Error('News feed unavailable');
});

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Set up Solana milestone recording
const recorder = createMilestoneRecorder('https://api.devnet.solana.com');
cortex.setMilestoneHandler(async (milestone) => {
  const txSig = await recorder.record(milestone);
  console.log(`   ⛓️  On-chain: ${txSig}`);
});

// Custom log handler for nice output
cortex.setLogHandler((message, level) => {
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

// Run the demo
const ITERATIONS = parseInt(process.env.ITERATIONS || '15', 10);
console.log(`🚀 Starting Cortex demo (${ITERATIONS} iterations)...\n`);

cortex.run(ITERATIONS).then(() => {
  const metrics = cortex.getMetrics();
  
  console.log('\n' + '═'.repeat(60));
  console.log('📊 FINAL METRICS');
  console.log('═'.repeat(60));
  console.log(`
   Iterations:        ${metrics.iteration}
   Total Actions:     ${metrics.totalActions}
   Successful:        ${metrics.successfulActions}
   Success Rate:      ${((metrics.successfulActions / Math.max(metrics.totalActions, 1)) * 100).toFixed(1)}%
   
   📚 LEARNING (Real Claude LLM):
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
  
  const strategies = cortex.getStrategies();
  console.log('🧠 EVOLVED STRATEGIES:');
  strategies.forEach(s => {
    console.log(`   - ${s.name}: ${(s.successRate * 100).toFixed(0)}% (${s.usageCount} uses)`);
    if (s.heuristics && s.heuristics.length > 0) {
      console.log(`     Heuristics: ${s.heuristics.slice(0, 2).join('; ')}`);
    }
  });
  
  const skills = cortex.getSkills();
  if (skills.length > 0) {
    console.log('\n🔧 SYNTHESIZED SKILLS:');
    // Show unique skills only
    const uniqueSkills = new Map<string, typeof skills[0]>();
    skills.forEach(s => {
      if (!uniqueSkills.has(s.name)) {
        uniqueSkills.set(s.name, s);
      }
    });
    uniqueSkills.forEach(s => {
      console.log(`   - ${s.name} (${(s.successRate * 100).toFixed(0)}% success)`);
      if (s.description) {
        console.log(`     ${s.description.slice(0, 60)}...`);
      }
    });
  }
  
  console.log('\n' + '═'.repeat(60));
  console.log('✅ Demo complete! Agent learned using real Claude LLM.');
  console.log('═'.repeat(60));
}).catch(err => {
  console.error('Demo error:', err);
  process.exit(1);
});
