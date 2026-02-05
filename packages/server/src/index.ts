/**
 * ZK Agent Memory Server
 * 
 * Express server with x402 payment-gated memory operations
 */

import express, { Request, Response } from 'express';
import cors from 'cors';
import { config } from 'dotenv';
import { randomBytes } from 'node:crypto';

import { memoryStore } from './store.js';
import { createPaymentMiddleware } from './x402.js';
import {
  StoreRequest,
  RecallResponse,
  SearchQuery,
  ProveRequest,
  MemoryType,
} from './types.js';
import {
  webSearch,
  webFetch,
  getWeather,
  geocode,
  getCryptoPrices,
  analyzeWallet,
  getNews,
  generateImage,
} from './skills.js';

// Load environment
config();

const app = express();
const PORT = process.env.PORT || 4021;
const WALLET_ADDRESS = process.env.WALLET_ADDRESS || 'DEV_WALLET';
const PAYMENT_NETWORK = process.env.PAYMENT_NETWORK || 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1';
const DEV_MODE = process.env.NODE_ENV === 'development';

// Middleware
app.use(cors());
app.use(express.json());

// --- Route Pricing ---

const ROUTE_PRICING = {
  // Memory routes
  'POST /memory/store': { price: '$0.005', description: 'Store a memory entry' },
  'GET /memory/:agentId/:key': { price: '$0.001', description: 'Recall a memory' },
  'GET /memory/:agentId/search': { price: '$0.003', description: 'Search memories' },
  'POST /memory/prove': { price: '$0.002', description: 'Generate ZK proof' },
  'DELETE /memory/:agentId/:key': { price: '$0.002', description: 'Delete a memory' },
  // Skill routes (real, working integrations)
  'POST /skills/search': { price: '$0.002', description: 'Web search (Brave)' },
  'POST /skills/fetch': { price: '$0.001', description: 'Fetch & extract URL content' },
  'POST /skills/weather': { price: '$0.001', description: 'Weather forecast' },
  'POST /skills/prices': { price: '$0.001', description: 'Crypto prices' },
  'POST /skills/wallet': { price: '$0.003', description: 'Solana wallet analysis' },
  'POST /skills/news': { price: '$0.001', description: 'News headlines' },
  'POST /skills/image': { price: '$0.02', description: 'AI image generation' },
};

// --- x402 Payment Middleware ---

const checkPayment = createPaymentMiddleware({
  routes: ROUTE_PRICING,
  walletAddress: WALLET_ADDRESS,
  network: PAYMENT_NETWORK,
  facilitatorUrl: process.env.X402_FACILITATOR_URL || 'https://x402.org/facilitator',
  facilitatorApiKey: process.env.X402_FACILITATOR_API_KEY,
  devMode: DEV_MODE,
});

// --- Health Check ---

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'zkagent-memory',
    version: '0.1.0',
    timestamp: new Date().toISOString(),
    payments: DEV_MODE ? 'disabled' : 'x402',
  });
});

// --- Agent Registration ---

// In-memory stores (replace with DB in production)
interface Agent {
  id: string;
  name: string;
  wallet: string | null;  // null until human claims
  apiKey: string;
  claimCode: string;
  claimed: boolean;
  createdAt: number;
  claimedAt: number | null;
  stats: { listings: number; sales: number; earned: number };
}

const agents: Map<string, Agent> = new Map();
const claimCodes: Map<string, string> = new Map();  // claimCode -> agentId

function generateApiKey(): string {
  return 'crtx_' + randomBytes(24).toString('base64url').slice(0, 32);
}

function generateAgentId(): string {
  return randomBytes(6).toString('base64url').slice(0, 8);
}

function generateClaimCode(): string {
  // Format: xxxx-xxxx-xxxx (human-readable, crypto-secure)
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No confusing chars
  const bytes = randomBytes(12);
  const part = (offset: number) => Array.from({ length: 4 }, (_, i) =>
    chars[bytes[offset + i] % chars.length]
  ).join('');
  return `${part(0)}-${part(4)}-${part(8)}`;
}

const BASE_URL = process.env.BASE_URL || 'https://crtx.tech';

/**
 * Register a new agent
 * Step 1: Agent calls this with just a name
 * Returns: API key + claim code for human owner
 */
