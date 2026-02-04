/**
 * Cortex - Autonomous Reflective Intelligence Agent
 * Core agent implementation
 */

import {
  CortexConfig,
  Goal,
  Strategy,
  Plan,
  PlannedAction,
  ActionResult,
  ExecutionResult,
  Reflection,
  Learning,
  Memory,
  Milestone,
  Observation,
  PerceptionResult,
} from './types.js';

export class Cortex {
  private config: CortexConfig;
  private memory: Memory;
  private tools: Map<string, (params: any) => Promise<any>>;
  private running: boolean = false;
  private onMilestone?: (milestone: Milestone) => Promise<void>;

  constructor(config: CortexConfig) {
    this.config = config;
    this.tools = new Map();
    this.memory = {
      goals: [...config.goals],
      strategies: this.initDefaultStrategies(),
      learnings: [],
      reflections: [],
      metrics: {
        totalActions: 0,
        successfulActions: 0,
        successRate: 0,
        avgReflectionScore: 0,
        strategiesLearned: 0,
        milestonesRecorded: 0,
        startTime: Date.now(),
        lastActive: Date.now(),
      },
    };
  }

  // ============ TOOL REGISTRATION ============
  registerTool(name: string, fn: (params: any) => Promise<any>): void {
    this.tools.set(name, fn);
    console.log(`[Cortex] Tool registered: ${name}`);
  }

  setMilestoneHandler(handler: (milestone: Milestone) => Promise<void>): void {
    this.onMilestone = handler;
  }

  // ============ CORE LOOP ============
  async run(iterations: number = Infinity): Promise<void> {
    this.running = true;
    let i = 0;

    console.log(`[Cortex] Starting agent: ${this.config.name}`);
    console.log(`[Cortex] Goals: ${this.memory.goals.map(g => g.description).join(', ')}`);

    while (this.running && i < iterations) {
      try {
        // 1. PERCEIVE
        const perception = await this.perceive();
        
        // 2. REASON - Select goal and plan
        const plan = await this.reason(perception);
        if (!plan) {
          console.log('[Cortex] No actionable plan, waiting...');
          await this.sleep(5000);
          continue;
        }

        // 3. ACT - Execute the plan
        const result = await this.act(plan);

        // 4. REFLECT - Analyze outcome
        const reflection = await this.reflect(plan, result);

        // 5. LEARN - Update strategies if needed
        if (reflection.shouldUpdateStrategy) {
          await this.learn(reflection);
        }

        // 6. CHECK MILESTONES
        await this.checkMilestones();

        this.memory.metrics.lastActive = Date.now();
        i++;

      } catch (error) {
        console.error('[Cortex] Loop error:', error);
        await this.sleep(5000);
      }
    }

    console.log('[Cortex] Agent stopped');
  }

  stop(): void {
    this.running = false;
  }

  // ============ PERCEIVE ============
  async perceive(): Promise<PerceptionResult> {
    const observations: Observation[] = [];

    // Gather observations from available tools
    for (const toolName of this.config.tools) {
      if (toolName === 'prices' && this.tools.has('prices')) {
        try {
          const data = await this.tools.get('prices')!({});
          observations.push({
            source: 'prices',
            timestamp: Date.now(),
            data,
            relevance: this.calculateRelevance(data, 'prices'),
          });
        } catch (e) {
          console.log('[Cortex] Perception failed for prices:', e);
        }
      }
      
      if (toolName === 'news' && this.tools.has('news')) {
        try {
          const activeGoal = this.getActiveGoal();
          const topic = this.extractTopic(activeGoal);
          const data = await this.tools.get('news')!({ topic, count: 3 });
          observations.push({
            source: 'news',
            timestamp: Date.now(),
            data,
            relevance: this.calculateRelevance(data, 'news'),
          });
        } catch (e) {
          console.log('[Cortex] Perception failed for news:', e);
        }
      }
    }

    return {
      observations,
      summary: this.summarizeObservations(observations),
      anomalies: this.detectAnomalies(observations),
    };
  }

  // ============ REASON ============
  async reason(perception: PerceptionResult): Promise<Plan | null> {
    const goal = this.getActiveGoal();
    if (!goal) return null;

    // Select best strategy for this goal
    const strategy = this.selectStrategy(goal, perception);
    if (!strategy) {
      // Create a new exploratory strategy
      return this.createExploratoryPlan(goal, perception);
    }

    // Build action plan
    const actions = this.planActions(goal, strategy, perception);

    return {
      goalId: goal.id,
      strategy,
      actions,
      expectedOutcome: `Progress toward: ${goal.description}`,
      confidence: strategy.successRate,
      reasoning: `Using strategy "${strategy.name}" (${(strategy.successRate * 100).toFixed(0)}% success rate)`,
    };
  }

