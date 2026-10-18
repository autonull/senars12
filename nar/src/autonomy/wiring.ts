import type { Concept } from '../memory/concept.js';
import type { NAR } from '../nar.js';
import { resolveAutonomyConfig } from './config.js';
import { AutonomyHeartbeat } from './heartbeat.js';
import type { AutonomyPorts } from './types.js';

/**
 * The confidence the curiosity policy ranks on: the concept's best-supported
 * claim. A concept holding no belief is maximally uncertain — confidence 0 —
 * which is exactly the concept worth asking about.
 */
const topConfidence = (concept: Concept): number => {
  let confidence = 0;
  for (const belief of concept.getBeliefs()) {
    const c = belief.truth?.c ?? 0;
    if (c > confidence) confidence = c;
  }
  return confidence;
};

/**
 * Bind the heartbeat to a NAR's kernel, memory and bus (CORE.19 C5.2). Kept out
 * of `nar.ts` so the facade stays under its monolith budget: the wiring names
 * only the public surface it drives.
 */
export const createAutonomyHeartbeat = (nar: NAR): AutonomyHeartbeat =>
  new AutonomyHeartbeat(resolveAutonomyConfig(nar.getConfig().autonomy), {
    cycle: () => nar.getCycleCount(),
    now: () => nar.getConfig().clock?.() ?? Date.now(),
    step: () => nar.step(),
    pressure: () => nar.memory.capacityPressure(),
    conceptCount: () => nar.listConcepts().length,
    observations: () =>
      nar.listConcepts().map((concept) => ({
        term: concept.term.toString(),
        confidence: topConfidence(concept),
        priority: concept.priority,
      })),
    admitQuestion: (narsese, correlationId) =>
      nar.input(narsese, 'question', undefined, correlationId),
    consolidate: (cycle) => nar.memory.consolidate({ cycleCount: cycle }),
    evictionReport: () => nar.memory.evictionReport(),
    emit: (event, data) => {
      nar.getEventBus().emit(event, data);
    },
  });
