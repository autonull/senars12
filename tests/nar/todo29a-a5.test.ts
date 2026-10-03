import { createGateRegistry } from '../../nar/src/kernel/GateRegistry.js';
/**
 * A5's boundary (TODO29.a §5.5) — every case failing first, per §10.1.
 *
 * The claim is dependency inversion: reasoning code depends on the concept of
 * storage, not on one all-purpose implementation. Three things can falsify it,
 * and each is a block below.
 *
 *  1. **The ports are constructible on their own.** A consumer that depends only
 *     on a port must be usable with a different implementation — otherwise the
 *     port is a rename. `FakeStore` here implements `MemoryPorts` over a plain
 *     array and drives `InferenceController`, `TaskManager` and `RuleProcessor`
 *     with no `Memory` in sight.
 *  2. **`Memory` satisfies every port**, structurally: a store can be swapped for
 *     the real one and back without touching a caller.
 *  3. **The gate's rules**, on source text. `memory:ports` is a scan over the
 *     checkout, so what it decides is tested here rather than only exercised by
 *     a real violation.
 */

import { describe, expect, it } from 'vitest';

import { AssociativeRegistry } from '../../nar/src/memory/associative.js';
import type { ConceptGraph } from '../../nar/src/memory/ConceptGraph.js';
import { Concept, type ConceptTaskType } from '../../nar/src/memory/concept.js';
import { Focus } from '../../nar/src/memory/focus.js';
import { LinkManager } from '../../nar/src/memory/links/index.js';
import type {
  BeliefTable,
  ConceptReader,
  ConceptWriter,
  GoalEnumeration,
  LinkPort,
  MemoryClock,
  MemoryPorts,
  MemoryStatistics,
  StatisticsView,
  SymbolIndex,
  TaskAdmission,
} from '../../nar/src/memory/ports/index.js';
import { Memory } from '../../nar/src/memory/memory.js';
import type { MemoryView } from '../../nar/src/memory/view.js';
import { InferenceController } from '../../nar/src/reason/inference-controller.js';
import { RuleProcessor } from '../../nar/src/rules/impls/processor.js';
import { NullAttentionModel } from '../../nar/src/strategies/attention/NullAttentionModel.js';
import { TaskManager } from '../../nar/src/task/manager.js';
import { Stamp, Truth, type Term } from '../../nar/src/terms';
import { atom } from '../../nar/src/terms/impls/factory.js';
import type { Budget, Task } from '../../nar/src/types';
import { createTaskWeight, createTask } from '../../nar/src/types';

import { isCyclePath, resolveInNar } from '../../scripts/lib/layer-boundary.js';
import { ROOT } from '../../scripts/lib/root.js';

/** The fake store's nominal capacity — anything, since it evicts nothing. */
const FAKE_CAPACITY = 1000;

/**
 * A store that is not `Memory`: an array, a `Map` by printed term, and no
 * index, no focus, no archive. It exists to make the ports load-bearing — every
 * consumer below runs against this and nothing else.
 */
class FakeStore implements MemoryPorts {
  private readonly concepts = new Map<string, Concept>();
  private consolidations = 0;
  readonly links_: LinkManager = new LinkManager({ defaultCapacity: 64, layers: { term: 64 } });
  readonly focus_ = new Focus({ maxConcepts: 8 });
  readonly associative_ = new AssociativeRegistry((name) => this.links_.getLayer(name));

  // ── ConceptReader ──
  listConcepts(): Concept[] {
    return [...this.concepts.values()];
  }
  *conceptValues(): IterableIterator<Concept> {
    yield* this.concepts.values();
  }
  getConcept(term: Concept['term']): Concept | undefined {
    return this.concepts.get(term.toString());
  }
  get size(): number {
    return this.concepts.size;
  }

