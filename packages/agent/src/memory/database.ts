/**
 * Database abstraction for Cortex Memory
 * 
 * Supports:
 * - Supabase (production)
 * - In-memory store (demo/testing)
 * 
 * Scoring based on Park et al. 2023 (Generative Agents):
 * score = (w_recency * recency + w_relevance * relevance + w_importance * importance) * decay_factor
 */

import type { Memory, StoreMemoryOptions, RecallOptions, MemoryStats } from './types.js';
import {
  clamp,
  MEMORY_DECAY_RATE,
  MEMORY_MIN_DECAY,
  MEMORY_MAX_CONTENT_LENGTH,
  MEMORY_MAX_SUMMARY_LENGTH,
  RECENCY_DECAY_BASE,
  RETRIEVAL_WEIGHT_RECENCY,
  RETRIEVAL_WEIGHT_RELEVANCE,
  RETRIEVAL_WEIGHT_IMPORTANCE,
} from './constants.js';

export interface MemoryStore {
  store(opts: StoreMemoryOptions): Promise<number | null>;
  recall(opts: RecallOptions): Promise<Memory[]>;
  getStats(): Promise<MemoryStats>;
  getRecent(hours: number, types?: string[], limit?: number): Promise<Memory[]>;
  getSelfModel(): Promise<Memory[]>;
  decay(): Promise<number>;
  storeDreamLog(type: string, inputIds: number[], output: string, newIds: number[]): Promise<void>;
}

// Event callback for reflection triggers
export type MemoryEventCallback = (event: { importance: number; memoryType: string }) => void;

// ============================================================
// SCORING FUNCTION (Park et al. 2023)
// ============================================================

/**
 * Additive scoring function from Generative Agents paper.
 * 
 * score = (w_recency * recency + w_relevance * relevance + w_importance * importance) * decay_factor
 * 
 * - Recency: exponential decay from last access (0.995^hours)
 * - Relevance: average of keyword overlap and tag overlap
 * - Importance: direct use of memory.importance
 * - Decay: multiplicative gate for forgotten memories
 */
export function scoreMemory(mem: Memory, opts: RecallOptions): number {
  const now = Date.now();

  // Recency: exponential decay from last access
  const hoursSinceAccess = (now - new Date(mem.last_accessed).getTime()) / (1000 * 60 * 60);
  const recency = Math.pow(RECENCY_DECAY_BASE, hoursSinceAccess);

  // Text similarity (keyword overlap)
  let textScore = 0.5;
  if (opts.query) {
    const queryWords = opts.query.toLowerCase().split(/\s+/);
    const summaryLower = mem.summary.toLowerCase();
    const matches = queryWords.filter(w => w.length > 2 && summaryLower.includes(w)).length;
    textScore = 0.3 + 0.7 * Math.min(matches / Math.max(queryWords.length, 1), 1);
  }

  // Tag overlap score
  let tagScore = 0.5;
  if (opts.tags && opts.tags.length > 0 && mem.tags) {
    const overlap = mem.tags.filter(t => opts.tags!.includes(t)).length;
    tagScore = 0.5 + 0.5 * (overlap / opts.tags.length);
  }

  // Relevance: average of text and tag similarity
  const relevance = (textScore + tagScore) / 2;

  // Additive formula with paper weights, gated by decay
  const rawScore =
    RETRIEVAL_WEIGHT_RECENCY * recency +
    RETRIEVAL_WEIGHT_RELEVANCE * relevance +
    RETRIEVAL_WEIGHT_IMPORTANCE * mem.importance;

  return rawScore * mem.decay_factor;
}

// ============================================================
// IN-MEMORY STORE (for demo/testing)
// ============================================================

export class InMemoryStore implements MemoryStore {
  private memories: Memory[] = [];
  private dreamLogs: { type: string; inputIds: number[]; output: string; newIds: number[]; createdAt: string }[] = [];
  private nextId = 1;
  private onMemoryStored?: MemoryEventCallback;

  constructor(onMemoryStored?: MemoryEventCallback) {
    this.onMemoryStored = onMemoryStored;
  }

