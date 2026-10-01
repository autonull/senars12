/**
 * Cycle-path ports: capabilities the core *needs*, named without naming who
 * provides them.
 *
 * A port here is an interface the core declares and the composition root
 * satisfies. It exists so that a core-side module can name what it needs without
 * importing the induction layer to learn the name — the boundary TODO29.a §5.2
 * turns from a lint rule into a structural fact.
 */

export {
  askSafely,
  DECISION_ASK_TIMEOUT_MS,
  type CycleDecisionRequest,
  type DecisionAxis,
  type DecisionPort,
  type DecisionPosition,
  type DecisionRequest,
  type DecisionResult,
  NO_DECISION_PORT,
} from './decision.js';
export type { TextGenerator, TextGenerationOptions } from './text-generator.js';