/**
 * Cortex Demo with Persistent Memory
 * 
 * Shows the full cognitive architecture:
 * - Learning from experience
 * - Storing memories (episodic, semantic, procedural, self_model)
 * - Dream cycle (consolidation, reflection, emergence)
 * - Cross-session continuity
 */

import { CortexWithMemory } from './cortex-with-memory.js';
import { createMilestoneRecorder } from './solana.js';
import { createClaudeLLM } from './llm.js';

console.log(`
╔══════════════════════════════════════════════════════════════╗
║     🧠 Cortex with Persistent Memory                         ║
║                                                              ║
║   Cognitive Architecture:                                    ║
║   • 4-tier Memory (episodic/semantic/procedural/self_model)  ║
║   • Dream Cycle (consolidation → reflection → emergence)     ║
║   • Stanford Generative Agents-style recall                  ║
║   • On-chain learning proofs                                 ║
╚══════════════════════════════════════════════════════════════╝
`);

// Get API key from environment variable
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
if (!ANTHROPIC_API_KEY) {
  console.error('❌ ANTHROPIC_API_KEY environment variable required');
  console.error('   Run: ANTHROPIC_API_KEY=your-key npm run demo:memory');
  process.exit(1);
}

// Optional: Supabase for persistence
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (SUPABASE_URL && SUPABASE_KEY) {
  console.log('📦 Supabase configured — memories will persist across sessions\n');
} else {
  console.log('📦 No Supabase — using in-memory store (memories lost on exit)\n');
}

// Create Claude LLM function
const claudeLLM = createClaudeLLM(ANTHROPIC_API_KEY, 'claude-sonnet-4-20250514');

// Create Cortex with Memory
const cortex = new CortexWithMemory({
  name: 'Cortex-Memory-Demo',
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
    alpha: 0.15,
    gamma: 0.95,
    epsilon: 0.3,
    reflexionThreshold: 0.5,
    gradientThreshold: 0.4,
    skillConfidence: 0.7,
  },
  tools: ['search', 'fetch', 'prices', 'news'],
  memory: {
    supabaseUrl: SUPABASE_URL,
    supabaseKey: SUPABASE_KEY,
    enableDreamCycle: true,
    storeLessons: true,
    storeSkills: true,
    storeInsights: true,
    storeExperiences: false, // Too noisy for demo
  },
});

// Register tools (simulated)
cortex.registerTool('search', async (params) => {
  await sleep(300);
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
  if (Math.random() > 0.2) {
    return { 
      text: 'Article content: Solana continues to show strong growth...',
      url: params.url || 'https://example.com',
    };
  }
  throw new Error('Fetch timeout');
});

cortex.registerTool('prices', async () => {
  await sleep(150);
  if (Math.random() > 0.05) {
    return {
      prices: [
        { coin: 'solana', price: 142.50 + (Math.random() - 0.5) * 20 },
        { coin: 'bitcoin', price: 97500 + (Math.random() - 0.5) * 2000 },
      ],
    };
  }
  throw new Error('Price API unavailable');
});

cortex.registerTool('news', async (params) => {
  await sleep(250);
  if (Math.random() > 0.3) {
    return { 
      articles: [
        { title: 'Solana hits new TVL record', pubDate: '2h ago' },
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

// Custom log handler
cortex.setLogHandler((message, level) => {
  const colors: Record<string, string> = {
    system: '\x1b[36m',
    info: '\x1b[37m',
    perceive: '\x1b[35m',
    reason: '\x1b[34m',
    success: '\x1b[32m',
    warning: '\x1b[33m',
    error: '\x1b[31m',
    learn: '\x1b[96m',
    milestone: '\x1b[93m',
  };
  const reset = '\x1b[0m';
  const color = colors[level] || '\x1b[37m';
  console.log(`${color}${message}${reset}`);
});

// Run the demo
const ITERATIONS = parseInt(process.env.ITERATIONS || '10', 10);
console.log(`🚀 Starting demo (${ITERATIONS} iterations)...\n`);

cortex.run(ITERATIONS).then(async () => {
  const metrics = cortex.getMetrics();
  
  console.log('\n' + '═'.repeat(60));
  console.log('📊 LEARNING METRICS');
  console.log('═'.repeat(60));
  console.log(`
   Iterations:        ${metrics.iteration}
   Success Rate:      ${((metrics.successfulActions / Math.max(metrics.totalActions, 1)) * 100).toFixed(1)}%
   
   📚 LEARNING:
   Experience Buffer: ${metrics.experienceBuffer}
   Q-Table States:    ${metrics.qTableSize}
   Skills Extracted:  ${metrics.totalSkills}
   Lessons Learned:   ${metrics.totalLessons}
   Insights Found:    ${metrics.totalInsights}
  `);

  // Show memory stats
  const memoryStats = await cortex.getMemoryStats();
  console.log('═'.repeat(60));
  console.log('🧠 MEMORY STATE');
  console.log('═'.repeat(60));
  console.log(`
   Total Memories:    ${memoryStats.total}
   - Episodic:        ${memoryStats.byType.episodic}
   - Semantic:        ${memoryStats.byType.semantic}
   - Procedural:      ${memoryStats.byType.procedural}
   - Self-Model:      ${memoryStats.byType.self_model}
   
   Dream Sessions:    ${memoryStats.totalDreamSessions}
   Avg Importance:    ${memoryStats.avgImportance.toFixed(2)}
   Top Themes:        ${memoryStats.topTags.slice(0, 5).map(t => t.tag).join(', ') || 'none yet'}
  `);

  // Run dream cycle
  console.log('═'.repeat(60));
  console.log('💤 ENTERING DREAM CYCLE...');
  console.log('═'.repeat(60) + '\n');
  
  await cortex.dream();

  // Show updated memory stats
  const finalStats = await cortex.getMemoryStats();
  console.log('\n' + '═'.repeat(60));
  console.log('🧠 POST-DREAM MEMORY STATE');
  console.log('═'.repeat(60));
  console.log(`
   Total Memories:    ${finalStats.total}
   Dream Sessions:    ${finalStats.totalDreamSessions}
   Self-Model:        ${finalStats.byType.self_model}
  `);

  console.log('═'.repeat(60));
  console.log('✅ Demo complete! Agent learned and dreamed.');
  console.log('═'.repeat(60));
  
  if (!SUPABASE_URL) {
    console.log('\n💡 Tip: Add SUPABASE_URL and SUPABASE_SERVICE_KEY to persist memories across sessions.');
  }

}).catch(err => {
  console.error('Demo error:', err);
  process.exit(1);
});
