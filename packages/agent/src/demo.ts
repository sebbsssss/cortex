/**
 * ARIA Demo - Watch the agent learn in real-time
 */

import { createARIA } from './index.js';

console.log(`
╔══════════════════════════════════════════════════════════════╗
║     🧠 ARIA - Autonomous Reflective Intelligence Agent       ║
║        Self-learning AI with on-chain proof of growth        ║
╚══════════════════════════════════════════════════════════════╝
`);

// Create ARIA with a research goal
const aria = createARIA({
  name: 'ARIA-Demo',
  goals: [
    {
      id: 'research-crypto',
      description: 'Research cryptocurrency market trends and Solana ecosystem',
      priority: 8,
      progress: 0,
      status: 'active',
    },
    {
      id: 'monitor-prices',
      description: 'Monitor crypto prices and detect significant movements',
      priority: 6,
      progress: 0,
      status: 'active',
    },
  ],
  reflectionThreshold: 0.5,  // Update strategy if score < 50%
  learningRate: 0.3,          // Learn quickly from feedback
  milestoneThreshold: 0.15,   // Record milestone on 15% improvement
});

// Register mock tools for demo (replace with real API calls)
aria.registerTool('search', async (params) => {
  console.log(`[Tool:search] Query: "${params.query || params.topic}"`);
  // Simulate search with random success
  await sleep(500);
  if (Math.random() > 0.3) {
    return {
      results: [
        { title: 'Solana DeFi Growth 2026', url: 'https://...' },
        { title: 'MEV Strategies on Solana', url: 'https://...' },
      ],
    };
  }
  throw new Error('Search API rate limited');
});

aria.registerTool('fetch', async (params) => {
  console.log(`[Tool:fetch] URL: ${params.url || 'default'}`);
  await sleep(300);
  return { text: 'Article content about Solana...' };
});

aria.registerTool('prices', async (params) => {
  console.log(`[Tool:prices] Checking crypto prices...`);
  await sleep(200);
  return {
    prices: [
      { coin: 'solana', price: 142.50, change24h: 3.2 },
      { coin: 'bitcoin', price: 97500, change24h: -0.5 },
    ],
  };
});

aria.registerTool('news', async (params) => {
  console.log(`[Tool:news] Topic: "${params.topic}"`);
  await sleep(400);
  if (Math.random() > 0.2) {
    return {
      articles: [
        { title: 'Solana hits new TVL record', pubDate: '1h ago' },
      ],
    };
  }
  throw new Error('News feed unavailable');
});

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Run the agent for 10 iterations
console.log('\\n🚀 Starting ARIA demo (10 iterations)...\\n');

aria.run(10).then(() => {
  console.log('\\n📊 Final Metrics:');
  const metrics = aria.getMetrics();
  console.log(`   Total Actions: ${metrics.totalActions}`);
  console.log(`   Success Rate: ${(metrics.successRate * 100).toFixed(1)}%`);
  console.log(`   Avg Reflection: ${(metrics.avgReflectionScore * 100).toFixed(1)}%`);
  console.log(`   Strategies Learned: ${metrics.strategiesLearned}`);
  console.log(`   Milestones Recorded: ${metrics.milestonesRecorded}`);
  
  console.log('\\n🧠 Learned Strategies:');
  aria.getStrategies().forEach(s => {
    console.log(`   - ${s.name}: ${(s.successRate * 100).toFixed(0)}% success (${s.usageCount} uses)`);
  });
});
