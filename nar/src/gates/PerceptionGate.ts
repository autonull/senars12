import {Focus, FocusTask} from './Focus.js';

export class PerceptionGate {
  constructor(private readonly focus: Focus) {}

  toBeliefs(perception: Focus['games'][0]['observe']): FocusTask[] {
    const beliefs: FocusTask[] = [];
    const now = Date.now();

    const stateBelief: FocusTask = {
      id: `percept-state-${perception.stateId}-${now}`,
      priority: perception.confidence ?? 0.9,
      term: this.stateIdToTerm(perception.stateId),
      type: 'belief',
      truth: { f: 1.0, c: perception.confidence ?? 0.9 },
      budget: { priority: perception.confidence ?? 0.9, durability: 0.8, quality: 0.9, cycles: 0, depth: 0 },
      stamp: `perception-${now}`,
      derived: false,
    };
    beliefs.push(stateBelief);

    if (perception.features) {
      for (const [feature, value] of Object.entries(perception.features)) {
        const featureBelief: FocusTask = {
          id: `percept-feature-${feature}-${now}`,
          priority: Math.abs(value) * (perception.confidence ?? 0.5),
          term: this.featureToTerm(feature, value),
          type: 'belief',
          truth: { f: Math.min(1, Math.abs(value)), c: perception.confidence ?? 0.5 },
          budget: { priority: Math.abs(value), durability: 0.8, quality: 0.9, cycles: 0, depth: 0 },
          stamp: `perception-${now}`,
          derived: false,
        };
        beliefs.push(featureBelief);
      }
    }

    return beliefs;
  }

  private stateIdToTerm(stateId: string): Focus['games'][0]['observe'] extends { stateId: string } ? any : never {
    return { kind: 'atom', value: stateId } as any;
  }

  private featureToTerm(feature: string, value: number): any {
    return {
      kind: 'compound',
      operator: 'feature',
      args: [{ kind: 'atom', value: feature }, { kind: 'atom', value: String(value) }],
    };
  }
}