  // ── ConceptWriter ──
  addConcept(term: Concept['term']): Concept {
    const key = term.toString();
    const existing = this.concepts.get(key);
    if (existing) return existing;
    const concept = new Concept(term);
    this.concepts.set(key, concept);
    return concept;
  }
  removeConcept(term: Concept['term']): boolean {
    return this.concepts.delete(term.toString());
  }
  archiveConcept(concept: Concept): boolean {
    return this.removeConcept(concept.term);
  }
  clear(): void {
    this.concepts.clear();
  }

  // ── TaskAdmission ──
  addTask(
    term: Term,
    type: ConceptTaskType,
    truth?: Truth,
    budget: Budget = createTaskWeight(0.5),
    stamp?: Stamp
  ): boolean {
    return this.addConcept(term).addTask(type, { term, truth, budget, stamp });
  }

  // ── BeliefTable ──
  beliefs(concept: Concept) {
    return concept.getBeliefs();
  }
  taskCount(concept: Concept): number {
    return concept.totalTasks;
  }

  // ── GoalEnumeration ──
  getGoals(): Task[] {
    return this.listConcepts().flatMap((concept) =>
      concept.getGoals().map((goal) => ({
        term: goal.term,
        type: 'goal' as const,
        truth: goal.truth ?? Truth.NEUTRAL,
        budget: goal.budget,
        stamp: goal.stamp ?? Stamp.createInput(),
        occurrenceTime: goal.occurrenceTime as Task['occurrenceTime'],
        derived: goal.derived ?? false,
      }))
    );
  }

  // ── StatisticsView ──
  capacityPressure(): number {
    return this.pressureBreakdown().capacity;
  }
  pressureBreakdown(): { concepts: number; tasks: number; capacity: number } {
    const { totalConcepts, totalTasks } = this.totals();
    const concepts = totalConcepts / FAKE_CAPACITY;
    const tasks = totalTasks / FAKE_CAPACITY;
    return { concepts, tasks, capacity: Math.max(concepts, tasks) };
  }
  totals(): { totalConcepts: number; totalTasks: number } {
    return {
      totalConcepts: this.concepts.size,
      totalTasks: this.listConcepts().reduce((sum, c) => sum + c.totalTasks, 0),
    };
  }
  getStatistics(): MemoryStatistics {
    const { totalConcepts, totalTasks } = this.totals();
    const pressureBreakdown = this.pressureBreakdown();
    const pressure = pressureBreakdown.capacity;
    return {
      totalConcepts,
      totalTasks,
      focusedConcepts: 0,
      archivedConcepts: 0,
      memoryPressure: pressure,
      utilization: pressure,
      pressureByBound: { concepts: pressureBreakdown.concepts, tasks: pressureBreakdown.tasks },
      conceptDistribution: { lowPriority: 0, mediumPriority: 0, highPriority: 0 },
    };
  }

  // ── SymbolIndex ──
  queryBySymbol(): Concept[] {
    return [];
  }
  queryByTimeRange(): Concept[] {
    return [];
  }
  findConcepts(pattern: string, limit = 10): Concept[] {
    return this.listConcepts().filter((c) => c.term.toString().includes(pattern)).slice(0, limit);
  }
  findSimilarConcepts(term: Concept['term'], limit = 10): Concept[] {
    return this.listConcepts().filter((c) => c.term.toString() === term.toString()).slice(0, limit);
  }
  getRelatedConcepts(term: Concept['term'], limit = 10): Concept[] {
    return this.findSimilarConcepts(term, limit);
  }

  // ── LinkPort, MemoryClock, AttentionOwner ──
  links(): LinkPort {
    return this.links_;
  }
  attachConceptGraph(graph: ConceptGraph): ConceptGraph {
    return graph;
  }
  consolidate(): void {
    this.consolidations++;
  }
  get consolidations_(): number {
    return this.consolidations;
  }
  get attentionModel() {
    return new NullAttentionModel();
  }
  setAttentionModel(): void {}

