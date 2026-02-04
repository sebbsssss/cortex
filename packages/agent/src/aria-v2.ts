/**
 * ARIA v2 - Autonomous Reflective Intelligence Agent
 * 
 * Full ML-based learning stack:
 * - Experience Replay + TD Learning
 * - Reflexion (LLM self-critique)
 * - Skill Synthesis
 * - Textual Gradients
 * - Contrastive Learning
 * - Solana milestone proofs
 */

import {
  ExperienceReplay,
  ReflexionEngine,
  SkillLibrary,
  TextualGradientEngine,
  ContrastiveLearner,
  type Trajectory,
  type TrajectoryRecord,
} from './learning/index.js';
import { Milestone } from './types.js';

export interface ARIAv2Config {
  name: string;
  goals: Goal[];
  
  // LLM integration (required for learning)
  llmCall: (prompt: string) => Promise<string>;
  
  // Learning hyperparameters
  learning: {
    experienceBufferSize?: number;
    alpha?: number;         // TD learning rate
    gamma?: number;         // Discount factor
    epsilon?: number;       // Exploration rate
    reflexionThreshold?: number;  // Score below this triggers reflection
    gradientThreshold?: number;   // Score below this triggers gradient update
    skillConfidence?: number;     // Min confidence to extract skill
  };
  
  // Tools
  tools: string[];
  
  // Solana
  solanaRpc?: string;
}

export interface Goal {
  id: string;
  description: string;
  priority: number;
  status: 'active' | 'completed' | 'failed' | 'paused';
}

export interface ActionResult {
  tool: string;
  params: any;
  success: boolean;
  result: any;
  duration: number;
}

export class ARIAv2 {
  private config: ARIAv2Config;
  private goals: Goal[];
  
  // Learning modules
  private experience: ExperienceReplay;
  private reflexion: ReflexionEngine;
  private skills: SkillLibrary;
  private gradients: TextualGradientEngine;
  private contrastive: ContrastiveLearner;
  
  // Tools
  private tools: Map<string, (params: any) => Promise<any>> = new Map();
  
  // Strategies (evolve through textual gradients)
  private strategies: Map<string, {
    id: string;
    name: string;
    description: string;
    systemPrompt: string;
    steps: string[];
    heuristics: string[];
    successRate: number;
    usageCount: number;
  }> = new Map();
  
  // State
  private running: boolean = false;
  private iteration: number = 0;
  private currentState: string = 'idle';
  
  // Metrics
  private metrics = {
    totalActions: 0,
    successfulActions: 0,
    reflectionsTriggered: 0,
    gradientsApplied: 0,
    skillsExtracted: 0,
    contrastiveInsights: 0,
    milestonesRecorded: 0,
  };
  
  // Callbacks
  private onMilestone?: (milestone: Milestone) => Promise<void>;
  private onLog?: (message: string, level: string) => void;

  constructor(config: ARIAv2Config) {
    this.config = config;
    this.goals = [...config.goals];
    
    // Initialize learning modules
    this.experience = new ExperienceReplay({
      maxSize: config.learning.experienceBufferSize || 10000,
      alpha: config.learning.alpha || 0.1,
      gamma: config.learning.gamma || 0.95,
      epsilon: config.learning.epsilon || 0.2,
    });
    
    this.reflexion = new ReflexionEngine({
      llmCall: config.llmCall,
    });
    
    this.skills = new SkillLibrary({
      llmCall: config.llmCall,
      minConfidenceToExtract: config.learning.skillConfidence || 0.75,
    });
    
    this.gradients = new TextualGradientEngine({
      llmCall: config.llmCall,
      learningRate: config.learning.alpha || 0.3,
    });
    
    this.contrastive = new ContrastiveLearner({
      llmCall: config.llmCall,
    });
    
    // Initialize default strategies
    this.initStrategies();
  }

  // ============ SETUP ============
  
  registerTool(name: string, fn: (params: any) => Promise<any>): void {
    this.tools.set(name, fn);
    this.log(`Tool registered: ${name}`, 'info');
  }

  setMilestoneHandler(handler: (milestone: Milestone) => Promise<void>): void {
    this.onMilestone = handler;
  }

  setLogHandler(handler: (message: string, level: string) => void): void {
    this.onLog = handler;
  }

