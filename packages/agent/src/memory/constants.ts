/**
 * Memory System Constants
 * 
 * Based on Park et al. 2023 (Generative Agents) paper.
 */

// Memory storage limits
export const MEMORY_MAX_CONTENT_LENGTH = 5000;
export const MEMORY_MAX_SUMMARY_LENGTH = 500;

// Memory decay (forgetting)
export const MEMORY_DECAY_RATE = 0.95;    // 5% decay per cycle
export const MEMORY_MIN_DECAY = 0.05;     // Floor — memories never fully forgotten

// Retrieval scoring weights (Park et al. 2023, Generative Agents)
// Additive formula: score = w_recency * recency + w_relevance * relevance + w_importance * importance
export const RECENCY_DECAY_BASE = 0.995;           // Exponential: 0.995^hours since last access
export const RETRIEVAL_WEIGHT_RECENCY = 0.5;        // Paper: recency has lowest weight
export const RETRIEVAL_WEIGHT_RELEVANCE = 3.0;      // Paper: relevance dominates
export const RETRIEVAL_WEIGHT_IMPORTANCE = 2.0;     // Paper: importance is second

// Event-driven reflection triggers
export const REFLECTION_IMPORTANCE_THRESHOLD = 10;       // Cumulative importance to trigger reflection
export const REFLECTION_MIN_INTERVAL_MS = 30 * 60 * 1000; // Min 30 min between reflections

// Helpers
export function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

export function timeAgo(dateStr: string): string {
  const ms = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(ms / (1000 * 60 * 60));
  if (hours < 1) return 'just now';
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}
