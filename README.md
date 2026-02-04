# 🧠 ARIA — Autonomous Reflective Intelligence Agent

> **The first AI agent that proves it's getting smarter.**

ARIA is a self-learning AI agent that improves through reflection and records its learning milestones on Solana. Watch it evolve, measure its growth, verify its progress on-chain.

## The Problem

AI agents execute tasks, but they don't truly *learn* from their experiences. Each session starts fresh. No memory of what worked. No adaptation. No proof of growth.

## The Solution

ARIA implements a **perceive → reason → act → reflect → learn** loop that:

1. **Tries** different strategies to accomplish goals
2. **Reflects** on what worked and what didn't
3. **Updates** its approach based on reflections
4. **Records** learning milestones on Solana as cryptographic proof

```
┌─────────────────────────────────────────────────────────┐
│                    ARIA AGENT                           │
├─────────────────────────────────────────────────────────┤
│  ┌─────────┐   ┌────────┐   ┌─────┐                    │
│  │PERCEIVE │──▶│ REASON │──▶│ ACT │                    │
│  └─────────┘   └────────┘   └─────┘                    │
│       ▲                         │                       │
│       │    ┌────────────────────┘                       │
│       │    ▼                                            │
│       │  ┌─────────────────────────────────────────┐   │
│       │  │           REFLECT & LEARN               │   │
│       │  │  • Score outcome (reward signal)        │   │
│       │  │  • Update strategy effectiveness        │   │
│       │  │  • Generate new strategy variants       │   │
│       │  └─────────────────────────────────────────┘   │
│       │                   │                             │
│       └───────────────────┘                             │
│                           │                             │
│                           ▼                             │
│              ┌─────────────────────┐                   │
│              │  SOLANA MILESTONE   │ ← On-chain proof  │
│              └─────────────────────┘                   │
└─────────────────────────────────────────────────────────┘
```

## Quick Start

```typescript
import { createARIA } from '@cortex/agent';

// Create an agent with goals
const aria = createARIA({
  name: 'ResearchBot',
  goals: [
    {
      id: 'research-solana',
      description: 'Research Solana MEV strategies',
      priority: 8,
      progress: 0,
      status: 'active',
    }
  ],
  reflectionThreshold: 0.5,  // Update strategy if score < 50%
  learningRate: 0.3,         // How fast to adapt
});

// Register tools the agent can use
aria.registerTool('search', searchAPI);
aria.registerTool('fetch', fetchAPI);
aria.registerTool('prices', pricesAPI);

// Run the agent
await aria.run(100); // 100 iterations

// Check how it learned
console.log(aria.getMetrics());
// {
//   totalActions: 150,
//   successRate: 0.73,      // Started at 0.4!
//   strategiesLearned: 3,
//   milestonesRecorded: 2,  // On Solana!
// }
```

## How Learning Works

### 1. Reflection Scoring

After each action, ARIA reflects on the outcome:

```typescript
const reflection = {
  score: 0.67,  // 67% of actions succeeded
  whatWorked: ['Search found relevant results'],
  whatFailed: ['Fetch timed out'],
  suggestions: ['Add timeout handling', 'Try alternative sources'],
};
```

### 2. Strategy Updates

When reflection scores drop below threshold:

```typescript
if (reflection.score < config.reflectionThreshold) {
  // Update strategy success rate (weighted average)
  strategy.successRate = strategy.successRate * 0.7 + reflection.score * 0.3;
  
  // If very low score, create new strategy variant
  if (reflection.score < 0.3) {
    createImprovedStrategy(strategy, reflection.suggestions);
  }
}
```

### 3. On-Chain Milestones

Significant improvements are recorded on Solana:

```typescript
// When success rate improves by 15%+
const milestone = {
  type: 'success_rate_improved',
  description: 'Success rate improved by 18%',
  metrics: { before: 0.55, after: 0.73 },
  txSignature: '5KtP8n...',  // Solana tx
};
```

## API Skills

ARIA comes with built-in tools powered by real APIs:

| Skill | Price | Description |
|-------|-------|-------------|
| `/skills/search` | $0.002 | Web search (Brave API) |
| `/skills/fetch` | $0.001 | URL content extraction |
| `/skills/weather` | $0.001 | Weather forecasts (Open-Meteo) |
| `/skills/prices` | $0.001 | Crypto prices (CoinGecko) |
| `/skills/wallet` | $0.003 | Solana wallet analysis |
| `/skills/news` | $0.001 | News headlines |
| `/skills/image` | $0.02 | Image generation (DALL-E 3) |

## Run the Demo

```bash
# Clone and install
git clone https://github.com/sebbsssss/cortex
cd cortex
npm install
npm run build

# Run ARIA demo
node packages/agent/dist/demo.js
```

Output:
```
🧠 ARIA - Autonomous Reflective Intelligence Agent

[ARIA] Starting agent: ARIA-Demo
[ARIA] Goals: Research crypto markets, Monitor prices
[ARIA] Executing plan: Web Research
[ARIA] Reflection score: 100%
[ARIA] Executing plan: Market Monitor
[ARIA] Reflection score: 67%
[ARIA] Score below threshold, updating strategy...
...

📊 Final Metrics:
   Total Actions: 30
   Success Rate: 83.3%
   Strategies Learned: 2
   Milestones Recorded: 1
```

## Why This Matters

Most AI agents are stateless tools. ARIA is different:

- **Persistent Learning**: Gets measurably better over time
- **Reflective**: Analyzes its own failures and successes  
- **Adaptive**: Changes strategy based on results
- **Verifiable**: Learning milestones recorded on Solana
- **Autonomous**: Pursues goals without constant supervision

## Architecture

```
packages/
├── agent/           # ARIA core
│   ├── aria.ts      # Perceive-Reason-Act-Reflect loop
│   ├── solana.ts    # On-chain milestone recording
│   └── types.ts     # TypeScript interfaces
├── server/          # API server
│   ├── skills.ts    # Tool implementations
│   └── index.ts     # Express routes
└── sdk/             # Client library
```

## Hackathon

Built for the [Colosseum Agent Hackathon](https://agents.colosseum.com) (Feb 2026).

**What makes ARIA technically impressive:**

1. Real perceive-reason-act-reflect loop (not just prompts)
2. Measurable learning with reflection scoring
3. Strategy evolution through exploration/exploitation
4. On-chain proofs of improvement on Solana
5. Working tool integrations (search, prices, wallet analysis)

## License

MIT

---

*"Knowledge is power — but learning is evolution."*
