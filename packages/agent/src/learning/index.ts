/**
 * ARIA Learning Module
 * 
 * ML-inspired techniques for autonomous agent improvement:
 * - Experience Replay + TD Learning (classic RL)
 * - Reflexion (LLM self-critique)
 * - Skill Synthesis (extract reusable skills)
 * - Textual Gradients (LLM-computed updates)
 * - Contrastive Learning (learn from success/failure pairs)
 */

export { ExperienceReplay, type Experience, type QTable } from './experience.js';
export { ReflexionEngine, type Reflection, type Trajectory } from './reflexion.js';
export { SkillLibrary, type Skill } from './skills.js';
export { TextualGradientEngine, type TextualGradient, type Strategy as GradientStrategy } from './gradients.js';
export { ContrastiveLearner, type ContrastiveInsight, type TrajectoryRecord } from './contrastive.js';

/**
 * Create a fully-configured learning stack
 */
export function createLearningStack(config: {
  llmCall: (prompt: string) => Promise<string>;
  experienceConfig?: {
    maxSize?: number;
    alpha?: number;
    gamma?: number;
    epsilon?: number;
  };
}) {
  const { ExperienceReplay } = require('./experience.js');
  const { ReflexionEngine } = require('./reflexion.js');
  const { SkillLibrary } = require('./skills.js');
  const { TextualGradientEngine } = require('./gradients.js');
  const { ContrastiveLearner } = require('./contrastive.js');

  return {
    experience: new ExperienceReplay(config.experienceConfig || {}),
    reflexion: new ReflexionEngine({ llmCall: config.llmCall }),
    skills: new SkillLibrary({ llmCall: config.llmCall }),
    gradients: new TextualGradientEngine({ llmCall: config.llmCall }),
    contrastive: new ContrastiveLearner({ llmCall: config.llmCall }),
  };
}
