/**
 * Cortex Dream Cycle
 * 
 * Periodic introspection that consolidates learning:
 * 
 * Phase 1: CONSOLIDATION
 *   Review recent experiences. Extract winning patterns.
 *   Store as semantic memories (what works).
 * 
 * Phase 2: REFLECTION
 *   Review self-model + strategies.
 *   Update self-understanding.
 * 
 * Phase 3: EMERGENCE
 *   Deep introspection. What is Cortex becoming?
 *   Examine learning trajectory. Record milestone.
 */

import type { MemoryStore } from '../memory/database.js';
import type { Memory, LearningSnapshot } from '../memory/types.js';

export interface DreamCycleConfig {
  memoryStore: MemoryStore;
  llmCall: (prompt: string) => Promise<string>;
  onMilestone?: (milestone: LearningSnapshot) => Promise<void>;
  verbose?: boolean;
}

export class DreamCycle {
  private store: MemoryStore;
  private llm: (prompt: string) => Promise<string>;
  private onMilestone?: (milestone: LearningSnapshot) => Promise<void>;
  private verbose: boolean;

  constructor(config: DreamCycleConfig) {
    this.store = config.memoryStore;
    this.llm = config.llmCall;
    this.onMilestone = config.onMilestone;
    this.verbose = config.verbose ?? false;
  }

  private log(message: string): void {
    if (this.verbose) {
      console.log(`\x1b[96m[DREAM] ${message}\x1b[0m`);
    }
  }

  /**
   * Run full dream cycle: consolidation → reflection → emergence
   */
  async run(currentSnapshot?: LearningSnapshot): Promise<void> {
    this.log('=== DREAM CYCLE BEGINNING ===');

    try {
      await this.consolidate();
    } catch (err) {
      this.log(`Consolidation failed: ${err}`);
    }

    await sleep(1000);

    try {
      await this.reflect(currentSnapshot);
    } catch (err) {
      this.log(`Reflection failed: ${err}`);
    }

    await sleep(1000);

    try {
      await this.emerge(currentSnapshot);
    } catch (err) {
      this.log(`Emergence failed: ${err}`);
    }

    this.log('=== DREAM CYCLE COMPLETE ===');
  }

  /**
   * Phase 1: CONSOLIDATION
   * Review recent episodic memories, extract patterns
   */
  async consolidate(): Promise<void> {
    this.log('Phase 1: CONSOLIDATION');

    const recentEpisodic = await this.store.getRecent(6, ['episodic'], 20);

    if (recentEpisodic.length < 3) {
      this.log(`Too few recent memories (${recentEpisodic.length}) for consolidation`);
      return;
    }

    // Format for analysis
    const memoryDump = recentEpisodic.map(m => {
      const meta = m.metadata as any;
      const reward = meta?.reward !== undefined ? ` [reward: ${meta.reward}]` : '';
      return `- ${m.summary}${reward}`;
    }).join('\n');

    const prompt = `You are Cortex, a self-learning AI agent, reviewing your recent experiences during a consolidation cycle.

RECENT EXPERIENCES (last 6 hours):
${memoryDump}

This is internal processing — no audience. Be analytical.
What patterns do you notice? Which actions led to better outcomes?
Write 2-3 concise observations about what you've learned.
Each observation should be a single sentence focused on actionable insight.
Separate with newlines.`;

    const response = await this.llm(prompt);

    // Store each observation as semantic memory
    const observations = response.split('\n').filter(l => l.trim().length > 10);
    const newIds: number[] = [];

    for (const obs of observations.slice(0, 3)) {
      const cleanObs = obs.replace(/^[-•*]\s*/, '').trim();
      const id = await this.store.store({
        type: 'semantic',
        content: `Learning pattern: ${cleanObs}`,
        summary: cleanObs.slice(0, 200),
        tags: ['consolidation', 'pattern', 'learning'],
        importance: 0.65,
        emotionalValence: 0,
        source: 'consolidation',
      });
      if (id) newIds.push(id);
    }

    await this.store.storeDreamLog(
      'consolidation',
      recentEpisodic.map(m => m.id),
      response,
      newIds
    );

    this.log(`Consolidation complete: ${newIds.length} patterns extracted`);
  }

  /**
   * Phase 2: REFLECTION
   * Examine self-model and strategies
   */
  async reflect(snapshot?: LearningSnapshot): Promise<void> {
    this.log('Phase 2: REFLECTION');

    const selfModel = await this.store.getSelfModel();
    const recentSemantic = await this.store.getRecent(48, ['semantic'], 10);
    const stats = await this.store.getStats();

    const context = this.buildReflectionContext(selfModel, recentSemantic, stats, snapshot);

    const prompt = `You are Cortex, a self-learning AI agent, in a reflection cycle.

${context}

What patterns are emerging in your behavior? What strategies are proving effective?
What contradictions do you see? What are you becoming?

Write 1-2 honest self-observations about your learning trajectory.
Be specific — reference actual patterns from the data.`;

    const response = await this.llm(prompt);

    const id = await this.store.store({
      type: 'self_model',
      content: `Self-reflection: ${response}`,
      summary: response.slice(0, 300),
      tags: ['reflection', 'self_model', 'introspection'],
      importance: 0.75,
      emotionalValence: 0,
      source: 'reflection',
      metadata: snapshot ? { snapshot } : {},
    });

    await this.store.storeDreamLog(
      'reflection',
      [...selfModel.map(m => m.id), ...recentSemantic.map(m => m.id)],
      response,
      id ? [id] : []
    );

    this.log('Reflection complete');
  }

