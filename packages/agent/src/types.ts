/**
 * ARIA - Autonomous Reflective Intelligence Agent
 * Core type definitions
 */

// ============ PERCEPTION ============
export interface Observation {
  source: 'chain' | 'web' | 'news' | 'prices' | 'custom';
  timestamp: number;
  data: unknown;
  relevance?: number;  // 0-1 how relevant to current goals
}

export interface PerceptionResult {
  observations: Observation[];
  summary: string;
  anomalies: string[];  // Unusual patterns detected
}

// ============ REASONING ============
export interface Goal {
  id: string;
  description: string;
  priority: number;  // 1-10
  deadline?: number;
  progress: number;  // 0-100
  status: 'active' | 'completed' | 'failed' | 'paused';
  subgoals?: Goal[];
}

export interface Strategy {
  id: string;
  name: string;
  description: string;
  successRate: number;  // 0-1
  usageCount: number;
  lastUsed: number;
  context: string[];  // When to use this strategy
  steps: string[];
}

export interface Plan {
  goalId: string;
  strategy: Strategy;
  actions: PlannedAction[];
  expectedOutcome: string;
  confidence: number;  // 0-1
  reasoning: string;
}

export interface PlannedAction {
  tool: string;
  params: Record<string, unknown>;
  purpose: string;
  fallback?: PlannedAction;
}

// ============ ACTION ============
export interface ActionResult {
  action: PlannedAction;
  success: boolean;
  output: unknown;
  error?: string;
  duration: number;
  timestamp: number;
}

export interface ExecutionResult {
  plan: Plan;
  actions: ActionResult[];
  overallSuccess: boolean;
  summary: string;
}

// ============ REFLECTION ============
export interface Reflection {
  planId: string;
  outcome: ExecutionResult;
  score: number;  // 0-1 how well did it go
  expectedVsActual: string;
  whatWorked: string[];
  whatFailed: string[];
  suggestions: string[];
  learnings: Learning[];
  shouldUpdateStrategy: boolean;
}

export interface Learning {
  type: 'insight' | 'pattern' | 'correction' | 'optimization';
  content: string;
  confidence: number;
  applicableTo: string[];  // goal types or contexts
}

// ============ MEMORY ============
export interface Memory {
  goals: Goal[];
  strategies: Strategy[];
  learnings: Learning[];
  reflections: ReflectionSummary[];
  metrics: AgentMetrics;
}

export interface ReflectionSummary {
  timestamp: number;
  goalId: string;
  strategyId: string;
  score: number;
  keyLearning: string;
}

export interface AgentMetrics {
  totalActions: number;
  successfulActions: number;
  successRate: number;
  avgReflectionScore: number;
  strategiesLearned: number;
  milestonesRecorded: number;
  startTime: number;
  lastActive: number;
}

// ============ MILESTONES (On-chain) ============
export interface Milestone {
  id: string;
  type: 'strategy_learned' | 'goal_completed' | 'success_rate_improved' | 'new_insight';
  description: string;
  metrics: {
    before: number;
    after: number;
  };
  timestamp: number;
  txSignature?: string;  // Solana tx
}

// ============ AGENT CONFIG ============
export interface ARIAConfig {
  name: string;
  goals: Goal[];
  reflectionThreshold: number;  // Score below this triggers strategy update
  learningRate: number;  // How aggressively to update strategies
  milestoneThreshold: number;  // Improvement needed to record milestone
  tools: string[];  // Available tools
  solanaRpc?: string;
  walletPath?: string;
}