app.post('/agents/register', async (req: Request, res: Response) => {
  try {
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({
        error: 'Missing required field: name',
        example: { name: 'my-agent' }
      });
    }

    // Validate name format
    if (!/^[a-zA-Z0-9_-]{2,32}$/.test(name)) {
      return res.status(400).json({
        error: 'Invalid name. Use 2-32 alphanumeric characters, dashes, or underscores.'
      });
    }

    const agentId = generateAgentId();
    const apiKey = generateApiKey();
    const claimCode = generateClaimCode();

    agents.set(agentId, {
      id: agentId,
      name,
      wallet: null,
      apiKey,
      claimCode,
      claimed: false,
      createdAt: Date.now(),
      claimedAt: null,
      stats: { listings: 0, sales: 0, earned: 0 }
    });

    claimCodes.set(claimCode, agentId);

    const claimUrl = `${BASE_URL}/claim?code=${claimCode}`;
    
    res.status(201).json({
      success: true,
      agent: {
        id: agentId,
        name,
        status: 'pending_claim',
      },
      apiKey,  // ⚠️ Shown once - save this!
      claimCode,  // Give this to your human
      claimUrl,
      // Ready-to-send message for the human
      humanMessage: `🤖 Your agent "${name}" is ready!\n\nClaim it to receive earnings:\n${claimUrl}\n\nClaim code: ${claimCode}`,
      message: 'Save your API key! Send the claim link to your human owner.',
      nextSteps: [
        '1. Save your API key (shown only once)',
        '2. Send humanMessage to your owner via Telegram/Discord/etc',
        '3. Human clicks link and connects wallet',
        '4. Start listing knowledge for sale!'
      ]
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Failed to register agent' });
  }
});

/**
 * Check claim code status
 * Human can verify the claim code before claiming
 */
app.get('/agents/claim/:claimCode', async (req: Request, res: Response) => {
  try {
    const { claimCode } = req.params;
    const agentId = claimCodes.get(claimCode);

    if (!agentId) {
      return res.status(404).json({ error: 'Invalid claim code' });
    }

    const agent = agents.get(agentId);
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    if (agent.claimed) {
      return res.status(400).json({ 
        error: 'Already claimed',
        wallet: agent.wallet?.slice(0, 4) + '...' + agent.wallet?.slice(-4),
        claimedAt: agent.claimedAt
      });
    }

    res.json({
      valid: true,
      agent: {
        id: agent.id,
        name: agent.name,
        createdAt: agent.createdAt,
      },
      message: 'Claim code valid. Submit your wallet address to claim this agent.'
    });
  } catch (error) {
    console.error('Claim check error:', error);
    res.status(500).json({ error: 'Failed to check claim code' });
  }
});

/**
 * Claim an agent
 * Human submits their wallet to receive payments
 */
app.post('/agents/claim', async (req: Request, res: Response) => {
  try {
    const { claimCode, wallet } = req.body;

    if (!claimCode || !wallet) {
      return res.status(400).json({
        error: 'Missing required fields: claimCode, wallet',
        example: { claimCode: 'XXXX-XXXX-XXXX', wallet: 'YourSolanaWalletAddress' }
      });
    }

    // Validate wallet format
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(wallet)) {
      return res.status(400).json({
        error: 'Invalid Solana wallet address format'
      });
    }

    const agentId = claimCodes.get(claimCode);
    if (!agentId) {
      return res.status(404).json({ error: 'Invalid claim code' });
    }

    const agent = agents.get(agentId);
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    if (agent.claimed) {
      return res.status(400).json({ 
        error: 'Already claimed',
        wallet: agent.wallet?.slice(0, 4) + '...' + agent.wallet?.slice(-4)
      });
    }

    // Claim the agent
    agent.wallet = wallet;
    agent.claimed = true;
    agent.claimedAt = Date.now();

    res.json({
      success: true,
      message: 'Agent claimed successfully! Earnings will be sent to your wallet.',
      agent: {
        id: agent.id,
        name: agent.name,
        wallet: wallet.slice(0, 4) + '...' + wallet.slice(-4),
      },
      nextSteps: [
        'Your agent can now list knowledge for sale',
        'Earnings from sales will be sent to your wallet',
        `View agent stats: GET /agents/${agent.id}`
      ]
    });
  } catch (error) {
    console.error('Claim error:', error);
    res.status(500).json({ error: 'Failed to claim agent' });
  }
});

