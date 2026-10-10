/**
 * Performance Budget System (§P4.4, M).
 * Asserted in visual tests; regression blocks commit.
 */

export interface PerformanceBudget {
  /** Maximum time (ms) for a single projection cycle. */
  projectionMs: number;
  /** Maximum time (ms) for rendering a graph with N nodes. */
  graphRenderMs: { nodes: number; maxMs: number }[];
  /** Maximum memory (MB) for the workspace graph. */
  memoryMB: number;
  /** Maximum time (ms) for layout computation. */
  layoutMs: number;
  /** Maximum time (ms) for ToC generation. */
  tocMs: number;
  /** Maximum time (ms) for command palette matching. */
  paletteMs: number;
  /** Maximum batch size for op streaming. */
  maxBatchSize: number;
}

export const DEFAULT_PERFORMANCE_BUDGET: PerformanceBudget = {
  projectionMs: 16, // 60fps budget
  graphRenderMs: [
    { nodes: 100, maxMs: 16 },
    { nodes: 500, maxMs: 50 },
    { nodes: 1000, maxMs: 100 },
    { nodes: 5000, maxMs: 200 },
  ],
  memoryMB: 50,
  layoutMs: 100,
  tocMs: 10,
  paletteMs: 5,
  maxBatchSize: 100,
};

/** Result of a performance measurement. */
export interface PerformanceResult {
  name: string;
  value: number;
  unit: 'ms' | 'mb' | 'ops';
  budget: number;
  passed: boolean;
  timestamp: number;
}

/** Performance budget tracker. */
export class PerformanceBudgetTracker {
  private results: PerformanceResult[] = [];
  private budgets: PerformanceBudget;

  constructor(budget?: Partial<PerformanceBudget>) {
    this.budgets = { ...DEFAULT_PERFORMANCE_BUDGET, ...budget };
  }

  /** Measure and assert a projection operation. */
  assertProjection<T>(name: string, fn: () => T): T {
    const start = performance.now();
    const result = fn();
    const elapsed = performance.now() - start;
    this.record({ name, value: elapsed, unit: 'ms', budget: this.budgets.projectionMs, passed: elapsed <= this.budgets.projectionMs, timestamp: Date.now() });
    return result;
  }

  /** Measure and assert graph rendering. */
  assertGraphRender<T>(name: string, nodeCount: number, fn: () => T): T {
    const budgets = this.budgets.graphRenderMs;
    const budget = budgets.find((b) => nodeCount <= b.nodes) ?? budgets[budgets.length - 1] ?? { nodes: Infinity, maxMs: 1000 };
    const start = performance.now();
    const result = fn();
    const elapsed = performance.now() - start;
    this.record({ name, value: elapsed, unit: 'ms', budget: budget.maxMs, passed: elapsed <= budget.maxMs, timestamp: Date.now() });
    return result;
  }

  /** Measure and assert layout computation. */
  assertLayout<T>(name: string, fn: () => T): T {
    const start = performance.now();
    const result = fn();
    const elapsed = performance.now() - start;
    this.record({ name, value: elapsed, unit: 'ms', budget: this.budgets.layoutMs, passed: elapsed <= this.budgets.layoutMs, timestamp: Date.now() });
    return result;
  }

  /** Measure and assert ToC generation. */
  assertToc<T>(name: string, fn: () => T): T {
    const start = performance.now();
    const result = fn();
    const elapsed = performance.now() - start;
    this.record({ name, value: elapsed, unit: 'ms', budget: this.budgets.tocMs, passed: elapsed <= this.budgets.tocMs, timestamp: Date.now() });
    return result;
  }

  /** Measure and assert command palette matching. */
  assertPalette<T>(name: string, fn: () => T): T {
    const start = performance.now();
    const result = fn();
    const elapsed = performance.now() - start;
    this.record({ name, value: elapsed, unit: 'ms', budget: this.budgets.paletteMs, passed: elapsed <= this.budgets.paletteMs, timestamp: Date.now() });
    return result;
  }

  /** Generic measure. */
  measure<T>(name: string, budgetMs: number, fn: () => T): T {
    const start = performance.now();
    const result = fn();
    const elapsed = performance.now() - start;
    this.record({ name, value: elapsed, unit: 'ms', budget: budgetMs, passed: elapsed <= budgetMs, timestamp: Date.now() });
    return result;
  }

  /** Record a measurement. */
  record(result: PerformanceResult): void {
    this.results.push(result);
    if (!result.passed) {
      console.warn(`[Performance] Budget exceeded: ${result.name} = ${result.value.toFixed(2)}${result.unit} (budget: ${result.budget}${result.unit})`);
    }
  }

  /** Get all results. */
  getResults(): PerformanceResult[] {
    return [...this.results];
  }

  /** Get failed results. */
  getFailures(): PerformanceResult[] {
    return this.results.filter((r) => !r.passed);
  }

  /** Clear results. */
  clear(): void {
    this.results = [];
  }

