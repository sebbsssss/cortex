/**
 * Agent Streaming API
 * Runs Cortex agent and streams events via Server-Sent Events (SSE)
 */

import { CortexAgent } from '@cortex/agent';
import { createClaudeLLM } from '@cortex/agent';
import { Response } from 'express';

interface AgentEvent {
  type: 'start' | 'perceive' | 'reason' | 'act' | 'reflect' | 'learn' | 'milestone' | 'metrics' | 'complete' | 'error';
  data: any;
  timestamp: number;
}

// Store active streams
const activeStreams: Map<string, Response> = new Map();

/**
 * Create and run a Cortex agent, streaming events to client
 */
export async function runAgentWithStream(
  res: Response,
  config: {
    apiKey: string;
    iterations?: number;
    goal?: string;
  }
) {
  const streamId = `stream_${Date.now()}`;
  activeStreams.set(streamId, res);

  // Set up SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');

  const sendEvent = (event: AgentEvent) => {
    if (res.writableEnded) return;
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  try {
    // Create Claude LLM
    const llm = createClaudeLLM(config.apiKey, 'claude-sonnet-4-20250514');

    sendEvent({
      type: 'start',
      data: { message: 'Initializing Cortex agent...', model: 'claude-sonnet-4-20250514' },
      timestamp: Date.now(),
    });

    // Create agent
    const cortex = new CortexAgent({
      name: 'Cortex-Live',
      goals: [
        {
          id: 'live-goal',
          description: config.goal || 'Research and analyze cryptocurrency market trends',
          priority: 8,
          status: 'active',
        },
      ],
      llmCall: llm,
      learning: {
        experienceBufferSize: 500,
        alpha: 0.15,
        gamma: 0.95,
        epsilon: 0.3,
        reflexionThreshold: 0.5,
        gradientThreshold: 0.4,
        skillConfidence: 0.7,
      },
      tools: ['search', 'prices', 'news'],
    });

    // Register mock tools (in production, connect to real APIs)
    cortex.registerTool('search', async (params) => {
      await sleep(300);
      if (Math.random() > 0.2) {
        return { results: [{ title: 'Market Analysis', url: 'https://...' }], query: params.query };
      }
      throw new Error('Search rate limited');
    });

    cortex.registerTool('prices', async () => {
      await sleep(200);
      return {
        prices: [
          { coin: 'solana', price: 140 + Math.random() * 10, change24h: (Math.random() - 0.5) * 10 },
          { coin: 'bitcoin', price: 97000 + Math.random() * 1000, change24h: (Math.random() - 0.5) * 5 },
        ],
      };
    });

    cortex.registerTool('news', async (params) => {
      await sleep(250);
      if (Math.random() > 0.25) {
        return { articles: [{ title: 'Crypto Update', pubDate: 'now' }], topic: params.topic };
      }
      throw new Error('News unavailable');
    });

    // Set up event handlers
    cortex.setLogHandler((message, level) => {
      // Map log levels to event types
      const typeMap: Record<string, AgentEvent['type']> = {
        perceive: 'perceive',
        reason: 'reason',
        success: 'act',
        error: 'act',
        learn: 'learn',
        milestone: 'milestone',
      };

      sendEvent({
        type: typeMap[level] || 'act',
        data: { message, level },
        timestamp: Date.now(),
      });
    });

    cortex.setMilestoneHandler(async (milestone) => {
      sendEvent({
        type: 'milestone',
        data: milestone,
        timestamp: Date.now(),
      });
    });

    // Run agent
    const iterations = config.iterations || 10;
    sendEvent({
      type: 'start',
      data: { message: `Running ${iterations} iterations...`, iterations },
      timestamp: Date.now(),
    });

    await cortex.run(iterations);

    // Send final metrics
    const metrics = cortex.getMetrics();
    const strategies = cortex.getStrategies();
    const skills = cortex.getSkills();

    sendEvent({
      type: 'metrics',
      data: { metrics, strategies, skills },
      timestamp: Date.now(),
    });

    sendEvent({
      type: 'complete',
      data: { 
        message: 'Agent completed',
        finalSuccessRate: (metrics.successfulActions / Math.max(metrics.totalActions, 1) * 100).toFixed(1),
      },
      timestamp: Date.now(),
    });

  } catch (error) {
    sendEvent({
      type: 'error',
      data: { message: (error as Error).message },
      timestamp: Date.now(),
    });
  } finally {
    activeStreams.delete(streamId);
    res.end();
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Stop all active streams
 */
export function stopAllStreams(): void {
  for (const [id, res] of activeStreams) {
    res.end();
    activeStreams.delete(id);
  }
}
