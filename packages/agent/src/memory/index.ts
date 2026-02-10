/**
 * Cortex Memory System
 * 
 * Persistent, intelligent memory for self-learning agents:
 * - 4 memory types: episodic, semantic, procedural, self_model
 * - Generative Agents-style recall (recency × importance × relevance)
 * - Evidence-linked reflections (Park et al. 2023)
 * - Memory decay for forgetting
 * - Event-driven reflection triggers
 * - Dream cycle integration
 */

export * from './types.js';
export * from './constants.js';
export * from './database.js';
export * from './cortex-integration.js';
