/**
 * Skill Synthesis - Extract Successful Approaches as Reusable Skills
 * 
 * When the agent succeeds at a task, extract the successful approach
 * as a composable "skill" that can be reused for similar tasks.
 */

export interface Skill {
  id: string;
  name: string;
  description: string;
  
  // When to use this skill
  preconditions: {
    goalPatterns: string[];      // Regex patterns for matching goals
    requiredTools: string[];     // Tools needed
    contextIndicators: string[]; // Keywords that suggest this skill
  };
  
  // How to execute
  steps: Array<{
    action: string;
    tool: string;
    paramTemplate: Record<string, string>;  // Parameterized templates
    expectedOutcome: string;
  }>;
  
  // Expected results
  postconditions: {
    successIndicators: string[];
    expectedOutputFormat: string;
  };
  
  // Metadata
  sourceTrajectory?: string;  // Original trajectory this was extracted from
  successRate: number;
  usageCount: number;
  createdAt: number;
  lastUsed: number;
}

export interface SkillSynthesisConfig {
  llmCall: (prompt: string) => Promise<string>;
  minConfidenceToExtract?: number;
}

export class SkillLibrary {
  private skills: Map<string, Skill> = new Map();
  private llmCall: (prompt: string) => Promise<string>;
  private minConfidence: number;

  constructor(config: SkillSynthesisConfig) {
    this.llmCall = config.llmCall;
    this.minConfidence = config.minConfidenceToExtract || 0.75;
  }

  /**
   * Extract a skill from a successful trajectory
   */
  async synthesize(
    goal: string,
    trajectory: Array<{ action: string; tool: string; params: any; result: any }>,
    confidence: number
  ): Promise<Skill | null> {
    if (confidence < this.minConfidence) {
      return null;
    }

    const prompt = this.buildSynthesisPrompt(goal, trajectory);
    const response = await this.llmCall(prompt);
    
    const skill = this.parseSkill(response, goal, trajectory);
    
    if (skill) {
      this.addSkill(skill);
    }

    return skill;
  }

  /**
   * Find applicable skills for a goal
   */
  findSkillsForGoal(goal: string, availableTools: string[]): Skill[] {
    const matches: Array<{ skill: Skill; score: number }> = [];

    for (const skill of this.skills.values()) {
      const score = this.scoreSkillMatch(skill, goal, availableTools);
      if (score > 0.3) {
        matches.push({ skill, score });
      }
    }

    // Sort by score * success rate
    matches.sort((a, b) => 
      (b.score * b.skill.successRate) - (a.score * a.skill.successRate)
    );

    return matches.map(m => m.skill);
  }

  /**
   * Execute a skill with given parameters
   */
  async executeSkill(
    skill: Skill,
    params: Record<string, any>,
    toolExecutor: (tool: string, params: any) => Promise<any>
  ): Promise<{ success: boolean; results: any[]; error?: string }> {
    const results: any[] = [];
    
    try {
      for (const step of skill.steps) {
        // Fill in parameter templates
        const stepParams = this.fillTemplates(step.paramTemplate, params);
        
        // Execute tool
        const result = await toolExecutor(step.tool, stepParams);
        results.push(result);
      }

      // Update skill stats
      skill.usageCount++;
      skill.lastUsed = Date.now();
      skill.successRate = (skill.successRate * (skill.usageCount - 1) + 1) / skill.usageCount;

      return { success: true, results };
    } catch (error) {
      // Update failure stats
      skill.usageCount++;
      skill.lastUsed = Date.now();
      skill.successRate = (skill.successRate * (skill.usageCount - 1)) / skill.usageCount;

      return { success: false, results, error: (error as Error).message };
    }
  }

  /**
   * Compose multiple skills into a complex skill
   */
  async composeSkills(
    skills: Skill[],
    compositionGoal: string
  ): Promise<Skill | null> {
    if (skills.length < 2) return null;

    const prompt = `You are composing multiple skills into a new combined skill.

GOAL: ${compositionGoal}

SKILLS TO COMPOSE:
${skills.map((s, i) => `
Skill ${i + 1}: ${s.name}
Description: ${s.description}
Steps: ${s.steps.map(st => st.action).join(' → ')}
`).join('\n')}

Create a new combined skill that chains these together effectively.
Output JSON format:
{
  "name": "Combined skill name",
  "description": "What this combined skill does",
  "steps": [{"action": "...", "tool": "...", "paramTemplate": {...}, "expectedOutcome": "..."}],
  "preconditions": {"goalPatterns": [...], "requiredTools": [...], "contextIndicators": [...]},
  "postconditions": {"successIndicators": [...], "expectedOutputFormat": "..."}
}`;

    const response = await this.llmCall(prompt);
    return this.parseSkill(response, compositionGoal, []);
  }

