/**
 * Memory Store
 * 
 * MVP: In-memory store with simulated compression
 * Next: Light Protocol integration for real ZK compression
 */

import { createHash } from 'crypto';
import {
  MemoryEntry,
  MemoryType,
  StoreRequest,
  SearchQuery,
  ProofStatement,
} from './types.js';

export class MemoryStore {
  // agentId -> key -> MemoryEntry
  private memories: Map<string, Map<string, MemoryEntry>> = new Map();
  
  // Simulated Merkle root (will be real with Light Protocol)
  private roots: Map<string, string> = new Map();

  /**
   * Store a memory entry
   */
  async store(request: StoreRequest): Promise<{ memoryId: string; root: string }> {
    const {
      agentId,
      key,
      value,
      memoryType = MemoryType.FACT,
      importance = 50,
      tags = [],
      ttl = null,
    } = request;

    // Get or create agent's memory map
    if (!this.memories.has(agentId)) {
      this.memories.set(agentId, new Map());
    }
    const agentMemories = this.memories.get(agentId)!;

    // Create content hash
    const contentHash = this.hashContent(value);

    // Check if updating existing or creating new
    const existing = agentMemories.get(key);
    const now = Date.now();

    const entry: MemoryEntry = {
      key,
      agentId,
      value,
      contentHash,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      accessCount: existing?.accessCount ?? 0,
      ttl,
      memoryType,
      importance,
      tags,
    };

    // Store the entry
    agentMemories.set(key, entry);

    // Update simulated root
    const newRoot = this.computeRoot(agentId);
    this.roots.set(agentId, newRoot);

    // Memory ID is agentId:key hash
    const memoryId = this.hashContent(`${agentId}:${key}`).slice(0, 16);

    return { memoryId, root: newRoot };
  }

  /**
   * Recall a memory entry
   */
  async recall(agentId: string, key: string): Promise<MemoryEntry | null> {
    const agentMemories = this.memories.get(agentId);
    if (!agentMemories) return null;

    const entry = agentMemories.get(key);
    if (!entry) return null;

    // Check TTL
    if (entry.ttl && Date.now() > entry.createdAt + entry.ttl) {
      agentMemories.delete(key);
      return null;
    }

    // Increment access count
    entry.accessCount++;
    entry.updatedAt = Date.now();

    return entry;
  }

  /**
   * Search memories
   */
  async search(agentId: string, query: SearchQuery): Promise<MemoryEntry[]> {
    const agentMemories = this.memories.get(agentId);
    if (!agentMemories) return [];

    let results = Array.from(agentMemories.values());

    // Filter by tags
    if (query.tags && query.tags.length > 0) {
      results = results.filter((entry) =>
        query.tags!.some((tag) => entry.tags.includes(tag))
      );
    }

    // Filter by memory type
    if (query.memoryType !== undefined) {
      results = results.filter((entry) => entry.memoryType === query.memoryType);
    }

    // Filter by importance
    if (query.minImportance !== undefined) {
      results = results.filter((entry) => entry.importance >= query.minImportance!);
    }

    // Sort by importance (descending) then by updatedAt (descending)
    results.sort((a, b) => {
      if (b.importance !== a.importance) return b.importance - a.importance;
      return b.updatedAt - a.updatedAt;
    });

    // Apply limit
    if (query.limit) {
      results = results.slice(0, query.limit);
    }

    return results;
  }

  /**
   * Delete a memory
   */
  async forget(agentId: string, key: string): Promise<boolean> {
    const agentMemories = this.memories.get(agentId);
    if (!agentMemories) return false;

    const deleted = agentMemories.delete(key);
    if (deleted) {
      const newRoot = this.computeRoot(agentId);
      this.roots.set(agentId, newRoot);
    }

    return deleted;
  }

  /**
   * Generate a proof about memory state
   * MVP: Simple boolean proof
   * Next: Real ZK proofs with Light Protocol
   */
  async prove(agentId: string, statement: ProofStatement): Promise<{ valid: boolean; proof: string }> {
    const agentMemories = this.memories.get(agentId);
    
    let valid = false;

    switch (statement.type) {
      case 'exists':
        valid = agentMemories?.has(statement.key) ?? false;
        break;

      case 'hasTag':
        valid = Array.from(agentMemories?.values() ?? []).some((entry) =>
          entry.tags.includes(statement.tag)
        );
        break;

      case 'hasType':
        valid = Array.from(agentMemories?.values() ?? []).some(
          (entry) => entry.memoryType === statement.memoryType
        );
        break;

      case 'countAbove':
        valid = (agentMemories?.size ?? 0) > statement.threshold;
        break;
    }

    // Generate simulated proof (will be real SNARK with Light Protocol)
    const proofData = {
      agentId,
      statement,
      valid,
      timestamp: Date.now(),
      root: this.roots.get(agentId) ?? 'empty',
    };
    const proof = Buffer.from(JSON.stringify(proofData)).toString('base64');

    return { valid, proof };
  }

  /**
   * Get current root for an agent
   */
  getRoot(agentId: string): string {
    return this.roots.get(agentId) ?? this.hashContent('empty');
  }

  /**
   * Get memory count for an agent
   */
  getCount(agentId: string): number {
    return this.memories.get(agentId)?.size ?? 0;
  }

  /**
   * List all memory keys for an agent
   */
  listKeys(agentId: string): string[] {
    const agentMemories = this.memories.get(agentId);
    if (!agentMemories) return [];
    return Array.from(agentMemories.keys());
  }

  // --- Private helpers ---

  private hashContent(content: unknown): string {
    const data = typeof content === 'string' ? content : JSON.stringify(content);
    return createHash('sha256').update(data).digest('hex');
  }

  private computeRoot(agentId: string): string {
    const agentMemories = this.memories.get(agentId);
    if (!agentMemories || agentMemories.size === 0) {
      return this.hashContent('empty');
    }

    // Simulated Merkle root: hash of all content hashes
    const hashes = Array.from(agentMemories.values())
      .map((e) => e.contentHash)
      .sort()
      .join('');
    
    return this.hashContent(hashes);
  }
}

// Singleton instance
export const memoryStore = new MemoryStore();