  // ============ ACT ============
  async act(plan: Plan): Promise<ExecutionResult> {
    console.log(`[Cortex] Executing plan: ${plan.strategy.name}`);
    const actionResults: ActionResult[] = [];

    for (const action of plan.actions) {
      const start = Date.now();
      let result: ActionResult;

      try {
        const tool = this.tools.get(action.tool);
        if (!tool) {
          throw new Error(`Tool not found: ${action.tool}`);
        }

        const output = await tool(action.params);
        result = {
          action,
          success: true,
          output,
          duration: Date.now() - start,
          timestamp: Date.now(),
        };
        this.memory.metrics.successfulActions++;

      } catch (error) {
        result = {
          action,
          success: false,
          output: null,
          error: (error as Error).message,
          duration: Date.now() - start,
          timestamp: Date.now(),
        };

        // Try fallback if available
        if (action.fallback) {
          console.log(`[Cortex] Trying fallback for ${action.tool}`);
          // Recursive fallback attempt...
        }
      }

      actionResults.push(result);
      this.memory.metrics.totalActions++;
    }

    const successCount = actionResults.filter(r => r.success).length;
    this.memory.metrics.successRate = 
      this.memory.metrics.successfulActions / this.memory.metrics.totalActions;

    return {
      plan,
      actions: actionResults,
      overallSuccess: successCount === actionResults.length,
      summary: `${successCount}/${actionResults.length} actions succeeded`,
    };
  }

  // ============ REFLECT ============
  async reflect(plan: Plan, result: ExecutionResult): Promise<Reflection> {
    const score = this.calculateScore(result);
    
    const whatWorked = result.actions
      .filter(a => a.success)
      .map(a => `${a.action.tool}: ${a.action.purpose}`);
    
    const whatFailed = result.actions
      .filter(a => !a.success)
      .map(a => `${a.action.tool}: ${a.error}`);

    const suggestions = this.generateSuggestions(result, plan);
    const learnings = this.extractLearnings(result, plan);

    const reflection: Reflection = {
      planId: `${plan.goalId}-${Date.now()}`,
      outcome: result,
      score,
      expectedVsActual: `Expected: ${plan.expectedOutcome}\nActual: ${result.summary}`,
      whatWorked,
      whatFailed,
      suggestions,
      learnings,
      shouldUpdateStrategy: score < this.config.reflectionThreshold,
    };

    // Store reflection summary
    this.memory.reflections.push({
      timestamp: Date.now(),
      goalId: plan.goalId,
      strategyId: plan.strategy.id,
      score,
      keyLearning: learnings[0]?.content || 'No specific learning',
    });

    // Update running average
    const totalScore = this.memory.reflections.reduce((sum, r) => sum + r.score, 0);
    this.memory.metrics.avgReflectionScore = totalScore / this.memory.reflections.length;

    console.log(`[Cortex] Reflection score: ${(score * 100).toFixed(0)}%`);
    if (reflection.shouldUpdateStrategy) {
      console.log(`[Cortex] Score below threshold (${this.config.reflectionThreshold}), will update strategy`);
    }

    return reflection;
  }

  // ============ LEARN ============
  async learn(reflection: Reflection): Promise<void> {
    console.log('[Cortex] Learning from reflection...');

    // Store new learnings
    for (const learning of reflection.learnings) {
      this.memory.learnings.push(learning);
    }

    // Update strategy effectiveness
    const strategy = this.memory.strategies.find(
      s => s.id === reflection.outcome.plan.strategy.id
    );
    if (strategy) {
      // Weighted update of success rate
      const lr = this.config.learningRate;
      strategy.successRate = strategy.successRate * (1 - lr) + reflection.score * lr;
      strategy.usageCount++;
      strategy.lastUsed = Date.now();
    }

    // Generate new strategy variant if score very low
    if (reflection.score < 0.3 && reflection.suggestions.length > 0) {
      const newStrategy = this.createStrategyFromSuggestions(
        reflection.outcome.plan.strategy,
        reflection.suggestions
      );
      this.memory.strategies.push(newStrategy);
      this.memory.metrics.strategiesLearned++;
      console.log(`[Cortex] Created new strategy: ${newStrategy.name}`);
    }
  }

