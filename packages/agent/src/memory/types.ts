/**
 * Cortex Memory Types
 * 
 * Based on cognitive architectures:
 * - Stanford's Generative Agents (recency + importance + relevance)
 * - MemGPT/Letta (multi-tier self-managed memory)
 * - CoALA (episodic/semantic/procedural)
 */

export type MemoryType = 'episodic' | 'semantic' | 'procedural' | 'self_model';

export interface Memory {
  id: number;
  memory_type: MemoryType;
  content: string;
  summary: string;
  tags: string[];
  emotional_valence: number;  // -1 to 1
  importance: number;         // 0 to 1
  access_count: number;
  source: string;
  source_id: string | null;
  related_context: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  last_accessed: string;
  decay_factor: number;
}

export interface StoreMemoryOptions {
  type: MemoryType;
  content: string;
  summary: string;
  tags?: string[];
  emotionalValence?: number;
  importance?: number;
  source: string;
  sourceId?: string;
  relatedContext?: string;
  metadata?: Record<string, unknown>;
}

export interface RecallOptions {
  query?: string;
  tags?: string[];
  memoryTypes?: MemoryType[];
  limit?: number;
  minImportance?: number;
  minDecay?: number;
}

export interface MemoryStats {
  total: number;
  byType: Record<MemoryType, number>;
  avgImportance: number;
  avgDecay: number;
  oldestMemory: string | null;
  newestMemory: string | null;
  totalDreamSessions: number;
  topTags: { tag: string; count: number }[];
}

// Cortex-specific: Learning snapshot stored in memory
export interface LearningSnapshot {
  iteration: number;
  successRate: number;
  qTableSize: number;
  epsilon: number;
  totalLessons: number;
  totalSkills: number;
  totalInsights: number;
  strategies: { name: string; successRate: number }[];
  timestamp: string;
}