  // ============ MAIN LOOP ============

  async run(maxIterations: number = Infinity): Promise<void> {
    this.running = true;
    this.log(`Starting ARIA v2: ${this.config.name}`, 'system');
    this.log(`Goals: ${this.goals.map(g => g.description).join(', ')}`, 'info');

    while (this.running && this.iteration < maxIterations) {
      this.iteration++;
      
      try {
        await this.executeLoop();
      } catch (error) {
        this.log(`Error in loop: ${(error as Error).message}`, 'error');
        await this.sleep(1000);
      }
    }

    this.log('Agent stopped', 'system');
  }

  stop(): void {
    this.running = false;
  }

  private async executeLoop(): Promise<void> {
    const startTime = Date.now();
    
    // 1. SELECT GOAL
    const goal = this.selectGoal();
    if (!goal) {
      this.log('No active goals', 'warning');
      return;
    }

    // 2. PERCEIVE - Get current state
    const state = await this.perceive(goal);
    this.log(`[${this.iteration}] Perceiving... State: ${state.slice(0, 50)}...`, 'perceive');

    // 3. GET GUIDANCE from learning modules
    const lessons = this.reflexion.getLessonsForGoal(goal.description);
    const insights = this.contrastive.generateGuidance(goal.description);
    const applicableSkills = this.skills.findSkillsForGoal(
      goal.description,
      Array.from(this.tools.keys())
    );

    // 4. REASON - Select strategy and actions using Q-learning
    const strategy = this.selectStrategy(goal);
    const availableActions = this.getAvailableActions(strategy);
    const { action: selectedAction, isExploration, qValue } = this.experience.selectAction(
      state,
      availableActions
    );
    
    this.log(
      `Strategy: ${strategy.name} | Action: ${selectedAction} | ` +
      `Q: ${qValue.toFixed(2)} | ${isExploration ? 'EXPLORE' : 'EXPLOIT'}`,
      'reason'
    );

    // 5. ACT - Execute actions
    const actions = await this.act(strategy, selectedAction, goal, {
      lessons,
      insights,
      skills: applicableSkills,
    });
    
    // 6. OBSERVE - Get new state and reward
    const newState = await this.perceive(goal);
    const reward = this.calculateReward(actions);
    const success = reward > 0;

    // 7. STORE EXPERIENCE
    this.experience.store({
      state,
      action: selectedAction,
      reward,
      nextState: newState,
      metadata: {
        goalId: goal.id,
        strategyId: strategy.id,
        timestamp: Date.now(),
      },
    });

    // 8. UPDATE Q-VALUES (TD Learning)
    const { avgTdError } = this.experience.update(32);
    if (avgTdError > 0.1) {
      this.log(`TD Error: ${avgTdError.toFixed(3)}`, 'learn');
    }

    // 9. REFLECT if needed
    const score = actions.filter(a => a.success).length / actions.length;
    this.log(`Score: ${(score * 100).toFixed(0)}%`, score >= 0.7 ? 'success' : 'warning');

    if (score < (this.config.learning.reflexionThreshold || 0.5)) {
      await this.triggerReflexion(goal, actions, score);
    }

    // 10. APPLY TEXTUAL GRADIENTS if needed
    if (score < (this.config.learning.gradientThreshold || 0.4)) {
      await this.applyTextualGradient(strategy, actions, score);
    }

    // 11. EXTRACT SKILL if successful
    if (success && score >= (this.config.learning.skillConfidence || 0.75)) {
      await this.tryExtractSkill(goal, actions, score);
    }

    // 12. RECORD TRAJECTORY for contrastive learning
    this.recordTrajectory(goal, actions, success, score);

    // 13. PERIODIC CONTRASTIVE LEARNING
    if (this.iteration % 10 === 0) {
      const newInsights = await this.contrastive.learnFromContrasts(3);
      if (newInsights.length > 0) {
        this.metrics.contrastiveInsights += newInsights.length;
        this.log(`Contrastive learning: ${newInsights.length} new insights`, 'learn');
      }
    }

    // 14. DECAY EXPLORATION
    this.experience.decayEpsilon();

    // 15. CHECK MILESTONES
    await this.checkMilestones();

    // Brief pause between iterations
    const elapsed = Date.now() - startTime;
    if (elapsed < 500) {
      await this.sleep(500 - elapsed);
    }
  }