  // ============ MILESTONES ============
  async checkMilestones(): Promise<void> {
    const metrics = this.memory.metrics;
    
    // Check for success rate improvement
    if (this.memory.reflections.length >= 10) {
      const recentScores = this.memory.reflections.slice(-10).map(r => r.score);
      const recentAvg = recentScores.reduce((a, b) => a + b, 0) / 10;
      const oldScores = this.memory.reflections.slice(-20, -10).map(r => r.score);
      
      if (oldScores.length >= 10) {
        const oldAvg = oldScores.reduce((a, b) => a + b, 0) / 10;
        const improvement = recentAvg - oldAvg;

        if (improvement >= this.config.milestoneThreshold) {
          const milestone: Milestone = {
            id: `milestone-${Date.now()}`,
            type: 'success_rate_improved',
            description: `Success rate improved by ${(improvement * 100).toFixed(1)}%`,
            metrics: {
              before: oldAvg,
              after: recentAvg,
            },
            timestamp: Date.now(),
          };

          await this.recordMilestone(milestone);
        }
      }
    }

    // Check for new strategies learned
    if (metrics.strategiesLearned > 0 && 
        metrics.strategiesLearned % 5 === 0) {
      const milestone: Milestone = {
        id: `milestone-${Date.now()}`,
        type: 'strategy_learned',
        description: `Learned ${metrics.strategiesLearned} strategies`,
        metrics: {
          before: metrics.strategiesLearned - 5,
          after: metrics.strategiesLearned,
        },
        timestamp: Date.now(),
      };
      await this.recordMilestone(milestone);
    }
  }

  async recordMilestone(milestone: Milestone): Promise<void> {
    console.log(`[Cortex] 🎯 MILESTONE: ${milestone.description}`);
    this.memory.metrics.milestonesRecorded++;

    if (this.onMilestone) {
      await this.onMilestone(milestone);
    }
  }

  // ============ HELPER METHODS ============
  private getActiveGoal(): Goal | null {
    return this.memory.goals
      .filter(g => g.status === 'active')
      .sort((a, b) => b.priority - a.priority)[0] || null;
  }

  private selectStrategy(goal: Goal, perception: PerceptionResult): Strategy | null {
    const applicable = this.memory.strategies
      .filter(s => this.isStrategyApplicable(s, goal))
      .sort((a, b) => b.successRate - a.successRate);
    
    // Exploration vs exploitation: 20% chance to try non-optimal strategy
    if (Math.random() < 0.2 && applicable.length > 1) {
      return applicable[Math.floor(Math.random() * applicable.length)];
    }
    
    return applicable[0] || null;
  }

  private isStrategyApplicable(strategy: Strategy, goal: Goal): boolean {
    // Simple context matching
    return strategy.context.some(ctx => 
      goal.description.toLowerCase().includes(ctx.toLowerCase())
    );
  }

  private planActions(goal: Goal, strategy: Strategy, perception: PerceptionResult): PlannedAction[] {
    // Convert strategy steps to actions
    return strategy.steps.map((step, i) => {
      const tool = this.inferTool(step);
      return {
        tool,
        params: this.inferParams(step, goal, perception),
        purpose: step,
      };
    });
  }

  private inferTool(step: string): string {
    const stepLower = step.toLowerCase();
    if (stepLower.includes('search')) return 'search';
    if (stepLower.includes('fetch') || stepLower.includes('read')) return 'fetch';
    if (stepLower.includes('price')) return 'prices';
    if (stepLower.includes('news')) return 'news';
    if (stepLower.includes('weather')) return 'weather';
    if (stepLower.includes('wallet')) return 'wallet';
    return 'search'; // default
  }

  private inferParams(step: string, goal: Goal, perception: PerceptionResult): Record<string, unknown> {
    // Extract relevant params from context
    return {
      query: goal.description,
      topic: this.extractTopic(goal),
    };
  }

  private extractTopic(goal: Goal | null): string {
    if (!goal) return 'technology';
    // Simple keyword extraction
    const words = goal.description.split(' ');
    return words.find(w => w.length > 4) || 'general';
  }

  private calculateScore(result: ExecutionResult): number {
    const successRatio = result.actions.filter(a => a.success).length / result.actions.length;
    return successRatio;
  }

