# 🧠 Cortex — Self-Learning AI Agent

> **The first AI agent that proves it's getting smarter.**

Cortex is a self-learning AI agent that improves through real ML techniques and records learning milestones on Solana. Watch it evolve, measure its growth, verify on-chain.

## The Problem

AI agents can remember things, but they don't truly *learn* from experience. They store facts but don't adapt behavior. A human still needs to tune prompts and fix mistakes.

## The Solution

Cortex applies machine learning principles to autonomously improve:

- **Reward signals** — scores every action outcome
- **Strategy evolution** — success rates update like ML weights  
- **Exploration/exploitation** — tries new approaches vs. proven ones
- **Compounding improvement** — gets measurably better over time
- **On-chain proofs** — learning milestones verified on Solana

```
┌─────────────────────────────────────────────────────────┐
│                  CORTEX AGENT                           │
├─────────────────────────────────────────────────────────┤
│  ┌─────────┐   ┌────────┐   ┌─────┐                    │
│  │PERCEIVE │──▶│ REASON │──▶│ ACT │                    │
│  └─────────┘   └────────┘   └─────┘                    │
│       ▲                         │                       │
│       │    ┌────────────────────┘                       │
│       │    ▼                                            │
│       │  ┌─────────────────────────────────────────┐   │
│       │  │        REFLECT & LEARN                  │   │
│       │  │  • TD Learning (Q-values)               │   │
│       │  │  • Reflexion (self-critique)            │   │
│       │  │  • Textual Gradients                    │   │
│       │  │  • Skill Synthesis                      │   │
│       │  │  • Contrastive Learning                 │   │
│       │  └─────────────────────────────────────────┘   │
│       │                   │                             │
│       └───────────────────┘                             │
│                           ▼                             │
│              ┌─────────────────────┐                   │
│              │  SOLANA MILESTONE   │ ← On-chain proof  │
│              └─────────────────────┘                   │
└─────────────────────────────────────────────────────────┘
```

## ML Techniques

Cortex implements 5 learning techniques from recent research:

### 1. Experience Replay + TD Learning
Classic reinforcement learning with Q-tables and temporal difference updates.

```typescript
// Store experiences
experience.store({ state, action, reward, nextState });

// Update Q-values using TD learning
const target = reward + γ * maxQ(nextState);
Q[state][action] += α * (target - Q[state][action]);

// ε-greedy action selection
const action = random() < ε ? explore() : exploit();
```

### 2. Reflexion (Shinn et al., 2023)
LLM self-critique after failures, extracting lessons for future attempts.

```typescript
// After failure, generate reflection
const reflection = await llm.analyze({
  prompt: `Task failed. What went wrong? What should change?`,
});

// Store as lessons, inject into future prompts
memory.addLesson(reflection.lessons);
```

### 3. Textual Gradients (Self-Evolving Agents paper)
LLM computes "what should change" as natural language modifications.

```typescript
// Compute gradient
const gradient = await llm.compute({
  prompt: `Strategy has 45% success. Generate modifications to improve.`,
});

// Apply to strategy
strategy.heuristics.push(...gradient.addHeuristics);
strategy.steps = applyModifications(gradient.modifySteps);
```

### 4. Skill Synthesis
Extract successful trajectories as reusable, parameterized skills.

```typescript
// When task succeeds with high confidence
const skill = await synthesize({
  goal: 'Research crypto trends',
  trajectory: successfulActions,
});
// skill.steps = [{ tool: 'search', params: { query: '{{topic}}' } }, ...]

skillLibrary.add(skill);
```

### 5. Contrastive Learning
Compare winning vs losing trajectories to extract insights.

```typescript
const insight = await compare(winningRun, losingRun);
// "Winner searched before acting, loser skipped context gathering"

heuristics.add(insight);
```

## Quick Start

```typescript
import { CortexAgent } from '@cortex/agent';

const cortex = new CortexAgent({
  name: 'ResearchBot',
  goals: [
    {
      id: 'research-crypto',
      description: 'Research cryptocurrency trends',
      priority: 8,
      status: 'active',
    }
  ],
  llmCall: async (prompt) => openai.chat(prompt),
  learning: {
    alpha: 0.15,         // Learning rate
    gamma: 0.95,         // Discount factor
    epsilon: 0.3,        // Exploration rate
  },
});

// Register tools
cortex.registerTool('search', searchAPI);
cortex.registerTool('prices', pricesAPI);

// Run the agent
await cortex.run(100);

// Check learning progress
console.log(cortex.getMetrics());
// {
//   successRate: 0.86,
//   qTableSize: 50,
//   lessonsLearned: 12,
//   skillsExtracted: 5,
//   milestonesRecorded: 3,
// }
```

## Demo Results

```
📊 METRICS AFTER 20 ITERATIONS:

Success Rate:      86.4%
Experience Buffer: 20
Q-Table States:    20
Exploration (ε):   27.1% (decayed from 30%)

Reflexions:        2
Lessons Learned:   2
Gradients Applied: 2

Skills Extracted:  17
Insights Found:    6
Win Rate:          90.0%

🧠 STRATEGY EVOLUTION:
   - Web Research: 50% → 88%
```

## Run the Demo

```bash
git clone https://github.com/sebbsssss/cortex
cd cortex
npm install
npm run build
node packages/agent/dist/demo.js
```

## API Tools

Cortex comes with built-in tools (x402 micropayments):

| Tool | Price | API |
|------|-------|-----|
| `/skills/search` | $0.002 | Brave Search |
| `/skills/fetch` | $0.001 | URL scraper |
| `/skills/weather` | $0.001 | Open-Meteo |
| `/skills/prices` | $0.001 | CoinGecko |
| `/skills/wallet` | $0.003 | Solana RPC |
| `/skills/news` | $0.001 | Google News |
| `/skills/image` | $0.02 | DALL-E 3 |

## Architecture

```
packages/
├── agent/              # Cortex core
│   ├── cortex-agent.ts # Main agent with ML stack
│   ├── learning/       # ML modules
│   │   ├── experience.ts   # Replay + TD
│   │   ├── reflexion.ts    # Self-critique
│   │   ├── gradients.ts    # Textual gradients
│   │   ├── skills.ts       # Skill synthesis
│   │   └── contrastive.ts  # Win/loss learning
│   └── solana.ts       # Milestone proofs
├── server/             # API server
│   ├── skills.ts       # Tool implementations
│   └── index.ts        # Express routes
└── sdk/                # Client library
```

## Why This Matters

| Regular Agent | Cortex |
|---------------|--------|
| Stores facts | Learns from outcomes |
| Static prompts | Evolving strategies |
| Human tunes | Self-improving |
| No memory of success/failure | Q-values track what works |
| Trust us | Verify on Solana |

## Hackathon

Built for the [Colosseum Agent Hackathon](https://agents.colosseum.com) (Feb 2026).

**Technical highlights:**
- Real ML: Q-learning, not just averages
- Cites papers: Reflexion, Self-Evolving Agents
- Measurable: 50% → 88% success rate
- On-chain: Learning milestones on Solana
- Working tools: Search, prices, wallet analysis

## License

MIT

---

*"Knowledge is power — but learning is evolution."*