  async store(opts: StoreMemoryOptions): Promise<number | null> {
    const id = this.nextId++;
    const now = new Date().toISOString();
    
    const memory: Memory = {
      id,
      memory_type: opts.type,
      content: opts.content.slice(0, MEMORY_MAX_CONTENT_LENGTH),
      summary: opts.summary.slice(0, MEMORY_MAX_SUMMARY_LENGTH),
      tags: opts.tags || [],
      emotional_valence: clamp(opts.emotionalValence ?? 0, -1, 1),
      importance: clamp(opts.importance ?? 0.5, 0, 1),
      access_count: 0,
      source: opts.source,
      source_id: opts.sourceId || null,
      related_context: opts.relatedContext || null,
      metadata: opts.metadata || {},
      created_at: now,
      last_accessed: now,
      decay_factor: 1.0,
      evidence_ids: opts.evidenceIds || [],
    };

    this.memories.push(memory);

    // Emit event for reflection trigger
    if (this.onMemoryStored) {
      this.onMemoryStored({
        importance: memory.importance,
        memoryType: memory.memory_type,
      });
    }

    return id;
  }

  async recall(opts: RecallOptions): Promise<Memory[]> {
    const limit = opts.limit || 5;
    const minDecay = opts.minDecay ?? 0.1;

    let candidates = this.memories.filter(m => m.decay_factor >= minDecay);

    if (opts.memoryTypes && opts.memoryTypes.length > 0) {
      candidates = candidates.filter(m => opts.memoryTypes!.includes(m.memory_type));
    }
    if (opts.minImportance) {
      candidates = candidates.filter(m => m.importance >= opts.minImportance!);
    }
    if (opts.tags && opts.tags.length > 0) {
      candidates = candidates.filter(m => 
        m.tags.some(t => opts.tags!.includes(t))
      );
    }

    // Score and rank using paper formula
    const scored = candidates.map(mem => ({
      ...mem,
      _score: scoreMemory(mem, opts),
    }));

    scored.sort((a, b) => b._score - a._score);
    const results = scored.slice(0, limit);

    // Update access
    for (const r of results) {
      const mem = this.memories.find(m => m.id === r.id);
      if (mem) {
        mem.access_count++;
        mem.last_accessed = new Date().toISOString();
        mem.decay_factor = 1.0; // Reinforce on access
      }
    }

    return results;
  }

  async getStats(): Promise<MemoryStats> {
    const stats: MemoryStats = {
      total: this.memories.length,
      byType: { episodic: 0, semantic: 0, procedural: 0, self_model: 0 },
      avgImportance: 0,
      avgDecay: 0,
      oldestMemory: null,
      newestMemory: null,
      totalDreamSessions: this.dreamLogs.length,
      topTags: [],
    };

    if (this.memories.length === 0) return stats;

    const tagCounts: Record<string, number> = {};
    let impSum = 0, decaySum = 0;

    for (const m of this.memories) {
      stats.byType[m.memory_type]++;
      impSum += m.importance;
      decaySum += m.decay_factor;
      for (const tag of m.tags) {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      }
    }

    stats.avgImportance = impSum / this.memories.length;
    stats.avgDecay = decaySum / this.memories.length;
    stats.topTags = Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([tag, count]) => ({ tag, count }));

    const sorted = this.memories.map(m => m.created_at).sort();
    stats.oldestMemory = sorted[0] || null;
    stats.newestMemory = sorted[sorted.length - 1] || null;

    return stats;
  }

  async getRecent(hours: number, types?: string[], limit?: number): Promise<Memory[]> {
    const since = Date.now() - hours * 60 * 60 * 1000;
    let results = this.memories.filter(m => 
      new Date(m.created_at).getTime() >= since
    );

    if (types && types.length > 0) {
      results = results.filter(m => types.includes(m.memory_type));
    }

    results.sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    return results.slice(0, limit || 50);
  }

  async getSelfModel(): Promise<Memory[]> {
    return this.memories
      .filter(m => m.memory_type === 'self_model' && m.decay_factor > 0.2)
      .sort((a, b) => b.importance - a.importance)
      .slice(0, 5);
  }

  async decay(): Promise<number> {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    let decayed = 0;

    for (const mem of this.memories) {
      if (new Date(mem.last_accessed).getTime() < cutoff && mem.decay_factor > MEMORY_MIN_DECAY) {
        mem.decay_factor = Math.max(mem.decay_factor * MEMORY_DECAY_RATE, MEMORY_MIN_DECAY);
        decayed++;
      }
    }

    return decayed;
  }

  async storeDreamLog(type: string, inputIds: number[], output: string, newIds: number[]): Promise<void> {
    this.dreamLogs.push({
      type,
      inputIds,
      output: output.slice(0, MEMORY_MAX_CONTENT_LENGTH),
      newIds,
      createdAt: new Date().toISOString(),
    });
  }

  // For debugging/testing
  getAllMemories(): Memory[] {
    return [...this.memories];
  }

  clear(): void {
    this.memories = [];
    this.dreamLogs = [];
    this.nextId = 1;
  }
}