  // ============ CORE METHODS ============

  private async perceive(goal: Goal): Promise<string> {
    // Create state representation from goal and context
    const toolStates: string[] = [];
    
    // Optionally gather observations from tools
    if (this.tools.has('prices')) {
      try {
        const prices = await this.tools.get('prices')!({});
        toolStates.push(`prices:${JSON.stringify(prices).slice(0, 100)}`);
      } catch {}
    }

    return `goal:${goal.id}|iter:${this.iteration}|${toolStates.join('|')}`;
  }

  private selectGoal(): Goal | null {
    return this.goals
      .filter(g => g.status === 'active')
      .sort((a, b) => b.priority - a.priority)[0] || null;
  }

  private selectStrategy(goal: Goal): typeof this.strategies extends Map<string, infer V> ? V : never {
    // Find strategy with best success rate for this goal type
    let best = Array.from(this.strategies.values())[0];
    
    for (const strategy of this.strategies.values()) {
      if (strategy.successRate > best.successRate) {
        best = strategy;
      }
    }

    return best;
  }

  private getAvailableActions(strategy: any): string[] {
    // Actions based on strategy steps and available tools
    const actions: string[] = [];
    
    for (const tool of this.tools.keys()) {
      actions.push(`use:${tool}`);
    }
    
    for (const step of strategy.steps) {
      actions.push(`step:${step.slice(0, 20)}`);
    }

    return actions;
  }

  private async act(
    strategy: any,
    selectedAction: string,
    goal: Goal,
    guidance: { lessons: string[]; insights: string[]; skills: any[] }
  ): Promise<ActionResult[]> {
    const results: ActionResult[] = [];

    // Parse action
    if (selectedAction.startsWith('use:')) {
      const toolName = selectedAction.slice(4);
      const tool = this.tools.get(toolName);
      
      if (tool) {
        const start = Date.now();
        try {
          const params = this.inferParams(toolName, goal, guidance);
          const result = await tool(params);
          
          results.push({
            tool: toolName,
            params,
            success: true,
            result,
            duration: Date.now() - start,
          });
          
          this.metrics.successfulActions++;
          this.log(`✓ ${toolName}`, 'success');
        } catch (error) {
          results.push({
            tool: toolName,
            params: {},
            success: false,
            result: (error as Error).message,
            duration: Date.now() - start,
          });
          this.log(`✗ ${toolName}: ${(error as Error).message}`, 'error');
        }
        this.metrics.totalActions++;
      }
    }

    // If no specific action, execute strategy steps
    if (results.length === 0) {
      for (const step of strategy.steps.slice(0, 3)) {
        const toolName = this.inferToolFromStep(step);
        const tool = this.tools.get(toolName);
        
        if (tool) {
          const start = Date.now();
          try {
            const params = this.inferParams(toolName, goal, guidance);
            const result = await tool(params);
            
            results.push({
              tool: toolName,
              params,
              success: true,
              result,
              duration: Date.now() - start,
            });
            this.metrics.successfulActions++;
          } catch (error) {
            results.push({
              tool: toolName,
              params: {},
              success: false,
              result: (error as Error).message,
              duration: Date.now() - start,
            });
          }
          this.metrics.totalActions++;
        }
      }
    }

    // Update strategy stats
    const successRate = results.filter(r => r.success).length / Math.max(results.length, 1);
    strategy.usageCount++;
    strategy.successRate = (strategy.successRate * (strategy.usageCount - 1) + successRate) / strategy.usageCount;

    return results;
  }

  private calculateReward(actions: ActionResult[]): number {
    if (actions.length === 0) return -0.5;
    
    const successRate = actions.filter(a => a.success).length / actions.length;
    
    // Reward: -1 (all failed) to +1 (all succeeded)
    return successRate * 2 - 1;
  }

  // ============ LEARNING METHODS ============