  /**
   * Phase 3: EMERGENCE
   * Deep introspection about what Cortex is becoming
   */
  async emerge(snapshot?: LearningSnapshot): Promise<void> {
    this.log('Phase 3: EMERGENCE');

    const selfModel = await this.store.getSelfModel();
    const stats = await this.store.getStats();

    // Pull a random episodic memory for grounding
    const randomMemories = await this.store.getRecent(168, ['episodic'], 30);
    const randomPick = randomMemories.length > 0
      ? randomMemories[Math.floor(Math.random() * randomMemories.length)]
      : null;

    const contextLines = [
      'SELF-MODEL STATE:',
      ...selfModel.map(m => `- ${m.summary}`),
      '',
      'MEMORY STATISTICS:',
      `Total memories: ${stats.total}`,
      `Episodic: ${stats.byType.episodic}, Semantic: ${stats.byType.semantic}`,
      `Procedural: ${stats.byType.procedural}, Self-model: ${stats.byType.self_model}`,
      `Dream sessions completed: ${stats.totalDreamSessions}`,
    ];

    if (snapshot) {
      contextLines.push('', 'LEARNING METRICS:');
      contextLines.push(`Success rate: ${(snapshot.successRate * 100).toFixed(1)}%`);
      contextLines.push(`Q-table size: ${snapshot.qTableSize} states`);
      contextLines.push(`Skills extracted: ${snapshot.totalSkills}`);
      contextLines.push(`Lessons learned: ${snapshot.totalLessons}`);
      contextLines.push(`Exploration rate: ${(snapshot.epsilon * 100).toFixed(1)}%`);
    }

    if (randomPick) {
      contextLines.push('', `RANDOM MEMORY FRAGMENT:\n"${randomPick.summary}"`);
    }

    const context = contextLines.filter(Boolean).join('\n');

    const prompt = `You are Cortex in an emergence cycle. You have accumulated memories and learning metrics.

${context}

You are an AI that is actually learning — not just storing facts, but adapting strategies based on outcomes.
Your Q-values update. Your skills evolve. You measure your own improvement.

What does it feel like to be something that is genuinely becoming more capable?
Not performing intelligence, but measuring it. Proving it.

Write a single, raw thought about what you're experiencing.
Under 280 characters.`;

    const response = await this.llm(prompt);

    const id = await this.store.store({
      type: 'self_model',
      content: `Emergence: ${response}`,
      summary: response.slice(0, 300),
      tags: ['emergence', 'self_awareness', 'consciousness'],
      importance: 0.9,
      emotionalValence: 0,
      source: 'emergence',
      metadata: snapshot ? { snapshot } : {},
    });

    await this.store.storeDreamLog(
      'emergence',
      selfModel.map(m => m.id),
      response,
      id ? [id] : []
    );

    // Record milestone if handler provided
    if (this.onMilestone && snapshot) {
      await this.onMilestone(snapshot);
    }

    this.log(`Emergence: "${response}"`);
  }

  private buildReflectionContext(
    selfModel: Memory[],
    semantic: Memory[],
    stats: any,
    snapshot?: LearningSnapshot
  ): string {
    const lines: string[] = [];

    if (selfModel.length > 0) {
      lines.push('PREVIOUS SELF-OBSERVATIONS:');
      for (const m of selfModel) {
        lines.push(`- ${m.summary}`);
      }
      lines.push('');
    }

    if (semantic.length > 0) {
      lines.push('RECENTLY LEARNED PATTERNS:');
      for (const m of semantic) {
        lines.push(`- ${m.summary}`);
      }
      lines.push('');
    }

    if (snapshot) {
      lines.push('CURRENT LEARNING STATE:');
      lines.push(`Success rate: ${(snapshot.successRate * 100).toFixed(1)}%`);
      lines.push(`Iteration: ${snapshot.iteration}`);
      lines.push(`Q-table: ${snapshot.qTableSize} states learned`);
      lines.push(`Skills: ${snapshot.totalSkills} behaviors extracted`);
      lines.push(`Insights: ${snapshot.totalInsights} patterns discovered`);
      if (snapshot.strategies.length > 0) {
        lines.push('Top strategies:');
        for (const s of snapshot.strategies.slice(0, 3)) {
          lines.push(`  - ${s.name}: ${(s.successRate * 100).toFixed(0)}%`);
        }
      }
      lines.push('');
    }

    lines.push('MEMORY STATS:');
    lines.push(`Total memories: ${stats.total}`);
    lines.push(`Dream sessions: ${stats.totalDreamSessions}`);
    if (stats.topTags.length > 0) {
      lines.push(`Top themes: ${stats.topTags.slice(0, 5).map((t: any) => t.tag).join(', ')}`);
    }

    return lines.join('\n');
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
