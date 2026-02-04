/**
 * Contrastive Self-Improvement
 * 
 * Compare successful vs failed trajectories to extract
 * what made the difference. Learn from contrasts.
 */

export interface TrajectoryRecord {
  id: string;
  goal: string;
  actions: Array<{
    tool: string;
    params: any;
    result: any;
    duration: number;
  }>;
  success: boolean;
  finalScore: number;
  context: Record<string, any>;
  timestamp: number;
}

export interface ContrastiveInsight {
  id: string;
  winningTrajectory: string;  // ID
  losingTrajectory: string;   // ID
  goalSimilarity: number;
  
  differences: {
    toolUsage: string[];      // "Winner used X, loser didn't"
    parameterChoices: string[];
    sequencing: string[];     // Order differences
    contextFactors: string[];
  };
  
  insight: string;            // Natural language learning
  applicability: string[];    // When to apply this insight
  confidence: number;
  timestamp: number;
}

export interface ContrastiveConfig {
  llmCall: (prompt: string) => Promise<string>;
  minSimilarityForComparison?: number;
}

export class ContrastiveLearner {
  private llmCall: (prompt: string) => Promise<string>;
  private trajectories: Map<string, TrajectoryRecord> = new Map();
  private insights: ContrastiveInsight[] = [];
  private minSimilarity: number;

  constructor(config: ContrastiveConfig) {
    this.llmCall = config.llmCall;
    this.minSimilarity = config.minSimilarityForComparison || 0.5;
  }

  /**
   * Record a trajectory
   */
  record(trajectory: TrajectoryRecord): void {
    this.trajectories.set(trajectory.id, trajectory);
  }

  /**
   * Find and compare contrasting trajectories
   */
  async learnFromContrasts(maxComparisons: number = 5): Promise<ContrastiveInsight[]> {
    const newInsights: ContrastiveInsight[] = [];
    const pairs = this.findContrastingPairs(maxComparisons);

    for (const [winner, loser] of pairs) {
      const insight = await this.compare(winner, loser);
      if (insight && insight.confidence > 0.5) {
        this.insights.push(insight);
        newInsights.push(insight);
      }
    }

    return newInsights;
  }

  /**
   * Compare a winning and losing trajectory
   */
  async compare(
    winner: TrajectoryRecord,
    loser: TrajectoryRecord
  ): Promise<ContrastiveInsight | null> {
    const prompt = this.buildComparisonPrompt(winner, loser);
    const response = await this.llmCall(prompt);
    
    return this.parseInsight(winner.id, loser.id, response);
  }

  /**
   * Get insights applicable to a goal
   */
  getInsightsForGoal(goal: string): ContrastiveInsight[] {
    const goalLower = goal.toLowerCase();
    
    return this.insights.filter(insight => {
      // Check if any applicability keyword matches
      return insight.applicability.some(app => 
        goalLower.includes(app.toLowerCase()) ||
        app.toLowerCase().includes(goalLower.split(' ')[0])
      );
    });
  }

  /**
   * Generate guidance based on contrastive insights
   */
  generateGuidance(goal: string): string[] {
    const relevant = this.getInsightsForGoal(goal);
    
    if (relevant.length === 0) return [];

    // Sort by confidence and recency
    const sorted = relevant.sort((a, b) => {
      const scoreA = a.confidence + (a.timestamp / Date.now());
      const scoreB = b.confidence + (b.timestamp / Date.now());
      return scoreB - scoreA;
    });

    // Return top insights as guidance
    return sorted.slice(0, 5).map(i => i.insight);
  }

  private findContrastingPairs(maxPairs: number): Array<[TrajectoryRecord, TrajectoryRecord]> {
    const pairs: Array<[TrajectoryRecord, TrajectoryRecord]> = [];
    const trajectoryList = Array.from(this.trajectories.values());
    
    const winners = trajectoryList.filter(t => t.success);
    const losers = trajectoryList.filter(t => !t.success);

    for (const winner of winners) {
      for (const loser of losers) {
        const similarity = this.computeGoalSimilarity(winner.goal, loser.goal);
        
        if (similarity >= this.minSimilarity) {
          pairs.push([winner, loser]);
          
          if (pairs.length >= maxPairs) {
            return pairs;
          }
        }
      }
    }

    return pairs;
  }

