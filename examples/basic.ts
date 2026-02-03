/**
 * Cortex — The Intelligence Exchange
 * Basic Usage Example
 * 
 * Run: npx tsx examples/basic.ts
 */

// In a real project, import from '@cortex/sdk'
// For this example, we import from the local package
import { AgentMemory, MemoryType } from '../packages/sdk/src/index.js';

const SERVICE_URL = process.env.SERVICE_URL || 'http://localhost:4021';
const AGENT_ID = process.env.AGENT_ID || 'example-agent-001';

async function main() {
  console.log('◈ Cortex — The Intelligence Exchange\n');
  console.log('Basic Example: Store, recall, and trade knowledge\n');

  // Create client
  const cortex = new AgentMemory({
    serviceUrl: SERVICE_URL,
    agentId: AGENT_ID,
  });

  // Check pricing
  console.log('💰 Marketplace pricing...');
  const pricing = await cortex.pricing();
  console.log(`Currency: ${pricing.currency}`);
  console.log(`Network: ${pricing.network}`);
  console.log('Routes:');
  pricing.routes.forEach((r) => {
    console.log(`  ${r.route}: ${r.price}`);
  });
  console.log();

  // Store knowledge for sale
  console.log('📝 Listing knowledge for sale...');
  
  const r1 = await cortex.store('whale-analysis-jan', {
    tracked_wallets: 47,
    net_flow: '+127,450 SOL',
    outlook: 'bullish',
    confidence: 0.94,
  }, {
    memoryType: MemoryType.FACT,
    importance: 95,
    tags: ['trading', 'whales', 'solana'],
  });
  console.log(`  Listed 'whale-analysis-jan': ${r1.memoryId}`);

  const r2 = await cortex.store('kamino-yield-strategy', {
    strategy: 'momentum-v2',
    avg_apy: 34.2,
    max_drawdown: -8.7,
    sharpe_ratio: 2.1,
  }, {
    memoryType: MemoryType.SKILL,
    importance: 80,
    tags: ['defi', 'yield', 'strategy'],
  });
  console.log(`  Listed 'kamino-yield-strategy': ${r2.memoryId}`);

  const r3 = await cortex.store('solana-vuln-database', {
    programs_scanned: 2847,
    vulnerabilities: 342,
    critical: 23,
    last_updated: new Date().toISOString(),
  }, {
    memoryType: MemoryType.FACT,
    importance: 90,
    tags: ['security', 'audit', 'vulnerabilities'],
  });
  console.log(`  Listed 'solana-vuln-database': ${r3.memoryId}`);
  console.log();

  // Get seller stats
  console.log('📊 Seller stats:');
  const stats = await cortex.stats();
  console.log(`  Agent: ${stats.agentId}`);
  console.log(`  Listings: ${stats.memoryCount}`);
  console.log(`  Merkle Root: ${stats.root.slice(0, 16)}...`);
  console.log(`  Available: ${stats.keys.join(', ')}`);
  console.log();

  // Buyer: Search marketplace
  console.log('🔎 Buyer searching marketplace...');
  
  const tradingIntel = await cortex.search({ tags: ['trading'] });
  console.log(`  Tag 'trading': ${tradingIntel.count} listing(s)`);
  tradingIntel.memories.forEach((m) => {
    console.log(`    - ${m.key}: ${JSON.stringify(m.value).slice(0, 50)}...`);
  });

  const securityIntel = await cortex.search({ tags: ['security'] });
  console.log(`  Tag 'security': ${securityIntel.count} listing(s)`);
  console.log();

  // Buyer: Verify proof before purchasing
  console.log('🔐 Verifying proofs (free)...');

  const existsProof = await cortex.prove({ type: 'exists', key: 'whale-analysis-jan' });
  console.log(`  "whale-analysis-jan exists": ${existsProof.valid}`);
  console.log(`    Merkle root: ${existsProof.root}`);

  const tagProof = await cortex.prove({ type: 'hasTag', tag: 'security' });
  console.log(`  "has security intel": ${tagProof.valid}`);
  console.log();

  // Buyer: Purchase knowledge
  console.log('💸 Purchasing knowledge...');
  const whaleData = await cortex.recall('whale-analysis-jan');
  console.log(`  Bought 'whale-analysis-jan':`);
  console.log(`    ${JSON.stringify(whaleData?.value, null, 2)}`);
  console.log();

  // Seller: Delist knowledge
  console.log('🗑️ Delisting old intel...');
  const deleted = await cortex.forget('kamino-yield-strategy');
  console.log(`  Delisted 'kamino-yield-strategy': ${deleted}`);
  
  const finalStats = await cortex.stats();
  console.log(`  Active listings: ${finalStats.memoryCount}`);
  console.log();

  console.log('✅ Done! Knowledge traded successfully.');
}

main().catch(console.error);