  private calculateRelevance(data: any, source: string): number {
    // Simple relevance scoring
    return 0.5 + Math.random() * 0.5;
  }

  private summarizeObservations(observations: Observation[]): string {
    return `Gathered ${observations.length} observations from: ${observations.map(o => o.source).join(', ')}`;
  }

  private detectAnomalies(observations: Observation[]): string[] {
    // Placeholder for anomaly detection
    return [];
  }

  private generateSuggestions(result: ExecutionResult, plan: Plan): string[] {
    const suggestions: string[] = [];
    
    for (const action of result.actions) {
      if (!action.success) {
        suggestions.push(`Consider alternative to ${action.action.tool} for: ${action.action.purpose}`);
        suggestions.push(`Add error handling for: ${action.error}`);
      }
    }

    if (result.actions.every(a => a.success) && plan.confidence < 0.7) {
      suggestions.push('Strategy worked but confidence was low - reinforce this approach');
    }

    return suggestions;
  }

  private extractLearnings(result: ExecutionResult, plan: Plan): Learning[] {
    const learnings: Learning[] = [];

    if (result.overallSuccess) {
      learnings.push({
        type: 'pattern',
        content: `Strategy "${plan.strategy.name}" effective for goal type`,
        confidence: plan.confidence,
        applicableTo: [plan.goalId],
      });
    } else {
      const failedTools = result.actions
        .filter(a => !a.success)
        .map(a => a.action.tool);
      
      learnings.push({
        type: 'correction',
        content: `Tools [${failedTools.join(', ')}] unreliable in this context`,
        confidence: 0.7,
        applicableTo: [plan.goalId],
      });
    }

    return learnings;
  }

  private createExploratoryPlan(goal: Goal, perception: PerceptionResult): Plan {
    const newStrategy: Strategy = {
      id: `explore-${Date.now()}`,
      name: 'Exploratory',
      description: 'Try different approaches to learn what works',
      successRate: 0.5,
      usageCount: 0,
      lastUsed: Date.now(),
      context: [goal.description.split(' ')[0]],
      steps: ['Search for relevant information', 'Analyze results'],
    };

    return {
      goalId: goal.id,
      strategy: newStrategy,
      actions: [
        {
          tool: 'search',
          params: { query: goal.description, count: 3 },
          purpose: 'Gather initial information',
        },
      ],
      expectedOutcome: 'Learn what approaches might work',
      confidence: 0.3,
      reasoning: 'No existing strategy matches - exploring',
    };
  }

  private createStrategyFromSuggestions(base: Strategy, suggestions: string[]): Strategy {
    return {
      id: `${base.id}-v${Date.now()}`,
      name: `${base.name} (Improved)`,
      description: `${base.description} with adjustments: ${suggestions[0]}`,
      successRate: 0.5,  // Start fresh
      usageCount: 0,
      lastUsed: Date.now(),
      context: base.context,
      steps: [...base.steps, 'Apply learned corrections'],
    };
  }

  private initDefaultStrategies(): Strategy[] {
    return [
      {
        id: 'research',
        name: 'Web Research',
        description: 'Search and analyze web information',
        successRate: 0.6,
        usageCount: 0,
        lastUsed: 0,
        context: ['research', 'learn', 'find', 'discover', 'analyze'],
        steps: ['Search for topic', 'Fetch detailed pages', 'Extract insights'],
      },
      {
        id: 'monitor',
        name: 'Market Monitor',
        description: 'Track prices and news',
        successRate: 0.7,
        usageCount: 0,
        lastUsed: 0,
        context: ['monitor', 'track', 'watch', 'price', 'market', 'crypto'],
        steps: ['Check current prices', 'Get latest news', 'Analyze trends'],
      },
      {
        id: 'wallet-analysis',
        name: 'Wallet Analyzer',
        description: 'Analyze Solana wallets',
        successRate: 0.65,
        usageCount: 0,
        lastUsed: 0,
        context: ['wallet', 'solana', 'address', 'holdings', 'balance'],
        steps: ['Fetch wallet data', 'Analyze holdings', 'Identify patterns'],
      },
    ];
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ============ PUBLIC GETTERS ============
  getMemory(): Memory {
    return { ...this.memory };
  }

  getMetrics(): Memory['metrics'] {
    return { ...this.memory.metrics };
  }

  getStrategies(): Strategy[] {
    return [...this.memory.strategies];
  }
}
