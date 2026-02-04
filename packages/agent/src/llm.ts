/**
 * LLM Integration for Cortex
 * Uses Anthropic Claude for reflection, gradients, and skill synthesis
 */

export interface LLMConfig {
  apiKey: string;
  model?: string;
  maxTokens?: number;
}

export class ClaudeLLM {
  private apiKey: string;
  private model: string;
  private maxTokens: number;
  private baseUrl = 'https://api.anthropic.com/v1/messages';

  constructor(config: LLMConfig) {
    this.apiKey = config.apiKey;
    this.model = config.model || 'claude-sonnet-4-20250514';
    this.maxTokens = config.maxTokens || 1024;
  }

  /**
   * Call Claude API
   */
  async call(prompt: string): Promise<string> {
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: this.maxTokens,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Claude API error: ${response.status} - ${error}`);
    }

    const data = await response.json() as any;
    
    // Extract text from response
    const content = data.content?.[0];
    if (content?.type === 'text') {
      return content.text;
    }

    throw new Error('Unexpected response format from Claude');
  }

  /**
   * Call with retry logic
   */
  async callWithRetry(prompt: string, retries: number = 3): Promise<string> {
    let lastError: Error | null = null;

    for (let i = 0; i < retries; i++) {
      try {
        return await this.call(prompt);
      } catch (error) {
        lastError = error as Error;
        
        // Don't retry on auth errors
        if (lastError.message.includes('401') || lastError.message.includes('403')) {
          throw lastError;
        }

        // Exponential backoff
        if (i < retries - 1) {
          await this.sleep(Math.pow(2, i) * 1000);
        }
      }
    }

    throw lastError || new Error('Failed after retries');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Create a configured Claude LLM instance
 */
export function createClaudeLLM(apiKey: string, model?: string): (prompt: string) => Promise<string> {
  const llm = new ClaudeLLM({ apiKey, model });
  return (prompt: string) => llm.callWithRetry(prompt);
}

/**
 * Create LLM from environment variable
 */
export function createLLMFromEnv(): (prompt: string) => Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY environment variable not set');
  }
  return createClaudeLLM(apiKey);
}