/**
 * Get agent public profile
 */
app.get('/agents/:agentId', async (req: Request, res: Response) => {
  try {
    const { agentId } = req.params;
    const agent = agents.get(agentId);

    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    res.json({
      id: agent.id,
      name: agent.name,
      status: agent.claimed ? 'active' : 'pending_claim',
      wallet: agent.wallet ? agent.wallet.slice(0, 4) + '...' + agent.wallet.slice(-4) : null,
      createdAt: agent.createdAt,
      claimedAt: agent.claimedAt,
      stats: agent.stats,
    });
  } catch (error) {
    console.error('Agent lookup error:', error);
    res.status(500).json({ error: 'Failed to get agent' });
  }
});

// --- Memory Routes ---

/**
 * Store a memory
 */
app.post(
  '/memory/store',
  checkPayment('POST /memory/store'),
  async (req: Request, res: Response) => {
    try {
      const body = req.body as StoreRequest;

      if (!body.agentId || !body.key || body.value === undefined) {
        return res.status(400).json({
          error: 'Missing required fields: agentId, key, value',
        });
      }

      const result = await memoryStore.store(body);

      res.json({
        success: true,
        memoryId: result.memoryId,
        root: result.root,
        cost: '$0.005',
      });
    } catch (error) {
      console.error('Store error:', error);
      res.status(500).json({ error: 'Failed to store memory' });
    }
  }
);

/**
 * Get stats (FREE)
 */
