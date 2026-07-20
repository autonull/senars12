/**
 * Capability snapshot and diff - extracted from SelfAnalyzerService
 */
import type { NAR } from '../../nar.js';
import type { CapabilityDiff, CapabilitySnapshot } from '../types.js';

export const getCapabilitySnapshot = async (nar: NAR | null): Promise<CapabilitySnapshot> => {
  if (!nar) {
    return {
      timestamp: Date.now(),
      activeRules: [],
      activeTools: [],
      lmProviders: [],
      pipelineStages: [],
      memoryState: { concepts: 0, beliefs: 0, episodes: 0 },
    };
  }

  const beliefs = nar.getBeliefs();
  const concepts = nar.listConcepts();

  return {
    timestamp: Date.now(),
    activeRules: ['deduction', 'induction', 'abduction', 'revision', 'analogy'],
    activeTools: ['search', 'read', 'write', 'http'],
    lmProviders: nar.getLMClient ? [nar.getLMClient()?.provider || 'none'] : [],
    pipelineStages: [
      'InputNormalizer',
      'AuthChecker',
      'SeNARSProcessor',
      'LMResponder',
      'ResponseComposer',
    ],
    memoryState: {
      concepts: concepts.length,
      beliefs: beliefs.length,
      episodes: 0,
    },
  };
};

export const diffCapabilities = (
  before: CapabilitySnapshot,
  after: CapabilitySnapshot
): CapabilityDiff => {
  const added: string[] = [];
  const removed: string[] = [];
  const changed: { name: string; before: string; after: string }[] = [];

  for (const rule of after.activeRules) {
    if (!before.activeRules.includes(rule)) added.push(rule);
  }
  for (const rule of before.activeRules) {
    if (!after.activeRules.includes(rule)) removed.push(rule);
  }

  if (after.memoryState.concepts !== before.memoryState.concepts) {
    changed.push({
      name: 'concepts',
      before: String(before.memoryState.concepts),
      after: String(after.memoryState.concepts),
    });
  }
  if (after.memoryState.beliefs !== before.memoryState.beliefs) {
    changed.push({
      name: 'beliefs',
      before: String(before.memoryState.beliefs),
      after: String(after.memoryState.beliefs),
    });
  }

  return { added, removed, changed };
};
