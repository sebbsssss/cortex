/**
 * Cortex SDK
 * The Intelligence Exchange
 * 
 * Client library for the agent knowledge marketplace
 */

export { AgentMemory, AgentMemory as Cortex, createPaidClient } from './client.js';
export {
  // New Cortex types
  KnowledgeType,
  KnowledgeListing,
  KnowledgeMetadata,
  CortexConfig,
  AgentStats,
  
  // Backward compatibility aliases
  MemoryType,
  MemoryEntry,
  MemoryMetadata,
  AgentMemoryConfig,
  MemoryStats,
  
  // Shared types
  StoreOptions,
  StoreResult,
  SearchOptions,
  SearchResult,
  ProofStatement,
  ProofResult,
  PricingInfo,
} from './types.js';