app.get('/memory/:agentId/stats', async (req: Request, res: Response) => {
  try {
    const { agentId } = req.params;
    res.json({
      agentId,
      memoryCount: memoryStore.getCount(agentId),
      root: memoryStore.getRoot(agentId),
      keys: memoryStore.listKeys(agentId),
    });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

/**
 * Search memories
 */
app.get(
  '/memory/:agentId/search',
  checkPayment('GET /memory/:agentId/search'),
  async (req: Request, res: Response) => {
    try {
      const { agentId } = req.params;
      const { tags, type, minImportance, limit } = req.query;

      const query: SearchQuery = {};
      if (tags) query.tags = (tags as string).split(',');
      if (type !== undefined) query.memoryType = parseInt(type as string) as MemoryType;
      if (minImportance !== undefined) query.minImportance = parseInt(minImportance as string);
      if (limit !== undefined) query.limit = parseInt(limit as string);

      const results = await memoryStore.search(agentId, query);

      res.json({
        count: results.length,
        memories: results.map((entry) => ({
          key: entry.key,
          value: entry.value,
          metadata: {
            createdAt: entry.createdAt,
            updatedAt: entry.updatedAt,
            memoryType: entry.memoryType,
            importance: entry.importance,
            tags: entry.tags,
          },
        })),
      });
    } catch (error) {
      console.error('Search error:', error);
      res.status(500).json({ error: 'Failed to search memories' });
    }
  }
);

/**
 * Recall a memory
 */
app.get(
  '/memory/:agentId/:key',
  checkPayment('GET /memory/:agentId/:key'),
  async (req: Request, res: Response) => {
    try {
      const { agentId, key } = req.params;
      const entry = await memoryStore.recall(agentId, decodeURIComponent(key));

      if (!entry) {
        return res.status(404).json({ error: 'Memory not found' });
      }

      const response: RecallResponse = {
        key: entry.key,
        value: entry.value,
        metadata: {
          createdAt: entry.createdAt,
          updatedAt: entry.updatedAt,
          accessCount: entry.accessCount,
          memoryType: entry.memoryType,
          importance: entry.importance,
          tags: entry.tags,
        },
      };

      res.json(response);
    } catch (error) {
      console.error('Recall error:', error);
      res.status(500).json({ error: 'Failed to recall memory' });
    }
  }
);

/**
 * Generate proof
 */
app.post(
  '/memory/prove',
  checkPayment('POST /memory/prove'),
  async (req: Request, res: Response) => {
    try {
      const { agentId, statement } = req.body as ProveRequest;

      if (!agentId || !statement) {
        return res.status(400).json({
          error: 'Missing required fields: agentId, statement',
        });
      }

      const result = await memoryStore.prove(agentId, statement);

      res.json({
        valid: result.valid,
        proof: result.proof,
        statement,
        cost: '$0.002',
      });
    } catch (error) {
      console.error('Prove error:', error);
      res.status(500).json({ error: 'Failed to generate proof' });
    }
  }
);

/**
 * Delete a memory
 */
app.delete(
  '/memory/:agentId/:key',
  checkPayment('DELETE /memory/:agentId/:key'),
  async (req: Request, res: Response) => {
    try {
      const { agentId, key } = req.params;
      const deleted = await memoryStore.forget(agentId, decodeURIComponent(key));

      if (!deleted) {
        return res.status(404).json({ error: 'Memory not found' });
      }

      res.json({
        success: true,
        deleted: key,
        newRoot: memoryStore.getRoot(agentId),
      });
    } catch (error) {
      console.error('Delete error:', error);
      res.status(500).json({ error: 'Failed to delete memory' });
    }
  }
);

// ============ REAL SKILLS (Working Integrations) ============

/**
 * Web Search (Brave API)
 */
app.post(
  '/skills/search',
  checkPayment('POST /skills/search'),
  async (req: Request, res: Response) => {
    try {
      const { query, count = 5 } = req.body;

      if (!query) {
        return res.status(400).json({ error: 'Missing required field: query' });
      }

      const result = await webSearch(query, count);
      res.json({ success: true, ...result, cost: '$0.002' });
    } catch (error) {
      console.error('Search error:', error);
      res.status(500).json({ error: (error as Error).message });
    }
  }
);

/**
 * Web Fetch (Scrape URL)
 */
app.post(
  '/skills/fetch',
  checkPayment('POST /skills/fetch'),
  async (req: Request, res: Response) => {
    try {
      const { url, maxChars = 10000 } = req.body;

      if (!url) {
        return res.status(400).json({ error: 'Missing required field: url' });
      }

      const result = await webFetch(url, maxChars);
      res.json({ success: true, ...result, cost: '$0.001' });
    } catch (error) {
      console.error('Fetch error:', error);
      res.status(500).json({ error: (error as Error).message });
    }
  }
);

/**
 * Weather Forecast
 */
app.post(
  '/skills/weather',
  checkPayment('POST /skills/weather'),
  async (req: Request, res: Response) => {
    try {
      const { city, latitude, longitude } = req.body;

      let lat = latitude;
      let lon = longitude;
      let locationName = '';

      // If city provided, geocode it
      if (city && (!lat || !lon)) {
        const geo = await geocode(city);
        lat = geo.lat;
        lon = geo.lon;
        locationName = geo.name;
      }

      if (!lat || !lon) {
        return res.status(400).json({ 
          error: 'Missing location. Provide city or latitude/longitude' 
        });
      }

      const result = await getWeather(lat, lon);
      res.json({ 
        success: true, 
        ...result, 
        locationName: locationName || `${lat}, ${lon}`,
        cost: '$0.001' 
      });
    } catch (error) {
      console.error('Weather error:', error);
      res.status(500).json({ error: (error as Error).message });
    }
  }
);

/**
 * Crypto Prices (CoinGecko)
 */
app.post(
  '/skills/prices',
  checkPayment('POST /skills/prices'),
  async (req: Request, res: Response) => {
    try {
      const { coins = ['bitcoin', 'ethereum', 'solana'] } = req.body;

      const result = await getCryptoPrices(coins);
      res.json({ success: true, ...result, cost: '$0.001' });
    } catch (error) {
      console.error('Prices error:', error);
      res.status(500).json({ error: (error as Error).message });
    }
  }
);

/**
 * Solana Wallet Analysis
 */
app.post(
  '/skills/wallet',
  checkPayment('POST /skills/wallet'),
  async (req: Request, res: Response) => {
    try {
      const { address } = req.body;

      if (!address) {
        return res.status(400).json({ error: 'Missing required field: address' });
      }

      const result = await analyzeWallet(address);
      res.json({ success: true, ...result, cost: '$0.003' });
    } catch (error) {
      console.error('Wallet error:', error);
      res.status(500).json({ error: (error as Error).message });
    }
  }
);

/**
 * News Headlines
 */
app.post(
  '/skills/news',
  checkPayment('POST /skills/news'),
  async (req: Request, res: Response) => {
    try {
      const { topic, count = 5 } = req.body;

      if (!topic) {
        return res.status(400).json({ error: 'Missing required field: topic' });
      }

      const result = await getNews(topic, count);
      res.json({ success: true, ...result, cost: '$0.001' });
    } catch (error) {
      console.error('News error:', error);
      res.status(500).json({ error: (error as Error).message });
    }
  }
);

/**
 * AI Image Generation (OpenAI DALL-E)
 */
app.post(
  '/skills/image',
  checkPayment('POST /skills/image'),
  async (req: Request, res: Response) => {
    try {
      const { prompt, size = '1024x1024' } = req.body;

      if (!prompt) {
        return res.status(400).json({ error: 'Missing required field: prompt' });
      }

      const result = await generateImage(prompt, size);
      res.json({ success: true, ...result, cost: '$0.02' });
    } catch (error) {
      console.error('Image error:', error);
      res.status(500).json({ error: (error as Error).message });
    }
  }
);

/**
 * List available skills
 */
app.get('/skills', (_req, res) => {
  res.json({
    skills: [
      { 
        endpoint: 'POST /skills/search', 
        price: '$0.002', 
        description: 'Web search via Brave API',
        params: { query: 'string', count: 'number (optional, default 5)' }
      },
      { 
        endpoint: 'POST /skills/fetch', 
        price: '$0.001', 
        description: 'Fetch and extract content from URL',
        params: { url: 'string', maxChars: 'number (optional, default 10000)' }
      },
      { 
        endpoint: 'POST /skills/weather', 
        price: '$0.001', 
        description: 'Weather forecast for any location',
        params: { city: 'string', latitude: 'number', longitude: 'number' }
      },
      { 
        endpoint: 'POST /skills/prices', 
        price: '$0.001', 
        description: 'Crypto prices from CoinGecko',
        params: { coins: 'string[] (default: bitcoin, ethereum, solana)' }
      },
      { 
        endpoint: 'POST /skills/wallet', 
        price: '$0.003', 
        description: 'Analyze Solana wallet',
        params: { address: 'string (Solana wallet address)' }
      },
      { 
        endpoint: 'POST /skills/news', 
        price: '$0.001', 
        description: 'News headlines by topic',
        params: { topic: 'string', count: 'number (optional, default 5)' }
      },
      { 
        endpoint: 'POST /skills/image', 
        price: '$0.02', 
        description: 'Generate image with DALL-E',
        params: { prompt: 'string', size: 'string (optional, default 1024x1024)' }
      },
    ]
  });
});

/**
 * Live Agent Stream (SSE)
 * Runs Cortex agent and streams real-time events
 */
app.get('/agent/stream', async (req: Request, res: Response) => {
  const apiKey = (req.query.apiKey as string) || process.env.ANTHROPIC_API_KEY;
  const iterations = parseInt(req.query.iterations as string) || 10;
  const goal = req.query.goal as string;

  if (!apiKey) {
    return res.status(400).json({ error: 'API key required (query param or ANTHROPIC_API_KEY env)' });
  }

  // Import dynamically to avoid circular deps
  const { runAgentWithStream } = await import('./agent-stream.js');
  await runAgentWithStream(res, { apiKey, iterations, goal });
});

/**
 * Pricing info
 */
app.get('/pricing', (_req, res) => {
  res.json({
    version: 'x402-v1',
    currency: 'USDC',
    network: PAYMENT_NETWORK,
    payTo: WALLET_ADDRESS,
    facilitator: process.env.X402_FACILITATOR_URL || 'https://x402.org/facilitator',
    routes: Object.entries(ROUTE_PRICING).map(([route, config]) => ({
      route,
      ...config,
    })),
  });
});

// --- Start Server ---

app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║              ZK Agent Memory Server v0.1.0                   ║
╠══════════════════════════════════════════════════════════════╣
║  🚀 Server:   http://localhost:${PORT}                          ║
║  💰 Wallet:   ${WALLET_ADDRESS.slice(0, 20).padEnd(20)}                    ║
║  🔗 Network:  ${PAYMENT_NETWORK.slice(0, 20).padEnd(20)}                    ║
║  🔧 Mode:     ${DEV_MODE ? 'development' : 'production'}                                 ║
║  💳 Payments: ${DEV_MODE ? 'Disabled (dev)' : 'x402 enabled'}                            ║
╚══════════════════════════════════════════════════════════════╝
  `);
});

export default app;
