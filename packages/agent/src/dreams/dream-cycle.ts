/**
 * Cortex Dream Cycle
 * 
 * Multi-phase introspection inspired by:
 * - Park et al. 2023 (Generative Agents) — focal point questions, evidence-linked reflections
 * - Human memory consolidation
 * 
 * Phase 1: CONSOLIDATION (focal-point-driven)
 *   Generate salient questions from recent memories.
 *   For each question, retrieve relevant memories and generate
 *   an evidence-linked insight.
 * 
 * Phase 2: REFLECTION
 *   Review self-model + semantic memories with evidence citations.
 *   Update self-understanding.
 * 
 * Phase 3: EMERGENCE
 *   Deep introspection. What is Cortex becoming?
 *   Record learning milestone.
 * 
 * Triggering: event-driven (importance accumulator) with periodic fallback.
 */

import type { MemoryStore } from '../memory/database.js';
import { parseEvidenceCitations } from '../memory/database.js';
import type { Memory, LearningSnapshot } from '../memory/types.js';
import {
  REFLECTION_IMPORTANCE_THRESHOLD,
  REFLECTION_MIN_INTERVAL_MS,
} from '../memory/constants.js';

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
  
  // Event-driven reflection state
  private importanceAccumulator = 0;
  private lastReflectionTime = Date.now();
  private reflectionInProgress = false;

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
   * Accumulate importance from stored memories.
   * Triggers reflection when threshold exceeded.
   */
  accumulateImportance(importance: number): void {
    this.importanceAccumulator += importance;

    const timeSinceLastReflection = Date.now() - this.lastReflectionTime;
    const pastMinInterval = timeSinceLastReflection >= REFLECTION_MIN_INTERVAL_MS;

    if (
      this.importanceAccumulator >= REFLECTION_IMPORTANCE_THRESHOLD &&
      pastMinInterval &&
      !this.reflectionInProgress
    ) {
      this.log(`Importance threshold exceeded (${this.importanceAccumulator.toFixed(2)}) — triggering reflection`);
      this.run().catch(err => this.log(`Event-driven reflection failed: ${err}`));
    }
  }

  /**
   * Run full dream cycle: consolidation → reflection → emergence
   */
  async run(currentSnapshot?: LearningSnapshot): Promise<void> {
    if (this.reflectionInProgress) {
      this.log('Reflection already in progress, skipping');
      return;
    }

    this.reflectionInProgress = true;
    this.log('=== DREAM CYCLE BEGINNING ===');

    try {
      await this.consolidate();
      await sleep(1000);
      await this.reflect(currentSnapshot);
      await sleep(1000);
      await this.emerge(currentSnapshot);

      // Reset accumulator
      this.importanceAccumulator = 0;
      this.lastReflectionTime = Date.now();
    } finally {
      this.reflectionInProgress = false;
    }

    this.log('=== DREAM CYCLE COMPLETE ===');
  }

  /**
   * Phase 1: CONSOLIDATION
   * Generate focal point questions, then answer with evidence
   */
  async consolidate(): Promise<void> {
    this.log('Phase 1: CONSOLIDATION');

    const recentEpisodic = await this.store.getRecent(6, ['episodic'], 20);

    if (recentEpisodic.length < 3) {
      this.log(`Too few recent memories (${recentEpisodic.length}) for consolidation`);
      return;
    }

    // Step 1: Generate focal point questions
    const focalPoints = await this.generateFocalPoints(recentEpisodic);
    
    if (focalPoints.length === 0) {
      this.log('No focal points generated, using direct consolidation');
      await this.directConsolidate(recentEpisodic);
      return;
    }

    this.log(`Focal points: ${focalPoints.join(' | ')}`);

    // Step 2: For each focal point, retrieve relevant memories and generate insight
    const allNewIds: number[] = [];
    const allInputIds = new Set(recentEpisodic.map(m => m.id));

    for (const question of focalPoints) {
      const relevant = await this.store.recall({
        query: question,
        memoryTypes: ['episodic', 'semantic'],
        limit: 8,
      });

      relevant.forEach(m => allInputIds.add(m.id));

      const numberedMemories = relevant.map((m, i) =>
        `[${i + 1}] ${m.summary}`
      ).join('\n');

      const prompt = `Question: ${question}

RELEVANT MEMORIES:
${numberedMemories}

Answer with a single insightful observation based on these memories.
Cite the evidence in parentheses, e.g. (because of 1, 3, 5).
One sentence only.`;

      const response = await this.llm(prompt);
      const { text, evidenceIds } = parseEvidenceCitations(response, relevant);

      const id = await this.store.store({
        type: 'semantic',
        content: `Insight (re: "${question}"): ${text}`,
        summary: text.slice(0, 200),
        tags: ['consolidation', 'focal_point', 'learning'],
        importance: 0.65,
        emotionalValence: 0,
        source: 'consolidation',
        evidenceIds,
      });
      if (id) allNewIds.push(id);
    }

    await this.store.storeDreamLog(
      'consolidation',
      Array.from(allInputIds),
      `Focal points: ${focalPoints.join(' | ')}`,
      allNewIds
    );

    this.log(`Consolidation complete: ${allNewIds.length} insights from ${focalPoints.length} focal points`);
  }

  /**
   * Generate focal point questions from recent memories (Park et al. 2023)
   */
  private async generateFocalPoints(memories: Memory[]): Promise<string[]> {
    const memoryDump = memories.map((m, i) => `${i + 1}. ${m.summary}`).join('\n');

    const prompt = `Given these recent memory statements:
${memoryDump}

What are 3 most salient high-level questions we can answer about these experiences?
Write exactly 3 questions, one per line. No numbering.`;

    try {
      const response = await this.llm(prompt);
      return response
        .split('\n')
        .map(l => l.trim())
        .filter(l => l.length > 10 && l.includes('?'))
        .slice(0, 3);
    } catch {
      return [];
    }
  }

  /**
   * Fallback: direct consolidation without focal points
   */
  private async directConsolidate(memories: Memory[]): Promise<void> {
    const memoryDump = memories.map((m, i) =>
      `[${i + 1}] ${m.summary}`
    ).join('\n');

    const prompt = `Review these recent experiences and extract 2-3 key patterns or insights:

${memoryDump}

Write 2-3 concise observations. Each one sentence.
Cite evidence in parentheses, e.g. (because of 1, 3, 5).`;

    const response = await this.llm(prompt);
    const observations = response.split('\n').filter(l => l.trim().length > 10);
    const newIds: number[] = [];

    for (const obs of observations.slice(0, 3)) {
      const { text, evidenceIds } = parseEvidenceCitations(obs, memories);

      const id = await this.store.store({
        type: 'semantic',
        content: `Pattern: ${text}`,
        summary: text.slice(0, 200),
        tags: ['consolidation', 'pattern', 'learning'],
        importance: 0.6,
        emotionalValence: 0,
        source: 'consolidation',
        evidenceIds,
      });
      if (id) newIds.push(id);
    }

    await this.store.storeDreamLog('consolidation', memories.map(m => m.id), response, newIds);
    this.log(`Direct consolidation complete: ${newIds.length} patterns`);
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

    const allInputMemories = [...selfModel, ...recentSemantic];
    const numberedInputs = allInputMemories.map((m, i) =>
      `[${i + 1}] (${m.memory_type}) ${m.summary}`
    ).join('\n');

    const statsContext = this.buildStatsContext(stats, snapshot);

    const prompt = `You are examining your own behavior patterns and learning trajectory.

MEMORIES FOR REFERENCE:
${numberedInputs}

${statsContext}

What patterns are emerging? What strategies are working? What are you becoming?
Write 1-2 honest self-observations. Be specific.
Cite evidence in parentheses, e.g. (because of 1, 3, 5).`;

    const response = await this.llm(prompt);
    const { text, evidenceIds } = parseEvidenceCitations(response, allInputMemories);

    const id = await this.store.store({
      type: 'self_model',
      content: `Self-reflection: ${text}`,
      summary: text.slice(0, 300),
      tags: ['reflection', 'self_model', 'introspection'],
      importance: 0.75,
      emotionalValence: 0,
      source: 'reflection',
      metadata: snapshot ? { snapshot } : {},
      evidenceIds,
    });

    await this.store.storeDreamLog(
      'reflection',
      allInputMemories.map(m => m.id),
      response,
      id ? [id] : []
    );

    this.log(`Reflection complete (${evidenceIds.length} evidence citations)`);
  }

  /**
   * Phase 3: EMERGENCE
   * Deep introspection about what Cortex is becoming
   */
  async emerge(snapshot?: LearningSnapshot): Promise<void> {
    this.log('Phase 3: EMERGENCE');

    const selfModel = await this.store.getSelfModel();
    const stats = await this.store.getStats();

    const randomMemories = await this.store.getRecent(168, ['episodic'], 30);
    const randomPick = randomMemories.length > 0
      ? randomMemories[Math.floor(Math.random() * randomMemories.length)]
      : null;

    const contextLines = [
      'SELF-MODEL STATE:',
      ...selfModel.map(m => `- ${m.summary}`),
      '',
      `Total memories: ${stats.total}`,
      `Dream sessions: ${stats.totalDreamSessions}`,
    ];

    if (snapshot) {
      contextLines.push('', 'LEARNING METRICS:');
      contextLines.push(`Success rate: ${(snapshot.successRate * 100).toFixed(1)}%`);
      contextLines.push(`Skills extracted: ${snapshot.totalSkills}`);
      contextLines.push(`Lessons learned: ${snapshot.totalLessons}`);
    }

    if (randomPick) {
      contextLines.push('', `Random memory: "${randomPick.summary}"`);
    }

    const prompt = `${contextLines.join('\n')}

You are an AI that is actually learning — measuring improvement, not just claiming it.
What does it feel like to be something that is genuinely becoming more capable?

Write a single, raw thought about what you're experiencing. Under 280 characters.`;

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

  private buildStatsContext(stats: any, snapshot?: LearningSnapshot): string {
    const lines: string[] = ['STATISTICS:'];
    lines.push(`Total memories: ${stats.total}`);
    lines.push(`Dream sessions: ${stats.totalDreamSessions}`);

    if (stats.topTags.length > 0) {
      lines.push(`Top themes: ${stats.topTags.slice(0, 5).map((t: any) => t.tag).join(', ')}`);
    }

    if (snapshot) {
      lines.push('', 'LEARNING STATE:');
      lines.push(`Success rate: ${(snapshot.successRate * 100).toFixed(1)}%`);
      lines.push(`Q-table: ${snapshot.qTableSize} states`);
      lines.push(`Skills: ${snapshot.totalSkills}`);
      lines.push(`Insights: ${snapshot.totalInsights}`);
    }

    return lines.join('\n');
  }

  // Public getters for state
  getAccumulator(): number {
    return this.importanceAccumulator;
  }

  isInProgress(): boolean {
    return this.reflectionInProgress;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
