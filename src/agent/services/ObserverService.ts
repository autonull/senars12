/**
 * ObserverService - Cognitive observation service
 *
 * Migrated from: src/nar/cognitive/Observer.ts
 */

import type {NAR} from '../../nar/nar.js';
import type {LMClient} from '../../nar/lm/types.js';
import type {Term} from '../../nar/terms/types.js';
import {EventBus} from '../../nar/types/events.js';

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
    const contradictions = this.countContradictions(beliefs);
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
    const conflicts = this.findConflicts(beliefs);
    if (conflicts.length === 0) return 'No conflicts detected.';

    return `I found ${conflicts.length} conflict(s): ` +
      conflicts.slice(0, 3).map(c =>
        `${c.a} conflicts with ${c.b}`,
      ).join('; ') +
      (conflicts.length > 3 ? ` and ${conflicts.length - 3} more.` : '');
  }

  private resolveConflicts(nar: NAR): void {
    const beliefs = nar.getBeliefs();
    const conflicts = this.findConflicts(beliefs);
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
        c !== concept && this.termOverlap(termStr, c.term.toString()),
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

  private countContradictions(beliefs: Array<{ term: { toString(): string }; truth?: { f: number; c: number } }>): number {
    const termMap = new Map<string, Array<{ f: number; c: number }>>();
    for (const b of beliefs) {
      if (!b.truth) continue;
      const key = b.term.toString();
      const list = termMap.get(key) ?? [];
      list.push({ f: b.truth.f, c: b.truth.c });
      termMap.set(key, list);
    }

    let count = 0;
    for (const [, truths] of termMap) {
      for (let i = 0; i < truths.length; i++) {
        for (let j = i + 1; j < truths.length; j++) {
          const ti = truths[i];
          const tj = truths[j];
          if (ti && tj && Math.abs(ti.f - tj.f) > 0.3) count++;
        }
      }
    }
    return count;
  }

  private findConflicts(beliefs: Array<{ term: { toString(): string }; truth?: { f: number; c: number } }>): Array<{ a: Term; b: Term }> {
    const termMap = new Map<string, Array<{ term: Term; f: number }>>();
    for (const b of beliefs) {
      if (!b.truth) continue;
      const term = b.term as unknown as Term;
      const key = term.toString();
      const list = termMap.get(key) ?? [];
      list.push({ term, f: b.truth.f });
      termMap.set(key, list);
    }

    const conflicts: Array<{ a: Term; b: Term }> = [];
    for (const [, truths] of termMap) {
      for (let i = 0; i < truths.length; i++) {
        for (let j = i + 1; j < truths.length; j++) {
          const ti = truths[i];
          const tj = truths[j];
          if (ti && tj && Math.abs(ti.f - tj.f) > 0.3) {
            conflicts.push({ a: ti.term, b: tj.term });
          }
        }
      }
    }
    return conflicts;
  }

  private termOverlap(a: string, b: string): number {
    const aWords = new Set(a.toLowerCase().split(/[\s_()\[\]<>\-\/=>]+/).filter(Boolean));
    const bWords = new Set(b.toLowerCase().split(/[\s_()\[\]<>\-\/=>]+/).filter(Boolean));
    if (aWords.size === 0 || bWords.size === 0) return 0;
    let overlap = 0;
    for (const w of aWords) {
      if (bWords.has(w)) overlap++;
    }
    return overlap / Math.max(aWords.size, bWords.size);
  }
}
