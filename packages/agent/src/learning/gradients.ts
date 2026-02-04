/**
 * Textual Gradients - LLM-Computed Strategy Updates
 * 
 * Inspired by "Self-Evolving Agents" (Jan 2026) paper.
 * Instead of numeric gradients, use LLM to compute "what should change"
 * in natural language, then apply these as strategy modifications.
 */

export interface Strategy {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  steps: string[];
  heuristics: string[];
  successRate: number;
}

export interface TextualGradient {
  strategyId: string;
  performanceData: {
    successRate: number;
    recentOutcomes: Array<{ success: boolean; context: string }>;
  };
  modifications: {
    addHeuristics: string[];
    removeHeuristics: string[];
    modifySteps: Array<{ original: string; modified: string }>;
    promptAdjustments: string[];
  };
  reasoning: string;
  magnitude: number;  // 0-1, how much to change
  timestamp: number;
}

export interface GradientConfig {
  llmCall: (prompt: string) => Promise<string>;
  learningRate?: number;  // How aggressively to apply gradients
}

export class TextualGradientEngine {
  private llmCall: (prompt: string) => Promise<string>;
  private learningRate: number;
  private gradientHistory: TextualGradient[] = [];

  constructor(config: GradientConfig) {
    this.llmCall = config.llmCall;
    this.learningRate = config.learningRate || 0.5;
  }

  /**
   * Compute a textual gradient for a strategy
   */
  async computeGradient(
    strategy: Strategy,
    recentOutcomes: Array<{ success: boolean; context: string; feedback?: string }>
  ): Promise<TextualGradient> {
    const prompt = this.buildGradientPrompt(strategy, recentOutcomes);
    const response = await this.llmCall(prompt);
    
    const gradient = this.parseGradient(strategy.id, response, recentOutcomes);
    this.gradientHistory.push(gradient);
    
    return gradient;
  }

  /**
   * Apply a textual gradient to a strategy
   */
  applyGradient(strategy: Strategy, gradient: TextualGradient): Strategy {
    const updated = { ...strategy };
    const effectiveLR = this.learningRate * gradient.magnitude;

    // Apply heuristic additions (probabilistically based on learning rate)
    for (const heuristic of gradient.modifications.addHeuristics) {
      if (Math.random() < effectiveLR && !updated.heuristics.includes(heuristic)) {
        updated.heuristics.push(heuristic);
      }
    }

    // Apply heuristic removals
    for (const heuristic of gradient.modifications.removeHeuristics) {
      if (Math.random() < effectiveLR) {
        updated.heuristics = updated.heuristics.filter(h => h !== heuristic);
      }
    }

    // Apply step modifications
    for (const mod of gradient.modifications.modifySteps) {
      if (Math.random() < effectiveLR) {
        const idx = updated.steps.indexOf(mod.original);
        if (idx !== -1) {
          updated.steps[idx] = mod.modified;
        }
      }
    }

    // Apply prompt adjustments
    if (gradient.modifications.promptAdjustments.length > 0 && Math.random() < effectiveLR) {
      const adjustment = gradient.modifications.promptAdjustments[0];
      updated.systemPrompt = this.integratePromptAdjustment(
        updated.systemPrompt,
        adjustment
      );
    }

    return updated;
  }

  /**
   * Compute and immediately apply gradient
   */
  async updateStrategy(
    strategy: Strategy,
    recentOutcomes: Array<{ success: boolean; context: string; feedback?: string }>
  ): Promise<{ updated: Strategy; gradient: TextualGradient }> {
    const gradient = await this.computeGradient(strategy, recentOutcomes);
    const updated = this.applyGradient(strategy, gradient);
    return { updated, gradient };
  }

