/**
 * ObserverService - Cognitive observation service
 *
 * Migrated from: src/nar/cognitive/Observer.ts
 */

import type {NAR} from '../../nar/nar.js';
import type {LMClient} from '../../nar/lm/types.js';
import {EventBus} from '../../nar/types/events.js';
import {findConflicts, termOverlap, countContradictions as countContradictionsImpl} from './conflict-utils.js';

export type CognitiveState = 'normal' | 'confused' | 'bored' | 'overloaded' | 'idle';
export type CognitiveAction = 'continue' | 'resolve-conflicts' | 'explore' | 'consolidate' | 'suspend';

export interface ObserverReport {
  state: CognitiveState;
  action: CognitiveAction;
  contradictions: number;
  totalConcepts: number;
  memoryPressure: number;
  derivationsPerSecond: number;
  suggestion?: string;
}

export class ObserverService {
  private lmClient: LMClient | null = null;
  private eventBus?: EventBus;

  constructor(eventBus?: EventBus) {
    this.eventBus = eventBus;
  }

  setEventBus(eventBus: EventBus): void {
    this.eventBus = eventBus;
  }

  setLMClient(lm: LMClient | null): void {
    this.lmClient = lm;
  }

  check(nar: NAR): ObserverReport {
    const stats = nar.getStatistics();
    const beliefs = nar.getBeliefs();
    const contradictions = countContradictionsImpl(beliefs);
    const metrics = nar.getMetrics();
    const derivationsPerSecond = metrics.throughput?.derivationsPerSecond ?? 0;

    if (contradictions > stats.totalConcepts * 0.1) {
      return {
        state: 'confused',
        action: 'resolve-conflicts',
        contradictions,
        totalConcepts: stats.totalConcepts,
        memoryPressure: stats.memoryPressure,
        derivationsPerSecond,
        suggestion: 'I have conflicting beliefs that need resolution.',
      };
    }

    if (derivationsPerSecond < 0.01 && stats.totalConcepts > 10) {
      return {
        state: 'bored',
        action: 'explore',
        contradictions,
        totalConcepts: stats.totalConcepts,
        memoryPressure: stats.memoryPressure,
        derivationsPerSecond,
        suggestion: 'I have knowledge but little activity. I should explore connections.',
      };
    }

    if (stats.memoryPressure > 0.9) {
      return {
        state: 'overloaded',
        action: 'consolidate',
        contradictions,
        totalConcepts: stats.totalConcepts,
        memoryPressure: stats.memoryPressure,
        derivationsPerSecond,
        suggestion: 'Memory is nearly full. I should consolidate.',
      };
    }

    return {
      state: 'normal',
      action: 'continue',
      contradictions,
      totalConcepts: stats.totalConcepts,
      memoryPressure: stats.memoryPressure,
      derivationsPerSecond,
    };
  }

  async act(report: ObserverReport, nar: NAR): Promise<void> {
    switch (report.action) {
      case 'resolve-conflicts':
        this.resolveConflicts(nar);
        break;
      case 'explore':
        this.exploreMemory(nar);
        break;
      case 'consolidate':
        if (this.lmClient) {
          const lm = this.lmClient;
          await nar.memory.consolidate({
            lm: {
              generateObject: async (opts: { prompt: string; schema: unknown }) => {
                const text = await lm.generateText(opts.prompt);
                try {
                  return { object: JSON.parse(text) };
                } catch {
                  return { object: { name: text.slice(0, 50), definition: text } };
                }
              },
            },
          });
        } else {
          nar.memory.consolidate();
        }
        break;
    }
  }

  async runCycle(nar: NAR): Promise<ObserverReport> {
    const report = this.check(nar);

    this.eventBus?.emit('cognitive:state-change', {
      oldState: report.state,
      newState: report.state,
      action: report.action
    });

    await this.act(report, nar);
    return report;
  }

reportState(nar: NAR): string {
const report = this.check(nar);
const stateLabels: Record<CognitiveState, string> = {
normal: 'thinking normally',
confused: 'confused - conflicting beliefs',
bored: 'bored - low activity',
overloaded: 'overloaded - memory pressure',
idle: 'idle - not running'
};
    return `I'm ${stateLabels[report.state]}. ` +
      `${report.totalConcepts} concepts, ` +
      `${report.contradictions} conflicts, ` +
      `memory ${(report.memoryPressure * 100).toFixed(0)}% full.` +
      (report.suggestion ? ` ${report.suggestion}` : '');
  }

  reportConflicts(nar: NAR): string {
    const beliefs = nar.getBeliefs();
    const conflicts = findConflicts(beliefs);
    if (conflicts.length === 0) return 'No conflicts detected.';

    return `I found ${conflicts.length} conflict(s): ` +
      conflicts.slice(0, 3).map(c =>
        `${c.a} conflicts with ${c.b}`,
      ).join('; ') +
      (conflicts.length > 3 ? ` and ${conflicts.length - 3} more.` : '');
  }

  private resolveConflicts(nar: NAR): void {
    const beliefs = nar.getBeliefs();
    const conflicts = findConflicts(beliefs);
    for (const conflict of conflicts.slice(0, 5)) {
      const concept = nar.getConcept(conflict.a);
      if (concept) {
        const topBelief = concept.beliefBag.peek();
        if (topBelief?.truth) {
          const topC = topBelief.truth.c;
          concept.beliefBag.removeMany(b => b !== topBelief && (b.truth?.c ?? 0) < topC);
        }
      }
    }
  }

  private exploreMemory(nar: NAR): void {
    const concepts = nar.listConcepts();
    const underconnected = concepts.filter(c => c.getLinks().length < 2).slice(0, 5);
    for (const concept of underconnected) {
      const termStr = concept.term.toString();
      const related = concepts.filter(c =>
        c !== concept && termOverlap(termStr, c.term.toString()),
      ).slice(0, 3);
      for (const r of related) {
        if (!concept.getLinks().some(l => l.concept.term.toString() === r.term.toString())) {
          nar.memory.getLinkManager().addLink(
            concept.term, r.term,
            { type: 'term-link', priority: 0.5 },
          );
        }
      }
    }
  }
}
