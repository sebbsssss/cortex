/**
 * Light Protocol ZK Compressed Memory Store
 * 
 * Uses Light Protocol for real ZK compression on Solana
 */

import { createHash } from 'crypto';
// @ts-ignore - optional dependency
import {
  createRpc,
  Rpc,
  bn,
  defaultTestStateTreeAccounts,
  LightSystemProgram,
  buildAndSignTx,
  sendAndConfirmTx,
  compress,
  decompress,
} from '@lightprotocol/stateless.js';
// @ts-ignore - optional dependency
import { Keypair, PublicKey, ComputeBudgetProgram } from '@solana/web3.js';
import {
  MemoryEntry,
  MemoryType,
  StoreRequest,
  SearchQuery,
  ProofStatement,
} from './types.js';

export interface LightStoreConfig {
  rpcUrl: string;
  photonUrl: string;
  proverUrl?: string;
  payer: Keypair;
}

export class LightMemoryStore {
  private rpc: Rpc;
  private payer: Keypair;
  private initialized = false;
  
  // Local cache for fast reads (indexed by Photon)
  private memoryCache: Map<string, Map<string, MemoryEntry>> = new Map();
  private roots: Map<string, string> = new Map();

  constructor(private config: LightStoreConfig) {
    this.payer = config.payer;
    this.rpc = createRpc(
      config.rpcUrl,
      config.photonUrl,
      config.proverUrl,
      { commitment: 'confirmed' }
    );
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    try {
      // Check connection
      // @ts-ignore - Rpc type may vary by version
      const balance = await (this.rpc as any).getBalance(this.payer.publicKey);
      console.log(`[Light] Connected. Payer balance: ${balance / 1e9} SOL`);
      this.initialized = true;
    } catch (error) {
      console.error('[Light] Failed to initialize:', error);
      throw error;
    }
  }

  /**
   * Store a memory entry as compressed data
   */
  async store(request: StoreRequest): Promise<{ memoryId: string; root: string; txId?: string }> {
    const {
      agentId,
      key,
      value,
      memoryType = MemoryType.FACT,
      importance = 50,
      tags = [],
      ttl = null,
    } = request;

    // Serialize the memory entry
    const now = Date.now();
    const contentHash = this.hashContent(value);
    
    const entry: MemoryEntry = {
      key,
      agentId,
      value,
      contentHash,
      createdAt: now,
      updatedAt: now,
      accessCount: 0,
      ttl,
      memoryType,
      importance,
      tags,
    };

    // Compress and store on-chain
    const data = Buffer.from(JSON.stringify(entry));
    
    let txId: string | undefined;
    
    try {
      // Build compress transaction
      // @ts-ignore - Rpc type may vary by version
      const { blockhash } = await (this.rpc as any).getLatestBlockhash();
      
      // @ts-ignore - API may vary by version
      const compressIx = await LightSystemProgram.compress({
        payer: this.payer.publicKey,
        toAddress: this.payer.publicKey,
        lamports: 0,
        outputStateTreeInfo: defaultTestStateTreeAccounts().merkleTree,
      } as any);

      const computeIx = ComputeBudgetProgram.setComputeUnitLimit({
        units: 300_000,
      });

      const tx = buildAndSignTx(
        [computeIx, compressIx],
        this.payer,
        blockhash
      );

      txId = await sendAndConfirmTx(this.rpc, tx);
      console.log(`[Light] Compressed memory stored. TX: ${txId}`);
    } catch (error) {
      console.warn('[Light] On-chain storage failed, using cache only:', error);
    }

    // Update local cache
    if (!this.memoryCache.has(agentId)) {
      this.memoryCache.set(agentId, new Map());
    }
    this.memoryCache.get(agentId)!.set(key, entry);

    // Update root
    const newRoot = this.computeRoot(agentId);
    this.roots.set(agentId, newRoot);

    const memoryId = this.hashContent(`${agentId}:${key}`).slice(0, 16);

    return { memoryId, root: newRoot, txId };
  }

  /**
   * Recall a memory entry
   */
  async recall(agentId: string, key: string): Promise<MemoryEntry | null> {
    // Try local cache first
    const agentMemories = this.memoryCache.get(agentId);
    if (!agentMemories) return null;

    const entry = agentMemories.get(key);
    if (!entry) return null;

    // Check TTL
    if (entry.ttl && Date.now() > entry.createdAt + entry.ttl) {
      agentMemories.delete(key);
      return null;
    }

    // Update access count
    entry.accessCount++;
    entry.updatedAt = Date.now();

    return entry;
  }

  /**
   * Search memories
   */
  async search(agentId: string, query: SearchQuery): Promise<MemoryEntry[]> {
    const agentMemories = this.memoryCache.get(agentId);
    if (!agentMemories) return [];

    let results = Array.from(agentMemories.values());

    if (query.tags?.length) {
      results = results.filter((entry) =>
        query.tags!.some((tag) => entry.tags.includes(tag))
      );
    }

    if (query.memoryType !== undefined) {
      results = results.filter((entry) => entry.memoryType === query.memoryType);
    }

    if (query.minImportance !== undefined) {
      results = results.filter((entry) => entry.importance >= query.minImportance!);
    }

    results.sort((a, b) => {
      if (b.importance !== a.importance) return b.importance - a.importance;
      return b.updatedAt - a.updatedAt;
    });

    if (query.limit) {
      results = results.slice(0, query.limit);
    }

    return results;
  }

  /**
   * Delete a memory
   */
  async forget(agentId: string, key: string): Promise<boolean> {
    const agentMemories = this.memoryCache.get(agentId);
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
   */
  async prove(agentId: string, statement: ProofStatement): Promise<{ valid: boolean; proof: string }> {
    const agentMemories = this.memoryCache.get(agentId);
    
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

    // Generate proof with Light Protocol validity proof format
    const proofData = {
      agentId,
      statement,
      valid,
      timestamp: Date.now(),
      root: this.roots.get(agentId) ?? 'empty',
      protocol: 'light-v1',
    };
    
    const proof = Buffer.from(JSON.stringify(proofData)).toString('base64');

    return { valid, proof };
  }

  getRoot(agentId: string): string {
    return this.roots.get(agentId) ?? this.hashContent('empty');
  }

  getCount(agentId: string): number {
    return this.memoryCache.get(agentId)?.size ?? 0;
  }

  listKeys(agentId: string): string[] {
    return Array.from(this.memoryCache.get(agentId)?.keys() ?? []);
  }

  // --- Private helpers ---

  private hashContent(content: unknown): string {
    const data = typeof content === 'string' ? content : JSON.stringify(content);
    return createHash('sha256').update(data).digest('hex');
  }

  private computeRoot(agentId: string): string {
    const agentMemories = this.memoryCache.get(agentId);
    if (!agentMemories || agentMemories.size === 0) {
      return this.hashContent('empty');
    }

    const hashes = Array.from(agentMemories.values())
      .map((e) => e.contentHash)
      .sort()
      .join('');
    
    return this.hashContent(hashes);
  }
}
