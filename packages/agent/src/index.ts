/**
 * ARIA - Autonomous Reflective Intelligence Agent
 * 
 * A self-learning AI agent that improves through reflection
 * and records learning milestones on Solana.
 */

export { ARIA } from './aria.js';
export { MilestoneRecorder, createMilestoneRecorder } from './solana.js';
export * from './types.js';

// Quick start helper
import { ARIA } from './aria.js';
import { createMilestoneRecorder } from './solana.js';
import type { ARIAConfig, Goal, Milestone } from './types.js';

/**
 * Create a ready-to-run ARIA agent with Solana integration
 */
export function createARIA(config: Partial<ARIAConfig> & { goals: Goal[] }): ARIA {
  const fullConfig: ARIAConfig = {
    name: config.name || 'ARIA',
    goals: config.goals,
    reflectionThreshold: config.reflectionThreshold || 0.6,
    learningRate: config.learningRate || 0.2,
    milestoneThreshold: config.milestoneThreshold || 0.1,
    tools: config.tools || ['search', 'fetch', 'prices', 'news'],
    solanaRpc: config.solanaRpc || 'https://api.devnet.solana.com',
  };

  const agent = new ARIA(fullConfig);

  // Set up Solana milestone recording
  const recorder = createMilestoneRecorder(fullConfig.solanaRpc);
  agent.setMilestoneHandler(async (milestone: Milestone) => {
    const txSig = await recorder.record(milestone);
    milestone.txSignature = txSig;
    console.log(`[ARIA] Milestone on-chain: ${txSig}`);
  });

  return agent;
}

// Example usage in comments:
/*
import { createARIA } from '@cortex/agent';

const aria = createARIA({
  name: 'ResearchBot',
  goals: [
    {
      id: 'research-solana',
      description: 'Research Solana MEV strategies',
      priority: 8,
      progress: 0,
      status: 'active',
    }
  ],
});

// Register tools (from @cortex/server skills)
aria.registerTool('search', async (params) => {
  // Call search API
});

aria.registerTool('prices', async (params) => {
  // Call prices API  
});

// Run the agent
await aria.run(100); // 100 iterations

// Check metrics
console.log(aria.getMetrics());
// { totalActions: 150, successRate: 0.73, milestonesRecorded: 3, ... }
*/