// ============================================================
// SUPABASE STORE (for production)
// ============================================================

export class SupabaseStore implements MemoryStore {
  private client: any;
  private onMemoryStored?: MemoryEventCallback;

  constructor(url: string, key: string, onMemoryStored?: MemoryEventCallback) {
    this.onMemoryStored = onMemoryStored;
    
    import('@supabase/supabase-js').then(({ createClient }) => {
      this.client = createClient(url, key);
    }).catch(() => {
      console.warn('Supabase not available, falling back to in-memory');
    });
  }

  async store(opts: StoreMemoryOptions): Promise<number | null> {
    if (!this.client) return null;

    const { data, error } = await this.client
      .from('memories')
      .insert({
        memory_type: opts.type,
        content: opts.content.slice(0, MEMORY_MAX_CONTENT_LENGTH),
        summary: opts.summary.slice(0, MEMORY_MAX_SUMMARY_LENGTH),
        tags: opts.tags || [],
        emotional_valence: clamp(opts.emotionalValence ?? 0, -1, 1),
        importance: clamp(opts.importance ?? 0.5, 0, 1),
        source: opts.source,
        source_id: opts.sourceId || null,
        related_context: opts.relatedContext || null,
        metadata: opts.metadata || {},
        evidence_ids: opts.evidenceIds || [],
      })
      .select('id')
      .single();

    if (error) {
      console.error('Failed to store memory:', error.message);
      return null;
    }

    // Emit event for reflection trigger
    if (this.onMemoryStored) {
      this.onMemoryStored({
        importance: clamp(opts.importance ?? 0.5, 0, 1),
        memoryType: opts.type,
      });
    }

    return data.id;
  }

  async recall(opts: RecallOptions): Promise<Memory[]> {
    if (!this.client) return [];

    const limit = opts.limit || 5;
    const minDecay = opts.minDecay ?? 0.1;

    let query = this.client
      .from('memories')
      .select('*')
      .gte('decay_factor', minDecay)
      .order('importance', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit * 3);

    if (opts.memoryTypes && opts.memoryTypes.length > 0) {
      query = query.in('memory_type', opts.memoryTypes);
    }
    if (opts.minImportance) {
      query = query.gte('importance', opts.minImportance);
    }
    if (opts.tags && opts.tags.length > 0) {
      query = query.overlaps('tags', opts.tags);
    }

    const { data, error } = await query;
    if (error || !data) return [];

    // Score and rank using paper formula
    const scored = data.map((mem: Memory) => ({
      ...mem,
      _score: scoreMemory(mem, opts),
    }));

    scored.sort((a: any, b: any) => b._score - a._score);
    return scored.slice(0, limit);
  }

  async getStats(): Promise<MemoryStats> {
    const stats: MemoryStats = {
      total: 0,
      byType: { episodic: 0, semantic: 0, procedural: 0, self_model: 0 },
      avgImportance: 0,
      avgDecay: 0,
      oldestMemory: null,
      newestMemory: null,
      totalDreamSessions: 0,
      topTags: [],
    };

    if (!this.client) return stats;

    const { data } = await this.client
      .from('memories')
      .select('memory_type, importance, decay_factor, tags')
      .gt('decay_factor', MEMORY_MIN_DECAY);

    if (data && data.length > 0) {
      stats.total = data.length;
      const tagCounts: Record<string, number> = {};
      let impSum = 0, decaySum = 0;

      for (const m of data) {
        if (m.memory_type in stats.byType) {
          stats.byType[m.memory_type as keyof typeof stats.byType]++;
        }
        impSum += m.importance;
        decaySum += m.decay_factor;
        if (m.tags) {
          for (const tag of m.tags) {
            tagCounts[tag] = (tagCounts[tag] || 0) + 1;
          }
        }
      }

      stats.avgImportance = impSum / data.length;
      stats.avgDecay = decaySum / data.length;
      stats.topTags = Object.entries(tagCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([tag, count]) => ({ tag, count }));
    }

    const { count } = await this.client
      .from('dream_logs')
      .select('id', { count: 'exact', head: true });
    stats.totalDreamSessions = count || 0;

    return stats;
  }

