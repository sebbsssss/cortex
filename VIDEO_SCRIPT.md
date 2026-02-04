# Cortex Demo Video Script
**Duration: 2-3 minutes**

---

## INTRO (15 sec)

**[Screen: Cortex logo + tagline]**

> "Most AI agents execute tasks. Cortex optimizes itself."
> 
> "I'm going to show you an AI agent that gets measurably better — 
> and proves it on Solana."

---

## THE PROBLEM (20 sec)

**[Screen: Side-by-side comparison]**

> "Current agents like AutoGPT and LangChain can remember things,
> but they don't truly learn from outcomes."
>
> "They store facts. They don't adapt behavior."
>
> "And there's no way to prove they're improving."

---

## THE SOLUTION (30 sec)

**[Screen: Architecture diagram]**

> "Cortex applies 5 ML techniques to actually learn:"
>
> **[Highlight each as you mention]**
> - "Q-Learning to select better actions over time"
> - "Reflexion — Claude analyzes failures and extracts lessons"
> - "Skill Synthesis captures what works as reusable behaviors"
> - "Textual Gradients evolve strategies automatically"
> - "Contrastive Learning finds patterns in wins vs losses"
>
> "And every improvement milestone gets recorded on Solana."

---

## LIVE DEMO (60-90 sec)

**[Screen: Terminal running demo]**

```bash
ANTHROPIC_API_KEY=... node packages/agent/dist/demo.js
```

> "Let's run it. Watch the agent learn in real-time."

**[Agent starts]**
> "It perceives the environment... reasons about strategy..."
> "Uses Q-learning to pick actions — notice the exploration rate."

**[First few iterations]**
> "Here's the first action — success. Q-values updating."
> "Now a failure. Watch what happens..."

**[Reflexion triggers]**
> "Score dropped below 50%. Reflexion kicks in."
> "Claude is actually analyzing what went wrong..."
> "See? It extracted a lesson. That'll inform future attempts."

**[Strategy improves]**
> "Now look — the strategy's success rate is climbing."
> "Started at 50%. Now it's at 75%... 80%..."

**[Skill extracted]**
> "It just extracted a reusable skill from that successful run."
> "This gets stored and can be applied to similar tasks."

**[Final metrics]**
> "Final success rate: 86%. Started at 50%."
> "That's real, measurable improvement — powered by Claude."

---

## ON-CHAIN PROOF (20 sec)

**[Screen: Solana milestone transaction]**

> "Every learning milestone hits Solana."
> "This isn't 'trust me it's learning' — it's verifiable."
> "Anyone can check: this agent improved 36% and here's the proof."

---

## USE CASES (15 sec)

**[Screen: Use case icons]**

> "Trading bots that optimize for market conditions."
> "Research agents that learn which sources are reliable."
> "Support systems that improve resolution rates."
> "Any agent where improvement matters — and proof matters more."

---

## CLOSE (10 sec)

**[Screen: Logo + links]**

> "Cortex. The first agent that proves it's getting smarter."
>
> "GitHub: github.com/sebbsssss/cortex"
> "Live demo: crtx.tech"

---

## RECORDING TIPS

1. **Terminal setup**: Use large font (18pt+), dark theme
2. **Pacing**: Pause briefly after key moments
3. **Highlight**: Circle/box important metrics as they change
4. **Voice**: Confident, technical but accessible
5. **Length**: Keep under 3 min — judges watch many videos

## KEY METRICS TO CAPTURE

- [ ] Success rate climbing (50% → 88%)
- [ ] Q-table growing
- [ ] Exploration rate decaying
- [ ] Reflexion triggering after failure
- [ ] Skill being extracted
- [ ] Milestone recorded (show tx)
