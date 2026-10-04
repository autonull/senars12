import { clamp01, minBy } from '@senars/util';
import { containsSubterm, type Term, TermMap } from '../terms';
import type { Task } from '../types';
import type { Concept } from './concept.js';

export interface FocusConfig {
  maxConcepts: number;
}

const DEFAULT_CONFIG: FocusConfig = {
  maxConcepts: 50,
};

/**
 * The concepts attention is currently spent on, bounded by priority.
 *
 * It stores the concepts and nothing else. It used to store a `priority` copy
 * taken at insert time and let `adjustAttention` move that copy, which made a
 * second owner of a quantity `Concept` already owns — one that drifted the
 * moment anything was primed, decayed or restored. Focus *selects* by
 * priority; it does not keep it (TODO29.a §5.4).
 */
export class Focus {
  private concepts: TermMap<Concept> = new TermMap();
  private config: FocusConfig;
  private topicBoosts = new Map<string, { factor: number; ttl: number }>();
  private activeGoals: Task[] = [];

  constructor(config: FocusConfig = DEFAULT_CONFIG) {
    this.config = config;
  }

  get size(): number {
    return this.concepts.size;
  }

  get capacity(): number {
    return this.config.maxConcepts;
  }

  addToFocus(concept: Concept): void {
    if (this.concepts.size >= this.config.maxConcepts && !this.concepts.has(concept.term)) {
      const lowest = minBy(this.concepts, ([, entry]) => entry.priority);
      if (!lowest || lowest[1].priority >= concept.priority) return;
      this.concepts.delete(lowest[0]);
    }
    this.concepts.set(concept.term, concept);
  }

  removeFromFocus(concept: Concept): boolean {
    return this.concepts.delete(concept.term);
  }

  forEachFocus(fn: (concept: Concept) => void): void {
    for (const concept of this.concepts.values()) {
      fn(concept);
    }
  }

  *focusConcepts(): IterableIterator<Concept> {
    yield* this.concepts.values();
  }

  getFocusSet(): Concept[] {
    const out: Concept[] = [];
    this.forEachFocus((c) => out.push(c));
    return out;
  }

  clearFocus(): void {
    this.concepts.clear();
  }

  boostTopic(topic: string, factor = 2.0, ttl = 50): void {
    this.topicBoosts.set(topic.toLowerCase(), { factor, ttl });
  }

  getActiveGoals(): Task[] {
    return [...this.activeGoals];
  }

  setActiveGoals(goals: Task[]): void {
    this.activeGoals = goals;
  }

  adjustPriority(concept: Concept, basePriority: number): number {
    let p = basePriority;
    const termStr = concept.term.toString().toLowerCase();

    for (const [topic, boost] of this.topicBoosts) {
      if (termStr.includes(topic)) {
        p *= boost.factor;
        boost.ttl--;
        if (boost.ttl <= 0) this.topicBoosts.delete(topic);
      }
    }

    for (const goal of this.activeGoals) {
      if (containsSubterm(concept.term, goal.term) || containsSubterm(goal.term, concept.term)) {
        p *= 1.5;
      }
    }

    if (concept.lastAccessedAt > Date.now() - 60000) p *= 1.2;

    return clamp01(p);
  }

  getTopicBoosts(): Map<string, { factor: number; ttl: number }> {
    return this.topicBoosts;
  }

  clearTopicBoosts(): void {
    this.topicBoosts.clear();
  }
}