  private buildGradientPrompt(
    strategy: Strategy,
    outcomes: Array<{ success: boolean; context: string; feedback?: string }>
  ): string {
    const successRate = outcomes.filter(o => o.success).length / outcomes.length;
    
    const outcomesText = outcomes.map((o, i) => 
      `${i + 1}. ${o.success ? '✓ SUCCESS' : '✗ FAILURE'}: ${o.context}${o.feedback ? `\n   Feedback: ${o.feedback}` : ''}`
    ).join('\n');

    return `You are optimizing an AI agent's strategy through textual gradients.

CURRENT STRATEGY:
Name: ${strategy.name}
Description: ${strategy.description}
System Prompt: ${strategy.systemPrompt}
Steps: ${strategy.steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}
Heuristics: ${strategy.heuristics.join('; ')}

RECENT PERFORMANCE (${(successRate * 100).toFixed(0)}% success rate):
${outcomesText}

Compute a "textual gradient" - specific modifications to improve this strategy.
Consider:
- What patterns appear in failures?
- What's working well that should be reinforced?
- What heuristics are missing or wrong?
- How should the approach change?

Output JSON format:
{
  "reasoning": "Your analysis of what needs to change",
  "magnitude": 0.0-1.0,
  "modifications": {
    "addHeuristics": ["New heuristic to add"],
    "removeHeuristics": ["Heuristic to remove"],
    "modifySteps": [{"original": "old step", "modified": "improved step"}],
    "promptAdjustments": ["Adjustment to add to system prompt"]
  }
}

Be specific and actionable. Magnitude should reflect how much change is needed (low success = high magnitude).
Respond with ONLY the JSON.`;
  }

  private parseGradient(
    strategyId: string,
    response: string,
    outcomes: Array<{ success: boolean; context: string }>
  ): TextualGradient {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON found');
      
      const parsed = JSON.parse(jsonMatch[0]);
      const successRate = outcomes.filter(o => o.success).length / outcomes.length;

      return {
        strategyId,
        performanceData: {
          successRate,
          recentOutcomes: outcomes,
        },
        modifications: {
          addHeuristics: parsed.modifications?.addHeuristics || [],
          removeHeuristics: parsed.modifications?.removeHeuristics || [],
          modifySteps: parsed.modifications?.modifySteps || [],
          promptAdjustments: parsed.modifications?.promptAdjustments || [],
        },
        reasoning: parsed.reasoning || 'No reasoning provided',
        magnitude: typeof parsed.magnitude === 'number' 
          ? Math.max(0, Math.min(1, parsed.magnitude))
          : 1 - successRate,  // Default: inverse of success rate
        timestamp: Date.now(),
      };
    } catch {
      // Fallback gradient
      const successRate = outcomes.filter(o => o.success).length / outcomes.length;
      return {
        strategyId,
        performanceData: { successRate, recentOutcomes: outcomes },
        modifications: {
          addHeuristics: [],
          removeHeuristics: [],
          modifySteps: [],
          promptAdjustments: [],
        },
        reasoning: 'Failed to parse gradient',
        magnitude: 0.1,
        timestamp: Date.now(),
      };
    }
  }

  private integratePromptAdjustment(prompt: string, adjustment: string): string {
    // Add adjustment as a new line in the prompt
    if (prompt.includes('HEURISTICS:')) {
      return prompt.replace('HEURISTICS:', `HEURISTICS:\n- ${adjustment}`);
    }
    return `${prompt}\n\nADDITIONAL GUIDANCE:\n- ${adjustment}`;
  }

  // Metrics
  getGradientHistory(): TextualGradient[] {
    return [...this.gradientHistory];
  }

  getAverageMagnitude(): number {
    if (this.gradientHistory.length === 0) return 0;
    return this.gradientHistory.reduce((sum, g) => sum + g.magnitude, 0) / this.gradientHistory.length;
  }

  /**
   * Export for persistence
   */
  export(): TextualGradient[] {
    return this.gradientHistory;
  }

  /**
   * Import from persistence
   */
  import(gradients: TextualGradient[]): void {
    this.gradientHistory = gradients;
  }
}