  private buildSynthesisPrompt(
    goal: string,
    trajectory: Array<{ action: string; tool: string; params: any; result: any }>
  ): string {
    const trajectoryText = trajectory.map((t, i) => 
      `Step ${i + 1}: ${t.action}
   Tool: ${t.tool}
   Params: ${JSON.stringify(t.params)}
   Result: ${JSON.stringify(t.result).slice(0, 200)}...`
    ).join('\n\n');

    return `Extract a reusable skill from this successful task execution.

GOAL: ${goal}

SUCCESSFUL TRAJECTORY:
${trajectoryText}

Create a generalized, reusable skill in JSON format:
{
  "name": "Short descriptive name",
  "description": "What this skill accomplishes",
  "preconditions": {
    "goalPatterns": ["regex patterns that match goals this skill handles"],
    "requiredTools": ["tools needed"],
    "contextIndicators": ["keywords suggesting this skill applies"]
  },
  "steps": [
    {
      "action": "What this step does",
      "tool": "tool_name",
      "paramTemplate": {"param": "{{variable}}"},
      "expectedOutcome": "What should happen"
    }
  ],
  "postconditions": {
    "successIndicators": ["how to verify success"],
    "expectedOutputFormat": "description of output"
  }
}

Make the skill GENERALIZABLE - use {{variables}} in paramTemplates.
Respond with ONLY the JSON.`;
  }

  private parseSkill(
    response: string,
    goal: string,
    trajectory: Array<{ action: string; tool: string; params: any; result: any }>
  ): Skill | null {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return null;

      const parsed = JSON.parse(jsonMatch[0]);

      return {
        id: `skill_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        name: parsed.name || 'Unnamed Skill',
        description: parsed.description || goal,
        preconditions: {
          goalPatterns: parsed.preconditions?.goalPatterns || [],
          requiredTools: parsed.preconditions?.requiredTools || [],
          contextIndicators: parsed.preconditions?.contextIndicators || [],
        },
        steps: Array.isArray(parsed.steps) ? parsed.steps : [],
        postconditions: {
          successIndicators: parsed.postconditions?.successIndicators || [],
          expectedOutputFormat: parsed.postconditions?.expectedOutputFormat || '',
        },
        sourceTrajectory: JSON.stringify(trajectory),
        successRate: 1.0,  // Starts at 100% since extracted from success
        usageCount: 0,
        createdAt: Date.now(),
        lastUsed: Date.now(),
      };
    } catch {
      return null;
    }
  }

  private scoreSkillMatch(skill: Skill, goal: string, availableTools: string[]): number {
    let score = 0;
    const goalLower = goal.toLowerCase();

    // Check goal patterns
    for (const pattern of skill.preconditions.goalPatterns) {
      try {
        if (new RegExp(pattern, 'i').test(goal)) {
          score += 0.4;
          break;
        }
      } catch {
        // Invalid regex, check as substring
        if (goalLower.includes(pattern.toLowerCase())) {
          score += 0.3;
          break;
        }
      }
    }

    // Check context indicators
    for (const indicator of skill.preconditions.contextIndicators) {
      if (goalLower.includes(indicator.toLowerCase())) {
        score += 0.1;
      }
    }

    // Check tool availability
    const requiredTools = skill.preconditions.requiredTools;
    const hasAllTools = requiredTools.every(t => availableTools.includes(t));
    if (hasAllTools) {
      score += 0.3;
    } else {
      score *= 0.5; // Penalize if missing tools
    }

    return Math.min(1, score);
  }

  private fillTemplates(
    template: Record<string, string>,
    params: Record<string, any>
  ): Record<string, any> {
    const filled: Record<string, any> = {};

    for (const [key, value] of Object.entries(template)) {
      if (typeof value === 'string' && value.startsWith('{{') && value.endsWith('}}')) {
        const paramName = value.slice(2, -2);
        filled[key] = params[paramName] ?? value;
      } else {
        filled[key] = value;
      }
    }

    return filled;
  }

  // CRUD operations
  addSkill(skill: Skill): void {
    this.skills.set(skill.id, skill);
  }

  getSkill(id: string): Skill | undefined {
    return this.skills.get(id);
  }

  getAllSkills(): Skill[] {
    return Array.from(this.skills.values());
  }

  removeSkill(id: string): boolean {
    return this.skills.delete(id);
  }

  // Metrics
  getTotalSkills(): number {
    return this.skills.size;
  }

  getMostUsedSkills(n: number = 5): Skill[] {
    return this.getAllSkills()
      .sort((a, b) => b.usageCount - a.usageCount)
      .slice(0, n);
  }

  getMostSuccessfulSkills(n: number = 5): Skill[] {
    return this.getAllSkills()
      .filter(s => s.usageCount >= 3) // Min usage for meaningful rate
      .sort((a, b) => b.successRate - a.successRate)
      .slice(0, n);
  }

  /**
   * Export for persistence
   */
  export(): Skill[] {
    return this.getAllSkills();
  }

  /**
   * Import from persistence
   */
  import(skills: Skill[]): void {
    for (const skill of skills) {
      this.skills.set(skill.id, skill);
    }
  }
}