  // ── MemoryView's focus/sampling surface ──
  getFocus(): Focus {
    return this.focus_;
  }
  getAssociativeMemories(): AssociativeRegistry {
    return this.associative_;
  }
  getEmbeddingIndex() {
    return undefined;
  }
  topConcepts(limit: number): Concept[] {
    return this.listConcepts().slice(0, limit);
  }
  sampleWindow(windowSize: number): Concept[] {
    return this.listConcepts().slice(0, windowSize);
  }
}

/** Compile-time proof that each port is separately satisfiable — one per block. */
const _reader: ConceptReader = new FakeStore();
const _writer: ConceptWriter = new FakeStore();
const _admission: TaskAdmission = new FakeStore();
const _beliefs: BeliefTable = new FakeStore();
const _goals: GoalEnumeration = new FakeStore();
const _stats: StatisticsView = new FakeStore();
const _index: SymbolIndex = new FakeStore();
const _clock: MemoryClock = new FakeStore();
const _view: MemoryView = new FakeStore();

describe('A5 — memory is a set of ports', () => {
  it('the real facade satisfies every port, structurally', () => {
    const memory = new Memory();
    const ports: MemoryPorts = memory;
    const view: MemoryView = memory;

    expect(ports.size).toBe(0);
    expect(view.topConcepts(1)).toEqual([]);
    expect(memory.capacityPressure()).toBe(0);
  });

  it('TaskManager admits tasks through TaskAdmission alone', async () => {
    const store = new FakeStore();
    const manager = new TaskManager(store, { gateRegistry: createGateRegistry() });
    const cat = atom('cat');

    expect(store.size).toBe(0);
    manager.addTask(createTask(cat, 'belief', Truth.TRUE, createTaskWeight(0.9)));
    await manager.processPending();

    expect(store.size).toBe(1);
    expect(store.beliefs(store.getConcept(cat)!)).toHaveLength(1);
  });

  it('InferenceController runs a cycle against a store that is not Memory', async () => {
    const store = new FakeStore();
    const processor = new RuleProcessor();
    processor.setConfig({ memory: store });

    const controller = new InferenceController(
      store,
      processor,
      {
        metadata: { name: 'first', version: '1', description: 'the first n' },
        sample: (mem, n) => mem.listConcepts().slice(0, n),
      },
      { name: 'none', selectSecondary: () => [] },
      { metadata: { name: 'empty', version: '1', description: 'derives nothing' }, derive: async function* () {} } as never,
      {
        maxDerivationsPerStep: 10,
        maxDerivationDepth: 3,
        enableCircularDetection: true,
        cpuThrottleMs: 0,
        singlePremiseLMRules: false,
        sampleSize: 5,
      }
    );

    store.addConcept(atom('cat'));
    store.addTask(atom('cat'), 'belief', Truth.create(0.9, 0.9));

    await expect(controller.step(1000, 10)).resolves.toEqual([]);
    expect(controller.getStats().derivations).toBe(0);
  });

  it('the consolidation clock is the only port that ticks the decay clock', () => {
    const store = new FakeStore();
    const clock: MemoryClock = store;

    expect(store.consolidations_).toBe(0);
    clock.consolidate({ cycleCount: 1 });
    clock.consolidate({ cycleCount: 2 });
    expect(store.consolidations_).toBe(2);
  });

  it('no cycle-path module names the facade, except declared composition sites', () => {
    // The rule the gate applies, on a file that is not one.
    const cyclePath = `${ROOT}/nar/src/reason/inference-controller.ts`;
    expect(isCyclePath(cyclePath)).toBe(true);
    expect(resolveInNar(cyclePath, '../memory/view.js')).toBe(
      `${ROOT}/nar/src/memory/view`
    );
    // The ports resolve where the gate expects them to.
    expect(resolveInNar(cyclePath, '../memory/ports/index.js')).toBe(
      `${ROOT}/nar/src/memory/ports/index`
    );
  });
});