  private async triggerReflexion(goal: Goal, actions: ActionResult[], score: number): Promise<void> {
    this.metrics.reflectionsTriggered++;
    this.log('Triggering reflexion...', 'learn');

    const trajectory: Trajectory = {
      goal: goal.description,
      actions: actions.map(a => ({
        thought: `Use ${a.tool}`,
        action: `${a.tool}(${JSON.stringify(a.params).slice(0, 50)})`,
        observation: a.success ? 'Success' : `Failed: ${a.result}`,
      })),
      outcome: score >= 0.5 ? 'partial' : 'failure',
      finalResult: `Score: ${(score * 100).toFixed(0)}%`,
    };

    const reflection = await this.reflexion.reflect(trajectory);
    
    if (reflection.lessons.length > 0) {
      this.log(`Learned: ${reflection.lessons[0]}`, 'learn');
    }
  }

  private async applyTextualGradient(strategy: any, actions: ActionResult[], score: number): Promise<void> {
    this.metrics.gradientsApplied++;
    this.log('Computing textual gradient...', 'learn');

    const outcomes = actions.map(a => ({
      success: a.success,
      context: `${a.tool}: ${a.success ? 'OK' : a.result}`,
    }));

    const gradientStrategy = {
      id: strategy.id,
      name: strategy.name,
      description: strategy.description,
      systemPrompt: strategy.systemPrompt || '',
      steps: strategy.steps,
      heuristics: strategy.heuristics || [],
      successRate: strategy.successRate,
    };

    const { updated, gradient } = await this.gradients.updateStrategy(gradientStrategy, outcomes);

    // Apply updates back to strategy
    strategy.steps = updated.steps;
    strategy.heuristics = updated.heuristics;
    strategy.systemPrompt = updated.systemPrompt;

    this.log(`Gradient applied (magnitude: ${gradient.magnitude.toFixed(2)})`, 'learn');
  }

  private async tryExtractSkill(goal: Goal, actions: ActionResult[], score: number): Promise<void> {
    const trajectory = actions.map(a => ({
      action: `Use ${a.tool}`,
      tool: a.tool,
      params: a.params,
      result: a.result,
    }));

    const skill = await this.skills.synthesize(goal.description, trajectory, score);
    
    if (skill) {
      this.metrics.skillsExtracted++;
      this.log(`Skill extracted: ${skill.name}`, 'learn');
    }
  }

  private recordTrajectory(goal: Goal, actions: ActionResult[], success: boolean, score: number): void {
    const record: TrajectoryRecord = {
      id: `traj_${this.iteration}_${Date.now()}`,
      goal: goal.description,
      actions: actions.map(a => ({
        tool: a.tool,
        params: a.params,
        result: a.result,
        duration: a.duration,
      })),
      success,
      finalScore: score,
      context: { iteration: this.iteration },
      timestamp: Date.now(),
    };

    this.contrastive.record(record);
  }

  private async checkMilestones(): Promise<void> {
    // Check for learning milestones
    const expSize = this.experience.getBufferSize();
    const qSize = this.experience.getQTableSize();
    const skillCount = this.skills.getTotalSkills();
    const insightCount = this.contrastive.getTotalInsights();

    // Milestone: First 100 experiences
    if (expSize === 100) {
      await this.recordMilestone({
        id: `milestone_exp_${Date.now()}`,
        type: 'strategy_learned',
        description: 'Collected 100 experiences in replay buffer',
        metrics: { before: 0, after: 100 },
        timestamp: Date.now(),
      });
    }

    // Milestone: Q-table growth
    if (qSize > 0 && qSize % 50 === 0 && this.iteration > 10) {
      await this.recordMilestone({
        id: `milestone_q_${Date.now()}`,
        type: 'strategy_learned',
        description: `Q-table grown to ${qSize} state-action pairs`,
        metrics: { before: qSize - 50, after: qSize },
        timestamp: Date.now(),
      });
    }

    // Milestone: Skill extraction
    if (skillCount > 0 && skillCount !== this.metrics.skillsExtracted) {
      await this.recordMilestone({
        id: `milestone_skill_${Date.now()}`,
        type: 'new_insight',
        description: `Extracted ${skillCount} reusable skills`,
        metrics: { before: skillCount - 1, after: skillCount },
        timestamp: Date.now(),
      });
    }
  }

  private async recordMilestone(milestone: Milestone): Promise<void> {
    this.log(`🎯 MILESTONE: ${milestone.description}`, 'milestone');
    this.metrics.milestonesRecorded++;

    if (this.onMilestone) {
      await this.onMilestone(milestone);
    }
  }

