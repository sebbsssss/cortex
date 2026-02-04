/**
 * Reflexion - LLM Self-Critique and Learning
 * 
 * Based on "Reflexion: Language Agents with Verbal Reinforcement Learning"
 * (Shinn et al., 2023)
 * 
 * Key idea: After failure, agent reflects on what went wrong
 * and generates verbal "lessons" that improve future attempts.
 */

export interface Trajectory {
  goal: string;
  actions: Array<{
    thought: string;
    action: string;
    observation: string;
  }>;
  outcome: 'success' | 'failure' | 'partial';
  finalResult: string;
}

export interface Reflection {
  trajectory: Trajectory;
  diagnosis: string;        // What went wrong
  lessons: string[];        // Specific learnings
  corrections: string[];    // What to do differently
  confidence: number;       // How confident in this reflection
  timestamp: number;
}

export interface ReflexionConfig {
  llmCall: (prompt: string) => Promise<string>;
  maxLessons?: number;
  minConfidenceToStore?: number;
}

export class ReflexionEngine {
  private llmCall: (prompt: string) => Promise<string>;
  private lessons: Map<string, string[]> = new Map();  // goalType -> lessons
  private reflections: Reflection[] = [];
  private maxLessons: number;
  private minConfidence: number;

  constructor(config: ReflexionConfig) {
    this.llmCall = config.llmCall;
    this.maxLessons = config.maxLessons || 50;
    this.minConfidence = config.minConfidenceToStore || 0.6;
  }

  /**
   * Generate a reflection from a trajectory
   */
  async reflect(trajectory: Trajectory): Promise<Reflection> {
    const prompt = this.buildReflectionPrompt(trajectory);
    const response = await this.llmCall(prompt);
    
    const reflection = this.parseReflection(trajectory, response);
    
    // Store if confident enough
    if (reflection.confidence >= this.minConfidence) {
      this.storeReflection(reflection);
    }

    return reflection;
  }

  /**
   * Get relevant lessons for a goal
   */
  getLessonsForGoal(goalDescription: string): string[] {
    // Find lessons from similar goals
    const allLessons: string[] = [];
    
    for (const [goalType, lessons] of this.lessons) {
      if (this.isSimilarGoal(goalDescription, goalType)) {
        allLessons.push(...lessons);
      }
    }

    // Return most recent/relevant lessons
    return allLessons.slice(-10);
  }

  /**
   * Build prompt for reflection
   */
  private buildReflectionPrompt(trajectory: Trajectory): string {
    const actionsText = trajectory.actions
      .map((a, i) => `Step ${i + 1}:
  Thought: ${a.thought}
  Action: ${a.action}
  Observation: ${a.observation}`)
      .join('\n\n');

    const existingLessons = this.getLessonsForGoal(trajectory.goal);
    const lessonsContext = existingLessons.length > 0
      ? `\nPrevious lessons learned:\n${existingLessons.map(l => `- ${l}`).join('\n')}`
      : '';

    return `You are an AI agent analyzing your own performance to improve.

GOAL: ${trajectory.goal}

TRAJECTORY:
${actionsText}

OUTCOME: ${trajectory.outcome}
RESULT: ${trajectory.finalResult}
${lessonsContext}

Analyze this trajectory and provide a reflection in the following JSON format:
{
  "diagnosis": "What specifically went wrong or could be improved",
  "lessons": ["Lesson 1", "Lesson 2", ...],
  "corrections": ["What to do differently next time"],
  "confidence": 0.0-1.0
}

Be specific and actionable. Focus on what YOU can control.
Respond with ONLY the JSON, no other text.`;
  }

  /**
   * Parse LLM response into Reflection
   */
  private parseReflection(trajectory: Trajectory, response: string): Reflection {
    try {
      // Extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON found');
      
      const parsed = JSON.parse(jsonMatch[0]);
      
      return {
        trajectory,
        diagnosis: parsed.diagnosis || 'Unknown',
        lessons: Array.isArray(parsed.lessons) ? parsed.lessons : [],
        corrections: Array.isArray(parsed.corrections) ? parsed.corrections : [],
        confidence: typeof parsed.confidence === 'number' 
          ? Math.max(0, Math.min(1, parsed.confidence)) 
          : 0.5,
        timestamp: Date.now(),
      };
    } catch (error) {
      // Fallback reflection
      return {
        trajectory,
        diagnosis: 'Failed to parse reflection',
        lessons: [],
        corrections: [],
        confidence: 0.3,
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Store reflection and extract lessons
   */
  private storeReflection(reflection: Reflection): void {
    this.reflections.push(reflection);
    
    // Extract goal type (first few words)
    const goalType = reflection.trajectory.goal
      .toLowerCase()
      .split(' ')
      .slice(0, 3)
      .join(' ');

    if (!this.lessons.has(goalType)) {
      this.lessons.set(goalType, []);
    }

    const goalLessons = this.lessons.get(goalType)!;
    
    // Add new lessons
    for (const lesson of reflection.lessons) {
      if (!goalLessons.includes(lesson)) {
        goalLessons.push(lesson);
      }
    }

    // Trim to max
    while (goalLessons.length > this.maxLessons) {
      goalLessons.shift();
    }
  }

  /**
   * Check if goals are similar (simple heuristic)
   */
  private isSimilarGoal(goal1: string, goal2: string): boolean {
    const words1 = new Set(goal1.toLowerCase().split(/\W+/));
    const words2 = new Set(goal2.toLowerCase().split(/\W+/));
    
    let overlap = 0;
    for (const word of words1) {
      if (words2.has(word) && word.length > 3) overlap++;
    }

    return overlap >= 2;
  }

  /**
   * Generate enhanced prompt with lessons
   */
  enhancePromptWithLessons(basePrompt: string, goalDescription: string): string {
    const lessons = this.getLessonsForGoal(goalDescription);
    
    if (lessons.length === 0) return basePrompt;

    return `${basePrompt}

LESSONS FROM PAST EXPERIENCE:
${lessons.map(l => `• ${l}`).join('\n')}

Apply these lessons to avoid repeating mistakes.`;
  }

  // Metrics
  getTotalReflections(): number {
    return this.reflections.length;
  }

  getTotalLessons(): number {
    let total = 0;
    for (const lessons of this.lessons.values()) {
      total += lessons.length;
    }
    return total;
  }

  getRecentReflections(n: number = 5): Reflection[] {
    return this.reflections.slice(-n);
  }

  /**
   * Export for persistence
   */
  export(): { lessons: Record<string, string[]>; reflections: Reflection[] } {
    const lessonsObj: Record<string, string[]> = {};
    for (const [key, value] of this.lessons) {
      lessonsObj[key] = value;
    }
    return {
      lessons: lessonsObj,
      reflections: this.reflections,
    };
  }

  /**
   * Import from persistence
   */
  import(data: { lessons: Record<string, string[]>; reflections: Reflection[] }): void {
    this.lessons = new Map(Object.entries(data.lessons));
    this.reflections = data.reflections;
  }
}