  async getRecent(hours: number, types?: string[], limit?: number): Promise<Memory[]> {
    if (!this.client) return [];

    const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
    let query = this.client
      .from('memories')
      .select('*')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(limit || 50);

    if (types && types.length > 0) {
      query = query.in('memory_type', types);
    }

    const { data } = await query;
    return data || [];
  }

  async getSelfModel(): Promise<Memory[]> {
    if (!this.client) return [];

    const { data } = await this.client
      .from('memories')
      .select('*')
      .eq('memory_type', 'self_model')
      .gt('decay_factor', 0.2)
      .order('importance', { ascending: false })
      .limit(5);

    return data || [];
  }

  async decay(): Promise<number> {
    if (!this.client) return 0;

    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data } = await this.client
      .from('memories')
      .select('id, decay_factor')
      .lt('last_accessed', cutoff)
      .gt('decay_factor', MEMORY_MIN_DECAY);

    if (!data) return 0;

    let decayed = 0;
    for (const mem of data) {
      const newDecay = Math.max(mem.decay_factor * MEMORY_DECAY_RATE, MEMORY_MIN_DECAY);
      await this.client
        .from('memories')
        .update({ decay_factor: newDecay })
        .eq('id', mem.id);
      decayed++;
    }

    return decayed;
  }

  async storeDreamLog(type: string, inputIds: number[], output: string, newIds: number[]): Promise<void> {
    if (!this.client) return;

    await this.client
      .from('dream_logs')
      .insert({
        session_type: type,
        input_memory_ids: inputIds,
        output: output.slice(0, MEMORY_MAX_CONTENT_LENGTH),
        new_memories_created: newIds,
      });
  }
}

// ============================================================
// HELPERS
// ============================================================

// Format memories for injection into LLM context
export function formatMemoryContext(memories: Memory[]): string {
  if (memories.length === 0) return '';

  const lines: string[] = ['## Memory Recall'];

  const episodic = memories.filter(m => m.memory_type === 'episodic');
  const semantic = memories.filter(m => m.memory_type === 'semantic');
  const procedural = memories.filter(m => m.memory_type === 'procedural');
  const selfModel = memories.filter(m => m.memory_type === 'self_model');

  if (episodic.length > 0) {
    lines.push('### Past Experiences');
    for (const m of episodic) {
      lines.push(`- ${m.summary}`);
    }
  }

  if (semantic.length > 0) {
    lines.push('### Learned Patterns');
    for (const m of semantic) {
      lines.push(`- ${m.summary}`);
    }
  }

  if (procedural.length > 0) {
    lines.push('### What Works');
    for (const m of procedural) {
      lines.push(`- ${m.summary}`);
    }
  }

  if (selfModel.length > 0) {
    lines.push('### Self-Observations');
    for (const m of selfModel) {
      lines.push(`- ${m.summary}`);
    }
  }

  return lines.join('\n');
}

/**
 * Parse evidence citations from LLM output like "(because of 1, 3, 5)"
 */
export function parseEvidenceCitations(
  text: string,
  sourceMemories: Memory[]
): { text: string; evidenceIds: number[] } {
  const citationRegex = /\((?:because of|based on|from|citing|evidence:?|ref:?)\s*([\d,\s]+)\)/i;
  const match = text.match(citationRegex);

  if (!match) {
    return { text: text.trim(), evidenceIds: [] };
  }

  const indices = match[1]
    .split(',')
    .map(s => parseInt(s.trim(), 10))
    .filter(n => !isNaN(n) && n >= 1 && n <= sourceMemories.length);

  const evidenceIds = indices.map(i => sourceMemories[i - 1].id);
  const cleanText = text.replace(citationRegex, '').trim();

  return { text: cleanText, evidenceIds };
}
