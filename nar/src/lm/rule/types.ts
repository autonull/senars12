export interface LMContext {
  memorySnapshot?: string;
  relatedBeliefs?: string[];
  recentDerivations?: string[];
  activeGoals?: string[];
  confidence?: number;
  conceptPriority?: number;
  taskTerm?: string;
  secondaryTerm?: string;
  taskType?: string;
  driveState?: Record<string, number>;
  conflictCount?: number;
  memoryPressure?: number;
  totalConcepts?: number;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings?: string[];
}
