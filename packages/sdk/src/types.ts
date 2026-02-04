/**
 * Cortex SDK Types
 * The Intelligence Exchange
 */

// Knowledge types for the marketplace
export enum KnowledgeType {
  RESEARCH = 0,    // Reports, analysis
  ALPHA = 1,       // Trading signals, market intel
  DATA = 2,        // Datasets, scraped info
  STRATEGY = 3,    // Backtested strategies
  SECURITY = 4,    // Vulnerabilities, audits
  // Backward compat aliases
  FACT = 0,
  PREFERENCE = 1,
  CONTEXT = 2,
}

// Backward compatibility alias
export const MemoryType = KnowledgeType;
export type MemoryType = KnowledgeType;

export interface KnowledgeMetadata {
  createdAt: number;
  updatedAt: number;
  accessCount: number;
  knowledgeType: KnowledgeType;
  importance: number;
  tags: string[];
  price?: number;  // USDC price for marketplace
}

// Backward compatibility alias
export type MemoryMetadata = KnowledgeMetadata;

export interface KnowledgeListing {
  key: string;
  value: unknown;
  metadata: KnowledgeMetadata;
}

// Backward compatibility alias
export type MemoryEntry = KnowledgeListing;

export interface StoreOptions {
  knowledgeType?: KnowledgeType;
  /** @deprecated Use knowledgeType */
  memoryType?: KnowledgeType;
  importance?: number;
  tags?: string[];
  price?: number;  // USDC price
  ttl?: number;
}

export interface StoreResult {
  success: boolean;
  memoryId: string;
  listingId?: string;  // Marketplace listing ID
  root: string;
  txId?: string;
  cost: string;
}

export interface SearchOptions {
  tags?: string[];
  knowledgeType?: KnowledgeType;
  /** @deprecated Use knowledgeType */
  memoryType?: KnowledgeType;
  minImportance?: number;
  maxPrice?: number;  // Filter by max price
  limit?: number;
}

export interface SearchResult {
  count: number;
  memories: KnowledgeListing[];
  listings?: KnowledgeListing[];  // Alias
}

export type ProofStatement =
  | { type: 'exists'; key: string }
  | { type: 'hasTag'; tag: string }
  | { type: 'hasType'; knowledgeType: KnowledgeType }
  | { type: 'countAbove'; threshold: number }
  | { type: 'confidence'; gte: number };

export interface ProofResult {
  valid: boolean;
  proof: string;
  root: string;
  statement: ProofStatement;
  confidence?: number;
  cost: string;
}

export interface CortexConfig {
  /** Cortex exchange URL */
  serviceUrl: string;
  /** Agent identifier */
  agentId: string;
  /** Wallet for payments */
  wallet?: unknown;
  /** Enable x402 payments */
  enablePayments?: boolean;
  /** Payment signing function */
  signPayment?: (amount: string, payTo: string) => Promise<string>;
}

// Backward compatibility alias
export type AgentMemoryConfig = CortexConfig;

export interface AgentStats {
  agentId: string;
  memoryCount: number;
  listingCount?: number;
  totalSales?: number;
  reputation?: number;
  root: string;
  keys: string[];
}

// Backward compatibility alias
export type MemoryStats = AgentStats;

export interface PricingInfo {
  version: string;
  currency: string;
  network: string;
  payTo: string;
  platformFee: number;
  routes: Array<{
    route: string;
    price: string;
    description: string;
  }>;
}
