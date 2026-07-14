import { Capability } from '@senars/core/capability';

export const NAR_CAPABILITIES: ReadonlySet<Capability> = new Set([
  Capability.Inheritance,
  Capability.Implication,
  Capability.Prediction,
  Capability.Retrospection,
  Capability.Conjunction,
  Capability.Disjunction,
  Capability.Negation,
  Capability.Abduction,
  Capability.Deduction,
  Capability.Induction,
  Capability.Analogy,
  Capability.TruthRevision,
  Capability.DriveManagement,
  Capability.GoalManagement,
  Capability.EpisodicMemory,
  Capability.WorkingMemory,
  Capability.SelfReasoning,
  Capability.AutonomyLoop,
  Capability.ToolUse,
  Capability.LLMCompletion,
]);