  // ============ HELPERS ============

  private inferToolFromStep(step: string): string {
    const stepLower = step.toLowerCase();
    if (stepLower.includes('search')) return 'search';
    if (stepLower.includes('fetch')) return 'fetch';
    if (stepLower.includes('price')) return 'prices';
    if (stepLower.includes('news')) return 'news';
    if (stepLower.includes('wallet')) return 'wallet';
    if (stepLower.includes('weather')) return 'weather';
    return Array.from(this.tools.keys())[0] || 'search';
  }

  private inferParams(toolName: string, goal: Goal, guidance: any): any {
    const params: any = {};

    switch (toolName) {
      case 'search':
        params.query = goal.description;
        params.count = 5;
        break;
      case 'news':
        params.topic = goal.description.split(' ').slice(0, 3).join(' ');
        params.count = 5;
        break;
      case 'prices':
        params.coins = ['bitcoin', 'ethereum', 'solana'];
        break;
      case 'weather':
        params.city = 'San Francisco';
        break;
      default:
        params.query = goal.description;
    }

    return params;
  }

  private initStrategies(): void {
    this.strategies.set('research', {
      id: 'research',
      name: 'Web Research',
      description: 'Search and gather information from the web',
      systemPrompt: 'You are a research agent gathering information.',
      steps: ['Search for relevant information', 'Fetch detailed pages', 'Synthesize findings'],
      heuristics: ['Prefer authoritative sources', 'Cross-reference multiple sources'],
      successRate: 0.5,
      usageCount: 0,
    });

    this.strategies.set('monitor', {
      id: 'monitor',
      name: 'Market Monitor',
      description: 'Track prices and market news',
      systemPrompt: 'You are a market monitoring agent.',
      steps: ['Check current prices', 'Get latest news', 'Identify significant changes'],
      heuristics: ['Focus on large movements', 'Consider volume'],
      successRate: 0.5,
      usageCount: 0,
    });

    this.strategies.set('analyze', {
      id: 'analyze',
      name: 'Data Analyzer',
      description: 'Analyze data and extract patterns',
      systemPrompt: 'You are a data analysis agent.',
      steps: ['Gather data', 'Identify patterns', 'Generate insights'],
      heuristics: ['Look for outliers', 'Consider historical context'],
      successRate: 0.5,
      usageCount: 0,
    });
  }

  private log(message: string, level: string): void {
    if (this.onLog) {
      this.onLog(message, level);
    } else {
      const prefix = {
        system: '[ARIA]',
        info: '[INFO]',
        perceive: '[PERCEIVE]',
        reason: '[REASON]',
        success: '[✓]',
        warning: '[!]',
        error: '[✗]',
        learn: '[LEARN]',
        milestone: '[🎯]',
      }[level] || '[LOG]';
      
      console.log(`${prefix} ${message}`);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ============ PUBLIC API ============

  getMetrics() {
    return {
      ...this.metrics,
      iteration: this.iteration,
      experienceBuffer: this.experience.getBufferSize(),
      qTableSize: this.experience.getQTableSize(),
      epsilon: this.experience.getEpsilon(),
      totalLessons: this.reflexion.getTotalLessons(),
      totalSkills: this.skills.getTotalSkills(),
      totalInsights: this.contrastive.getTotalInsights(),
      winRate: this.contrastive.getWinRate(),
    };
  }

  getStrategies() {
    return Array.from(this.strategies.values());
  }

  getSkills() {
    return this.skills.getAllSkills();
  }

  /**
   * Export full state for persistence
   */
  exportState() {
    return {
      metrics: this.metrics,
      iteration: this.iteration,
      experience: this.experience.export(),
      reflexion: this.reflexion.export(),
      skills: this.skills.export(),
      gradients: this.gradients.export(),
      contrastive: this.contrastive.export(),
      strategies: Array.from(this.strategies.entries()),
    };
  }

  /**
   * Import state from persistence
   */
  importState(state: any): void {
    this.metrics = state.metrics;
    this.iteration = state.iteration;
    this.experience.import(state.experience);
    this.reflexion.import(state.reflexion);
    this.skills.import(state.skills);
    this.gradients.import(state.gradients);
    this.contrastive.import(state.contrastive);
    this.strategies = new Map(state.strategies);
  }
}
