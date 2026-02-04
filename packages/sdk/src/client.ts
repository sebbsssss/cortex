/**
 * ZK Agent Memory Client
 */

import {
  AgentMemoryConfig,
  MemoryEntry,
  MemoryStats,
  MemoryType,
  PricingInfo,
  ProofResult,
  ProofStatement,
  SearchOptions,
  SearchResult,
  StoreOptions,
  StoreResult,
} from './types.js';

export class AgentMemory {
  private baseUrl: string;
  private agentId: string;
  private enablePayments: boolean;
  private signPayment?: (amount: string, payTo: string) => Promise<string>;

  constructor(config: AgentMemoryConfig) {
    this.baseUrl = config.serviceUrl.replace(/\/$/, '');
    this.agentId = config.agentId;
    this.enablePayments = config.enablePayments ?? false;
    this.signPayment = config.signPayment;
  }

  private async request<T>(
    path: string,
    options: RequestInit & { paymentAmount?: string } = {}
  ): Promise<T> {
    const { paymentAmount, ...fetchOptions } = options;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(fetchOptions.headers as Record<string, string>),
    };

    if (this.enablePayments && paymentAmount && this.signPayment) {
      const pricing = await this.pricing();
      headers['Payment-Signature'] = await this.signPayment(paymentAmount, pricing.payTo);
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      ...fetchOptions,
      headers,
    });

    if (response.status === 402) {
      const error = await response.json() as any;
      throw new Error(`Payment required: ${error['x-payment-required']?.description || 'Unknown'}`);
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' })) as any;
      throw new Error(error.error || response.statusText);
    }

    return response.json() as Promise<T>;
  }

  async store(key: string, value: unknown, options: StoreOptions = {}): Promise<StoreResult> {
    return this.request<StoreResult>('/memory/store', {
      method: 'POST',
      body: JSON.stringify({
        agentId: this.agentId,
        key,
        value,
        memoryType: options.memoryType ?? MemoryType.FACT,
        importance: options.importance ?? 50,
        tags: options.tags ?? [],
        ttl: options.ttl,
      }),
      paymentAmount: '0.005',
    });
  }

  async recall(key: string): Promise<MemoryEntry | null> {
    try {
      return await this.request<MemoryEntry>(
        `/memory/${this.agentId}/${encodeURIComponent(key)}`,
        { paymentAmount: '0.001' }
      );
    } catch (error) {
      if ((error as Error).message.includes('not found')) return null;
      throw error;
    }
  }

  async search(options: SearchOptions = {}): Promise<SearchResult> {
    const params = new URLSearchParams();
    if (options.tags?.length) params.set('tags', options.tags.join(','));
    if (options.memoryType !== undefined) params.set('type', options.memoryType.toString());
    if (options.minImportance !== undefined) params.set('minImportance', options.minImportance.toString());
    if (options.limit !== undefined) params.set('limit', options.limit.toString());

    const qs = params.toString();
    return this.request<SearchResult>(
      `/memory/${this.agentId}/search${qs ? `?${qs}` : ''}`,
      { paymentAmount: '0.003' }
    );
  }

  async prove(statement: ProofStatement): Promise<ProofResult> {
    return this.request<ProofResult>('/memory/prove', {
      method: 'POST',
      body: JSON.stringify({ agentId: this.agentId, statement }),
      paymentAmount: '0.002',
    });
  }

  async forget(key: string): Promise<boolean> {
    try {
      await this.request(
        `/memory/${this.agentId}/${encodeURIComponent(key)}`,
        { method: 'DELETE', paymentAmount: '0.002' }
      );
      return true;
    } catch (error) {
      if ((error as Error).message.includes('not found')) return false;
      throw error;
    }
  }

  async stats(): Promise<MemoryStats> {
    return this.request<MemoryStats>(`/memory/${this.agentId}/stats`);
  }

  async pricing(): Promise<PricingInfo> {
    return this.request<PricingInfo>('/pricing');
  }

  // Convenience methods
  async storeFact(key: string, value: unknown, importance = 50): Promise<StoreResult> {
    return this.store(key, value, { memoryType: MemoryType.FACT, importance });
  }

  async storePreference(key: string, value: unknown, importance = 70): Promise<StoreResult> {
    return this.store(key, value, { memoryType: MemoryType.PREFERENCE, importance, tags: ['preference'] });
  }

  async storeContext(key: string, value: unknown, ttlMs = 3600000): Promise<StoreResult> {
    return this.store(key, value, { memoryType: MemoryType.CONTEXT, importance: 30, ttl: ttlMs });
  }

  async exists(key: string): Promise<boolean> {
    return (await this.prove({ type: 'exists', key })).valid;
  }

  async all(limit = 100): Promise<MemoryEntry[]> {
    return (await this.search({ limit })).memories;
  }

  async important(minImportance = 70, limit = 20): Promise<MemoryEntry[]> {
    return (await this.search({ minImportance, limit })).memories;
  }

  async byTag(tag: string, limit = 50): Promise<MemoryEntry[]> {
    return (await this.search({ tags: [tag], limit })).memories;
  }
}
