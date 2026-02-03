/**
 * Memory Entry Types
 */

export enum MemoryType {
  FACT = 0,
  PREFERENCE = 1,
  CONTEXT = 2,
  SKILL = 3,
  EPISODIC = 4,
}

export interface MemoryEntry {
  // Identity
  key: string;
  agentId: string;

  // Content
  value: unknown;
  contentHash: string;

  // Metadata
  createdAt: number;
  updatedAt: number;
  accessCount: number;
  ttl: number | null;

  // Classification
  memoryType: MemoryType;
  importance: number;
  tags: string[];
}

export interface StoreRequest {
  agentId: string;
  key: string;
  value: unknown;
  memoryType?: MemoryType;
  importance?: number;
  tags?: string[];
  ttl?: number;
}

export interface StoreResponse {
  success: boolean;
  memoryId: string;
  root: string;
}

export interface RecallResponse {
  key: string;
  value: unknown;
  metadata: {
    createdAt: number;
    updatedAt: number;
    accessCount: number;
    memoryType: MemoryType;
    importance: number;
    tags: string[];
  };
}

export interface SearchQuery {
  tags?: string[];
  memoryType?: MemoryType;
  minImportance?: number;
  limit?: number;
}

export interface ProveRequest {
  agentId: string;
  statement: ProofStatement;
}

export type ProofStatement =
  | { type: 'exists'; key: string }
  | { type: 'hasTag'; tag: string }
  | { type: 'hasType'; memoryType: MemoryType }
  | { type: 'countAbove'; threshold: number };

export interface ProofResponse {
  valid: boolean;
  proof: string;
  statement: ProofStatement;
}
