/**
 * Cortex Memory Integration
 * 
 * Bridges Cortex's learning modules with persistent memory:
 * - Experiences → Episodic memories
 * - Q-table patterns → Semantic memories
 * - Reflexion lessons → Semantic memories
 * - Synthesized skills → Procedural memories
 * - Contrastive insights → Semantic memories
 */

import type { MemoryStore } from './database.js';
import type { LearningSnapshot } from './types.js';

export interface CortexMemoryIntegration {
  store: MemoryStore;
  
  // Store learning artifacts
  storeExperience(exp: ExperienceRecord): Promise<void>;
  storeLesson(lesson: string, source: string): Promise<void>;
  storeSkill(skill: SkillRecord): Promise<void>;
  storeInsight(insight: string): Promise<void>;
  storeStrategyUpdate(strategy: StrategyRecord): Promise<void>;
  
  // Recall for learning
  recallRelevantExperiences(state: string, limit?: number): Promise<ExperienceRecord[]>;
  recallSkillsForTask(taskType: string): Promise<SkillRecord[]>;
  recallLessons(tags?: string[]): Promise<string[]>;
  
  // Snapshot for dream cycle
  createSnapshot(metrics: CortexMetrics): LearningSnapshot;
}

export interface ExperienceRecord {
  state: string;
  action: string;
  reward: number;
  nextState: string;
  success: boolean;
  toolUsed?: string;
}

export interface SkillRecord {
  name: string;
  description: string;
  steps: string[];
  parameters: string[];
  successRate: number;
  usageCount: number;
}

export interface StrategyRecord {
  name: string;
  successRate: number;
  heuristics: string[];
  updatedAt: string;
}

export interface CortexMetrics {
  iteration: number;
  totalActions: number;
  successfulActions: number;
  qTableSize: number;
  epsilon: number;
  totalLessons: number;
  totalSkills: number;
  totalInsights: number;
  strategies: { name: string; successRate: number }[];
}

export function createCortexMemoryIntegration(store: MemoryStore): CortexMemoryIntegration {
  return {
    store,

    async storeExperience(exp: ExperienceRecord): Promise<void> {
      const summary = exp.success
        ? `Successful ${exp.action} in ${exp.state} (reward: ${exp.reward.toFixed(2)})`
        : `Failed ${exp.action} in ${exp.state} (reward: ${exp.reward.toFixed(2)})`;

      await store.store({
        type: 'episodic',
        content: JSON.stringify(exp),
        summary,
        tags: [
          'experience',
          exp.success ? 'success' : 'failure',
          exp.toolUsed || 'action',
        ],
        importance: calculateExperienceImportance(exp),
        emotionalValence: exp.reward > 0 ? 0.3 : exp.reward < 0 ? -0.3 : 0,
        source: 'experience-replay',
        metadata: {
          state: exp.state,
          action: exp.action,
          reward: exp.reward,
          nextState: exp.nextState,
        },
      });
    },

    async storeLesson(lesson: string, source: string): Promise<void> {
      await store.store({
        type: 'semantic',
        content: `Lesson learned: ${lesson}`,
        summary: lesson.slice(0, 200),
        tags: ['lesson', 'reflexion', source],
        importance: 0.7,
        emotionalValence: 0,
        source: 'reflexion',
      });
    },

    async storeSkill(skill: SkillRecord): Promise<void> {
      await store.store({
        type: 'procedural',
        content: JSON.stringify(skill),
        summary: `Skill: ${skill.name} — ${skill.description.slice(0, 100)}`,
        tags: ['skill', 'synthesized', ...skill.parameters.slice(0, 2)],
        importance: 0.6 + skill.successRate * 0.3,
        emotionalValence: 0,
        source: 'skill-synthesis',
        metadata: {
          steps: skill.steps,
          successRate: skill.successRate,
          usageCount: skill.usageCount,
        },
      });
    },

    async storeInsight(insight: string): Promise<void> {
      await store.store({
        type: 'semantic',
        content: `Contrastive insight: ${insight}`,
        summary: insight.slice(0, 200),
        tags: ['insight', 'contrastive', 'pattern'],
        importance: 0.65,
        emotionalValence: 0,
        source: 'contrastive-learning',
      });
    },

    async storeStrategyUpdate(strategy: StrategyRecord): Promise<void> {
      await store.store({
        type: 'semantic',
        content: JSON.stringify(strategy),
        summary: `Strategy ${strategy.name} at ${(strategy.successRate * 100).toFixed(0)}%: ${strategy.heuristics[0] || 'no heuristics'}`,
        tags: ['strategy', 'evolution', strategy.name],
        importance: 0.5 + strategy.successRate * 0.4,
        emotionalValence: strategy.successRate > 0.7 ? 0.2 : -0.1,
        source: 'strategy-evolution',
        metadata: strategy,
      });
    },

    async recallRelevantExperiences(state: string, limit = 5): Promise<ExperienceRecord[]> {
      const memories = await store.recall({
        query: state,
        memoryTypes: ['episodic'],
        tags: ['experience'],
        limit,
      });

      return memories
        .filter(m => m.metadata?.state)
        .map(m => ({
          state: m.metadata.state as string,
          action: m.metadata.action as string,
          reward: m.metadata.reward as number,
          nextState: m.metadata.nextState as string,
          success: (m.metadata.reward as number) > 0,
        }));
    },

    async recallSkillsForTask(taskType: string): Promise<SkillRecord[]> {
      const memories = await store.recall({
        query: taskType,
        memoryTypes: ['procedural'],
        tags: ['skill'],
        limit: 5,
      });

      return memories
        .filter(m => m.content.startsWith('{'))
        .map(m => {
          try {
            return JSON.parse(m.content) as SkillRecord;
          } catch {
            return null;
          }
        })
        .filter((s): s is SkillRecord => s !== null);
    },

    async recallLessons(tags?: string[]): Promise<string[]> {
      const memories = await store.recall({
        memoryTypes: ['semantic'],
        tags: tags ? ['lesson', ...tags] : ['lesson'],
        limit: 10,
      });

      return memories.map(m => m.summary);
    },

    createSnapshot(metrics: CortexMetrics): LearningSnapshot {
      return {
        iteration: metrics.iteration,
        successRate: metrics.totalActions > 0 
          ? metrics.successfulActions / metrics.totalActions 
          : 0,
        qTableSize: metrics.qTableSize,
        epsilon: metrics.epsilon,
        totalLessons: metrics.totalLessons,
        totalSkills: metrics.totalSkills,
        totalInsights: metrics.totalInsights,
        strategies: metrics.strategies,
        timestamp: new Date().toISOString(),
      };
    },
  };
}

// Calculate importance based on experience characteristics
function calculateExperienceImportance(exp: ExperienceRecord): number {
  let importance = 0.4; // Base

  // High magnitude rewards are more memorable
  const rewardMag = Math.abs(exp.reward);
  if (rewardMag > 0.8) importance += 0.25;
  else if (rewardMag > 0.5) importance += 0.15;
  else if (rewardMag > 0.2) importance += 0.05;

  // Failures are often more instructive
  if (!exp.success) importance += 0.1;

  // Certain actions are more significant
  if (exp.action.includes('search')) importance += 0.05;
  if (exp.action.includes('analyze')) importance += 0.05;

  return Math.min(importance, 1.0);
}