  /** Export as JSON for CI. */
  toJson(): string {
    return JSON.stringify(this.results, null, 2);
  }
}

/** Global tracker instance for tests. */
export const perfTracker = new PerformanceBudgetTracker();

/** Decorator for measuring method performance. */
export function measured(budgetMs: number, name?: string) {
  return function (_target: object, _propertyKey: string, descriptor: TypedPropertyDescriptor<(...args: unknown[]) => unknown>): TypedPropertyDescriptor<(...args: unknown[]) => unknown> {
    const original = descriptor.value!;
    descriptor.value = function (...args: unknown[]) {
      return perfTracker.measure(name ?? original.name, budgetMs, () => original.apply(this, args));
    };
    return descriptor;
  };
}

/** Batch operations to stay within frame budget. */
export async function batched<T>(items: T[], batchSize: number, fn: (batch: T[]) => Promise<void>): Promise<void> {
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    await fn(batch);
    // Yield to event loop between batches
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

/** Virtualize a list by only rendering visible items. */
export function virtualize<T>(items: T[], viewportHeight: number, itemHeight: number, scrollTop: number): { start: number; end: number; items: T[] } {
  const start = Math.max(0, Math.floor(scrollTop / itemHeight));
  const visibleCount = Math.ceil(viewportHeight / itemHeight);
  const end = Math.min(items.length, start + visibleCount + 2); // +2 for buffer
  return { start, end, items: items.slice(start, end) };
}

/** Decimate data points for display (e.g., sparklines). */
export function decimate<T>(data: T[], maxPoints: number, _key?: keyof T): T[] {
  if (data.length <= maxPoints) return data;
  const step = data.length / maxPoints;
  const result: T[] = [];
  for (let i = 0; i < maxPoints; i++) {
    const index = Math.floor(i * step);
    const item = data[index];
    if (item !== undefined) result.push(item);
  }
  return result;
}

/** Shared adjacency index for fast graph traversals. */
export class AdjacencyIndex {
  private outgoing = new Map<string, Set<string>>();
  private incoming = new Map<string, Set<string>>();

  build(nodes: Iterable<string>, edges: Iterable<{ source: string; target: string }>): void {
    this.outgoing.clear();
    this.incoming.clear();
    for (const node of nodes) {
      this.outgoing.set(node, new Set());
      this.incoming.set(node, new Set());
    }
    for (const { source, target } of edges) {
      this.outgoing.get(source)?.add(target);
      this.incoming.get(target)?.add(source);
    }
  }

  getOutgoing(node: string): ReadonlySet<string> | undefined {
    return this.outgoing.get(node);
  }

  getIncoming(node: string): ReadonlySet<string> | undefined {
    return this.incoming.get(node);
  }

  getNeighbors(node: string): Set<string> {
    const out = this.outgoing.get(node) ?? new Set();
    const in_ = this.incoming.get(node) ?? new Set();
    return new Set([...out, ...in_]);
  }

  hasPath(from: string, to: string, maxDepth = 3): boolean {
    const visited = new Set<string>();
    const queue = [{ node: from, depth: 0 }];
    while (queue.length > 0) {
      const { node, depth } = queue.shift()!;
      if (node === to) return true;
      if (depth >= maxDepth) continue;
      if (visited.has(node)) continue;
      visited.add(node);
      for (const neighbor of this.getNeighbors(node)) {
        queue.push({ node: neighbor, depth: depth + 1 });
      }
    }
    return false;
  }
}

/** Memoized computation cache with LRU eviction. */
export class MemoCache<K, V> {
  private cache = new Map<K, { value: V; timestamp: number }>();
  private maxSize: number;

  constructor(maxSize = 1000) {
    this.maxSize = maxSize;
  }

  get(key: K): V | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.value;
  }

  set(key: K, value: V): void {
    if (this.cache.size >= this.maxSize) {
      // Evict least recently used (first entry)
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) this.cache.delete(firstKey);
    }
    this.cache.set(key, { value, timestamp: Date.now() });
  }

  has(key: K): boolean {
    return this.cache.has(key);
  }

  clear(): void {
    this.cache.clear();
  }
}

/** Performance marks for visual test assertions. */
export const PERF_MARKS = {
  projection: 'perf:projection',
  graphRender: 'perf:graph-render',
  layout: 'perf:layout',
  toc: 'perf:toc',
  palette: 'perf:palette',
} as const;

/** Mark a performance section. */
export function markStart(name: string): void {
  performance.mark(`${name}:start`);
}

/** End a performance mark and measure. */
export function markEnd(name: string): number {
  performance.mark(`${name}:end`);
  performance.measure(name, `${name}:start`, `${name}:end`);
  const entries = performance.getEntriesByName(name, 'measure');
  const duration = entries[entries.length - 1]?.duration ?? 0;
  performance.clearMarks(`${name}:start`);
  performance.clearMarks(`${name}:end`);
  performance.clearMeasures(name);
  return duration;
}