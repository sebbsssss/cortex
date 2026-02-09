/**
 * Cortex with Persistent Memory
 * 
 * Extends CortexAgent with:
 * - Persistent memory storage (episodic, semantic, procedural, self_model)
 * - Dream cycle for consolidation/reflection/emergence
 * - Memory-guided learning
 * - Cross-session continuity
 */

import { CortexAgent, type CortexAgentConfig, type ActionResult } from './cortex-agent.js';
import { InMemoryStore, SupabaseStore, type MemoryStore, formatMemoryContext } from './memory/database.js';
import { createCortexMemoryIntegration, type CortexMemoryIntegration, type CortexMetrics } from './memory/cortex-integration.js';
import { DreamCycle } from './dreams/dream-cycle.js';
import type { LearningSnapshot } from './memory/types.js';

export interface CortexWithMemoryConfig extends CortexAgentConfig {
  memory?: {
    // Use Supabase for persistence
    supabaseUrl?: string;
    supabaseKey?: string;
    
    // Dream cycle settings
    enableDreamCycle?: boolean;
    dreamIntervalMs?: number;
    
    // Memory settings
    storeExperiences?: boolean;  // Store every experience (can be noisy)
    storeLessons?: boolean;      // Store reflexion lessons
    storeSkills?: boolean;       // Store synthesized skills
    storeInsights?: boolean;     // Store contrastive insights
  };
}

export class CortexWithMemory extends CortexAgent {
  private memoryStore: MemoryStore;
  private memoryIntegration: CortexMemoryIntegration;
  private dreamCycle: DreamCycle;
  private memoryConfig: NonNullable<CortexWithMemoryConfig['memory']>;
  private lastDreamTime: number = 0;
  
  constructor(config: CortexWithMemoryConfig) {
    super(config);
    
    this.memoryConfig = {
      enableDreamCycle: true,
      dreamIntervalMs: 6 * 60 * 60 * 1000, // 6 hours
      storeExperiences: false, // Off by default (can be noisy)
      storeLessons: true,
      storeSkills: true,
      storeInsights: true,
      ...config.memory,
    };
    
    // Initialize memory store
    if (this.memoryConfig.supabaseUrl && this.memoryConfig.supabaseKey) {
      this.memoryStore = new SupabaseStore(
        this.memoryConfig.supabaseUrl,
        this.memoryConfig.supabaseKey
      );
      console.log('\x1b[96m[MEMORY] Using Supabase for persistent storage\x1b[0m');
    } else {
      this.memoryStore = new InMemoryStore();
      console.log('\x1b[96m[MEMORY] Using in-memory store (no persistence)\x1b[0m');
    }
    
    // Create integration
    this.memoryIntegration = createCortexMemoryIntegration(this.memoryStore);
    
    // Initialize dream cycle
    this.dreamCycle = new DreamCycle({
      memoryStore: this.memoryStore,
      llmCall: config.llmCall,
      onMilestone: async (snapshot) => {
        console.log(`\x1b[93m[DREAM] Milestone: Success rate ${(snapshot.successRate * 100).toFixed(1)}%\x1b[0m`);
      },
      verbose: true,
    });
  }
  
  /**
   * Override run to add memory hooks
   */
  async run(maxIterations: number = Infinity): Promise<void> {
    // Recall prior learnings before starting
    await this.recallPriorLearnings();
    
    // Run parent loop with memory hooks
    await super.run(maxIterations);
    
    // Dream at the end if enabled
    if (this.memoryConfig.enableDreamCycle) {
      await this.runDreamCycleIfDue();
    }
  }
  
  /**
   * Recall prior learnings from memory
   */
  private async recallPriorLearnings(): Promise<void> {
    console.log('\x1b[96m[MEMORY] Recalling prior learnings...\x1b[0m');
    
    // Recall lessons
    const lessons = await this.memoryIntegration.recallLessons();
    if (lessons.length > 0) {
      console.log(`\x1b[96m[MEMORY] Found ${lessons.length} prior lessons\x1b[0m`);
      // Inject into reflexion engine
      // Note: This would require exposing a method on CortexAgent
    }
    
    // Recall skills
    const skills = await this.memoryIntegration.recallSkillsForTask('general');
    if (skills.length > 0) {
      console.log(`\x1b[96m[MEMORY] Found ${skills.length} prior skills\x1b[0m`);
    }
    
    // Get self model for context
    const selfModel = await this.memoryStore.getSelfModel();
    if (selfModel.length > 0) {
      console.log(`\x1b[96m[MEMORY] Self-model state:\x1b[0m`);
      for (const m of selfModel.slice(0, 3)) {
        console.log(`  - ${m.summary.slice(0, 80)}...`);
      }
    }
  }
  
  /**
   * Store a lesson (hook for reflexion)
   */
  async storeLesson(lesson: string, source: string = 'reflexion'): Promise<void> {
    if (this.memoryConfig.storeLessons) {
      await this.memoryIntegration.storeLesson(lesson, source);
    }
  }
  
  /**
   * Store an insight (hook for contrastive learning)
   */
  async storeInsight(insight: string): Promise<void> {
    if (this.memoryConfig.storeInsights) {
      await this.memoryIntegration.storeInsight(insight);
    }
  }
  
  /**
   * Store an experience (hook for experience replay)
   */
  async storeExperience(
    state: string,
    action: string,
    reward: number,
    nextState: string,
    success: boolean,
    toolUsed?: string
  ): Promise<void> {
    if (this.memoryConfig.storeExperiences) {
      await this.memoryIntegration.storeExperience({
        state,
        action,
        reward,
        nextState,
        success,
        toolUsed,
      });
    }
  }
  
  /**
   * Run dream cycle if enough time has passed
   */
  async runDreamCycleIfDue(): Promise<void> {
    const now = Date.now();
    if (now - this.lastDreamTime < this.memoryConfig.dreamIntervalMs!) {
      return;
    }
    
    console.log('\x1b[96m[MEMORY] Starting dream cycle...\x1b[0m');
    
    const metrics = this.getMetrics();
    const snapshot = this.memoryIntegration.createSnapshot(metrics as CortexMetrics);
    
    await this.dreamCycle.run(snapshot);
    
    this.lastDreamTime = now;
  }
  
  /**
   * Force a dream cycle (for testing/demo)
   */
  async dream(): Promise<void> {
    const metrics = this.getMetrics();
    const snapshot = this.memoryIntegration.createSnapshot(metrics as CortexMetrics);
    await this.dreamCycle.run(snapshot);
    this.lastDreamTime = Date.now();
  }
  
  /**
   * Get memory stats
   */
  async getMemoryStats() {
    return this.memoryStore.getStats();
  }
  
  /**
   * Format memories for LLM context injection
   */
  async getMemoryContext(limit: number = 10): Promise<string> {
    const memories = await this.memoryStore.recall({
      limit,
      minImportance: 0.3,
    });
    return formatMemoryContext(memories);
  }
  
  /**
   * Export state including memory
   */
  async exportStateWithMemory() {
    const baseState = this.exportState();
    const memoryStats = await this.memoryStore.getStats();
    
    return {
      ...baseState,
      memoryStats,
      lastDreamTime: this.lastDreamTime,
    };
  }
}

// Re-export types
export type { LearningSnapshot, CortexMetrics };