  private computeGoalSimilarity(goal1: string, goal2: string): number {
    const words1 = new Set(goal1.toLowerCase().split(/\W+/).filter(w => w.length > 2));
    const words2 = new Set(goal2.toLowerCase().split(/\W+/).filter(w => w.length > 2));
    
    let overlap = 0;
    for (const word of words1) {
      if (words2.has(word)) overlap++;
    }

    const union = new Set([...words1, ...words2]).size;
    return union > 0 ? overlap / union : 0;
  }

  private buildComparisonPrompt(
    winner: TrajectoryRecord,
    loser: TrajectoryRecord
  ): string {
    const formatTrajectory = (t: TrajectoryRecord) => 
      t.actions.map((a, i) => 
        `  ${i + 1}. Tool: ${a.tool}, Params: ${JSON.stringify(a.params).slice(0, 100)}, Result: ${a.result ? 'OK' : 'FAIL'}`
      ).join('\n');

    return `Compare these two attempts at similar goals to understand what made one succeed and one fail.

SUCCESSFUL ATTEMPT:
Goal: ${winner.goal}
Score: ${winner.finalScore}
Actions:
${formatTrajectory(winner)}

FAILED ATTEMPT:
Goal: ${loser.goal}
Score: ${loser.finalScore}
Actions:
${formatTrajectory(loser)}

Analyze the differences and extract a learnable insight.

Output JSON format:
{
  "differences": {
    "toolUsage": ["Observation about tool differences"],
    "parameterChoices": ["Observation about parameter differences"],
    "sequencing": ["Observation about order/sequence differences"],
    "contextFactors": ["Other relevant differences"]
  },
  "insight": "The key learning from this comparison (actionable advice)",
  "applicability": ["Keywords for when this insight applies"],
  "confidence": 0.0-1.0
}

Focus on ACTIONABLE differences that explain the outcome.
Respond with ONLY the JSON.`;
  }

  private parseInsight(
    winnerId: string,
    loserId: string,
    response: string
  ): ContrastiveInsight | null {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return null;

      const parsed = JSON.parse(jsonMatch[0]);

      const winner = this.trajectories.get(winnerId);
      const loser = this.trajectories.get(loserId);
      
      if (!winner || !loser) return null;

      return {
        id: `insight_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        winningTrajectory: winnerId,
        losingTrajectory: loserId,
        goalSimilarity: this.computeGoalSimilarity(winner.goal, loser.goal),
        differences: {
          toolUsage: parsed.differences?.toolUsage || [],
          parameterChoices: parsed.differences?.parameterChoices || [],
          sequencing: parsed.differences?.sequencing || [],
          contextFactors: parsed.differences?.contextFactors || [],
        },
        insight: parsed.insight || 'No insight extracted',
        applicability: parsed.applicability || [],
        confidence: typeof parsed.confidence === 'number'
          ? Math.max(0, Math.min(1, parsed.confidence))
          : 0.5,
        timestamp: Date.now(),
      };
    } catch {
      return null;
    }
  }

  // Metrics
  getTotalTrajectories(): number {
    return this.trajectories.size;
  }

  getTotalInsights(): number {
    return this.insights.length;
  }

  getWinRate(): number {
    const all = Array.from(this.trajectories.values());
    if (all.length === 0) return 0;
    return all.filter(t => t.success).length / all.length;
  }

  /**
   * Export for persistence
   */
  export(): {
    trajectories: TrajectoryRecord[];
    insights: ContrastiveInsight[];
  } {
    return {
      trajectories: Array.from(this.trajectories.values()),
      insights: this.insights,
    };
  }

  /**
   * Import from persistence
   */
  import(data: {
    trajectories: TrajectoryRecord[];
    insights: ContrastiveInsight[];
  }): void {
    for (const t of data.trajectories) {
      this.trajectories.set(t.id, t);
    }
    this.insights = data.insights;
  }
}
