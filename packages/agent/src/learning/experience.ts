/**
 * Experience Replay Buffer + TD Learning
 * 
 * Classic RL technique: store experiences, sample batches,
 * update Q-values using temporal difference learning.
 */

export interface Experience {
  state: string;           // Serialized state representation
  action: string;          // Action taken
  reward: number;          // Outcome reward (-1 to 1)
  nextState: string;       // Resulting state
  metadata: {
    goalId: string;
    strategyId: string;
    timestamp: number;
  };
}

export interface QTable {
  [state: string]: {
    [action: string]: number;  // Q-value
  };
}

export class ExperienceReplay {
  private buffer: Experience[] = [];
  private maxSize: number;
  private qTable: QTable = {};
  
  // Hyperparameters
  private alpha: number;    // Learning rate
  private gamma: number;    // Discount factor
  private epsilon: number;  // Exploration rate

  constructor(config: {
    maxSize?: number;
    alpha?: number;
    gamma?: number;
    epsilon?: number;
  } = {}) {
    this.maxSize = config.maxSize || 10000;
    this.alpha = config.alpha || 0.1;
    this.gamma = config.gamma || 0.95;
    this.epsilon = config.epsilon || 0.2;
  }

  /**
   * Store an experience in the replay buffer
   */
  store(experience: Experience): void {
    this.buffer.push(experience);
    
    // Remove oldest if over capacity
    if (this.buffer.length > this.maxSize) {
      this.buffer.shift();
    }

    // Initialize Q-values if needed
    if (!this.qTable[experience.state]) {
      this.qTable[experience.state] = {};
    }
    if (this.qTable[experience.state][experience.action] === undefined) {
      this.qTable[experience.state][experience.action] = 0;
    }
  }

  /**
   * Sample a batch of experiences for training
   */
  sample(batchSize: number): Experience[] {
    if (this.buffer.length <= batchSize) {
      return [...this.buffer];
    }

    const sampled: Experience[] = [];
    const indices = new Set<number>();

    while (sampled.length < batchSize) {
      const idx = Math.floor(Math.random() * this.buffer.length);
      if (!indices.has(idx)) {
        indices.add(idx);
        sampled.push(this.buffer[idx]);
      }
    }

    return sampled;
  }

  /**
   * Prioritized sampling - favor experiences with high TD error
   */
  samplePrioritized(batchSize: number): Experience[] {
    if (this.buffer.length <= batchSize) {
      return [...this.buffer];
    }

    // Calculate TD errors as priorities
    const priorities = this.buffer.map(exp => {
      const currentQ = this.getQ(exp.state, exp.action);
      const maxNextQ = this.getMaxQ(exp.nextState);
      const target = exp.reward + this.gamma * maxNextQ;
      return Math.abs(target - currentQ) + 0.01; // Small epsilon to avoid zero
    });

    const totalPriority = priorities.reduce((a, b) => a + b, 0);
    const sampled: Experience[] = [];

    while (sampled.length < batchSize) {
      let random = Math.random() * totalPriority;
      for (let i = 0; i < this.buffer.length; i++) {
        random -= priorities[i];
        if (random <= 0) {
          sampled.push(this.buffer[i]);
          break;
        }
      }
    }

    return sampled;
  }

  /**
   * Update Q-values using TD learning
   */
  update(batchSize: number = 32): { avgTdError: number; updatedStates: number } {
    const batch = this.samplePrioritized(batchSize);
    let totalTdError = 0;
    const updatedStates = new Set<string>();

    for (const exp of batch) {
      // TD Target: r + γ * max_a'(Q(s', a'))
      const maxNextQ = this.getMaxQ(exp.nextState);
      const target = exp.reward + this.gamma * maxNextQ;

      // Current Q-value
      const currentQ = this.getQ(exp.state, exp.action);

      // TD Error
      const tdError = target - currentQ;
      totalTdError += Math.abs(tdError);

      // Update Q-value: Q(s,a) = Q(s,a) + α * (target - Q(s,a))
      this.setQ(
        exp.state,
        exp.action,
        currentQ + this.alpha * tdError
      );

      updatedStates.add(exp.state);
    }

    return {
      avgTdError: batch.length > 0 ? totalTdError / batch.length : 0,
      updatedStates: updatedStates.size,
    };
  }

  /**
   * Select action using epsilon-greedy policy
   */
  selectAction(state: string, availableActions: string[]): {
    action: string;
    isExploration: boolean;
    qValue: number;
  } {
    // Exploration
    if (Math.random() < this.epsilon) {
      const action = availableActions[Math.floor(Math.random() * availableActions.length)];
      return {
        action,
        isExploration: true,
        qValue: this.getQ(state, action),
      };
    }

    // Exploitation - pick best known action
    let bestAction = availableActions[0];
    let bestQ = this.getQ(state, bestAction);

    for (const action of availableActions) {
      const q = this.getQ(state, action);
      if (q > bestQ) {
        bestQ = q;
        bestAction = action;
      }
    }

    return {
      action: bestAction,
      isExploration: false,
      qValue: bestQ,
    };
  }

  /**
   * Decay exploration rate over time
   */
  decayEpsilon(minEpsilon: number = 0.05, decayRate: number = 0.995): void {
    this.epsilon = Math.max(minEpsilon, this.epsilon * decayRate);
  }

  // Q-table helpers
  private getQ(state: string, action: string): number {
    return this.qTable[state]?.[action] ?? 0;
  }

  private setQ(state: string, action: string, value: number): void {
    if (!this.qTable[state]) {
      this.qTable[state] = {};
    }
    this.qTable[state][action] = value;
  }

  private getMaxQ(state: string): number {
    const stateActions = this.qTable[state];
    if (!stateActions) return 0;
    
    const values = Object.values(stateActions);
    return values.length > 0 ? Math.max(...values) : 0;
  }

  // Getters for metrics
  getBufferSize(): number {
    return this.buffer.length;
  }

  getQTableSize(): number {
    return Object.keys(this.qTable).length;
  }

  getEpsilon(): number {
    return this.epsilon;
  }

  getQTable(): QTable {
    return { ...this.qTable };
  }

  /**
   * Export for persistence
   */
  export(): { buffer: Experience[]; qTable: QTable; epsilon: number } {
    return {
      buffer: [...this.buffer],
      qTable: { ...this.qTable },
      epsilon: this.epsilon,
    };
  }

  /**
   * Import from persistence
   */
  import(data: { buffer: Experience[]; qTable: QTable; epsilon: number }): void {
    this.buffer = data.buffer;
    this.qTable = data.qTable;
    this.epsilon = data.epsilon;
  }
}
