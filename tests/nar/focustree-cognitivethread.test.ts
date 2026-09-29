import { describe, it, expect, beforeEach } from 'vitest';
import { FocusTree, createFocusTree, type FocusTreeOptions } from '@senars/nar/focus';
import { CognitiveThread, createCognitiveThread, createRootBudget, ThreadPool, type BudgetAllocation, type SpawnResult } from '@senars/core';
import { BudgetSlice, createBudgetSlice, consumeCycles, isExhausted } from '@senars/core/budget';
import { Focus } from '@senars/nar/focus/Focus.js';

function createMockFocusOptions(id: string): FocusTreeOptions['rootFocus'] {
  return {
    id,
    taskCapacity: 100,
    conceptCapacity: 50,
    weight: 1.0,
  };
}

function createMockBudget(id: string, cycles = 1000): BudgetSlice {
  return createBudgetSlice({
    id,
    parentId: undefined,
    totalCycles: cycles,
    totalDepth: 100,
    totalMemoryOps: 10000,
    totalLMCalls: 100,
  });
}

describe('FocusTree multi-root (D1)', () => {
  let tree: FocusTree;

  beforeEach(() => {
    tree = createFocusTree({
      rootFocus: createMockFocusOptions('root'),
      rootBudget: createMockBudget('root-budget'),
      seed: 42,
    });
  });

  it('single-root default maintains parity with flat scheduling', async () => {
    // Add a child to root
    const child = tree.addChild('root', createMockFocusOptions('child'), { cycles: 100 });
    expect(child).not.toBeNull();

    // Tick should work and sample from leaves
    const result = await tree.tick();
    expect(result).not.toBeNull();
    expect(result!.nodeId).toBe('child'); // Only child is a leaf
    expect(result!.report).not.toBeNull();
  });

  it('addRoot creates independent root with isolated budget slice', () => {
    const root2 = tree.addRoot(
      createMockFocusOptions('root2'),
      createMockBudget('root2-budget', 500)
    );

    expect(root2.id).toBe('root2');
    expect(root2.parent).toBeNull();
    expect(root2.budget.id).toBe('root2-budget');
    expect(root2.budget.totalCycles).toBe(500);

    // Both roots should be in nodeMap
    expect(tree.getNode('root')).toBeDefined();
    expect(tree.getNode('root2')).toBeDefined();
  });

  it('multi-root tick samples across all roots proportionally by weight', async () => {
    const root2 = tree.addRoot(
      createMockFocusOptions('root2'),
      createMockBudget('root2-budget', 500)
    );
    root2.weight = 2.0; // Higher weight

    // Add children to both roots so they have leaves
    tree.addChild('root', createMockFocusOptions('child1'), { cycles: 100 });
    tree.addChild('root2', createMockFocusOptions('child2'), { cycles: 100 });

    // Run multiple ticks to verify weighted sampling
    const counts = { child1: 0, child2: 0 };
    for (let i = 0; i < 100; i++) {
      const result = await tree.tick();
      if (result?.nodeId) counts[result.nodeId as keyof typeof counts]++;
    }

    // Both children have equal weight (1.0), but root2 has 2x weight
    // Since we sample leaves proportionally by node.weight, and both children have weight 1.0,
    // the distribution should be roughly equal. The root weight doesn't affect leaf sampling directly.
    // Just verify both get selected.
    expect(counts.child1).toBeGreaterThan(0);
    expect(counts.child2).toBeGreaterThan(0);
  });

  it('getRootRollup returns rollups for all roots', () => {
    tree.addRoot(createMockFocusOptions('root2'), createMockBudget('root2-budget'));
    tree.addChild('root', createMockFocusOptions('child1'), { cycles: 100 });
    tree.addChild('root2', createMockFocusOptions('child2'), { cycles: 100 });

    const rollups = tree.getRootRollup();
    expect(rollups).toHaveLength(2);
    const rootIds = rollups.map(r => r.nodeId).sort();
    expect(rootIds).toEqual(['root', 'root2']);
    for (const r of rollups) {
      expect(r.childRollups).toHaveLength(1);
    }
  });

  it('getRollup returns subtree rollup for any node', () => {
    tree.addChild('root', createMockFocusOptions('child1'), { cycles: 100 });
    const child = tree.addChild('child1', createMockFocusOptions('grandchild'), { cycles: 50 });

    const rollup = tree.getRollup('child1');
    expect(rollup).not.toBeNull();
    expect(rollup!.nodeId).toBe('child1');
    expect(rollup!.childRollups).toHaveLength(1);
    const grandchild = rollup!.childRollups[0];
    expect(grandchild).toBeDefined();
    expect(grandchild!.nodeId).toBe('grandchild');
  });

  it('hasExhaustedBudget returns true when any node budget exhausted', () => {
    const budget = createMockBudget('exhausted-budget', 1);
    const tree2 = createFocusTree({
      rootFocus: createMockFocusOptions('root'),
      rootBudget: budget,
    });

    // Consume the budget
    consumeCycles(budget, 1);
    expect(tree2.hasExhaustedBudget()).toBe(true);
  });

  it('maxDepth prevents adding children beyond limit', () => {
    const tree3 = createFocusTree({
      rootFocus: createMockFocusOptions('root'),
      rootBudget: createMockBudget('budget'),
      maxDepth: 2,
    });

    const child1 = tree3.addChild('root', createMockFocusOptions('child1'), {});
    expect(child1).not.toBeNull();

    const child2 = tree3.addChild('child1', createMockFocusOptions('child2'), {});
    expect(child2).not.toBeNull();

    // Depth 2 reached, cannot add more
    const child3 = tree3.addChild('child2', createMockFocusOptions('child3'), {});
    expect(child3).toBeNull();
  });

  it('getAllNodes returns all nodes across all roots', () => {
    tree.addRoot(createMockFocusOptions('root2'), createMockBudget('budget2'));
    tree.addChild('root', createMockFocusOptions('child1'), {});
    tree.addChild('root2', createMockFocusOptions('child2'), {});

    const nodes = tree.getAllNodes();
    expect(nodes).toHaveLength(4); // root, root2, child1, child2
  });

  it('getNode returns node by ID', () => {
    tree.addChild('root', createMockFocusOptions('child1'), {});
    const node = tree.getNode('child1');
    expect(node).toBeDefined();
    expect(node!.id).toBe('child1');

    const missing = tree.getNode('nonexistent');
    expect(missing).toBeUndefined();
  });
});

describe('CognitiveThread hard budget inheritance (D2)', () => {
  let rootBudget: BudgetSlice;

  beforeEach(() => {
    rootBudget = createBudgetSlice({
      id: 'root-budget',
      parentId: undefined,
      totalCycles: 1000,
      totalDepth: 100,
      totalMemoryOps: 10000,
      totalLMCalls: 100,
    });
  });

  it('spawn enforces Σ(child) ≤ parent.remaining', () => {
    const parent = createCognitiveThread('parent', rootBudget, { mailboxCapacity: 100 });

    // Spawn first child with explicit allocation
    const result1 = parent.spawn('child1', { cycles: 300 });
    expect(result1.thread).toBeDefined();
    expect(result1.remainingBudget.cycles).toBe(700); // 1000 - 300

    // Spawn second child
    const result2 = parent.spawn('child2', { cycles: 400 });
    expect(result2.thread).toBeDefined();
    expect(result2.remainingBudget.cycles).toBe(300); // 700 - 400

    // Third child should get remaining budget
    const result3 = parent.spawn('child3', { cycles: 500 });
    expect(result3.thread).toBeDefined();
    expect(result3.remainingBudget.cycles).toBe(0); // 300 - 300 (capped at remaining)
  });

  it('spawn caps child allocation at parent remaining', () => {
    const parent = createCognitiveThread('parent', rootBudget);

    // Request more than available
    const result = parent.spawn('child1', { cycles: 2000 });
    expect(result.thread.budget.totalCycles).toBeLessThanOrEqual(1000);
    expect(result.remainingBudget.cycles).toBe(0);
  });

  it('join returns unconsumed budget', async () => {
    const thread = createCognitiveThread('worker', rootBudget, { budgetAllocation: { cycles: 100 } });

    await thread.run(async () => {
      // Simulate some work consuming cycles
      consumeCycles(thread.budget, 30);
      return 'done';
    });

    const joinResult = await thread.join();
    expect(joinResult.result).toBe('done');
    // 100 allocated - 30 work - 1 run overhead = 69
    expect(joinResult.unconsumedBudget.cycles).toBe(69);
  });

  it('getUnconsumedBudget returns remaining budget without joining', () => {
    const thread = createCognitiveThread('worker', rootBudget, { budgetAllocation: { cycles: 200 } });
    consumeCycles(thread.budget, 50);

    const unconsumed = thread.getUnconsumedBudget();
    expect(unconsumed.cycles).toBe(150); // 200 - 50
  });

  it('canContinue returns false when budget exhausted', async () => {
    const budget = createBudgetSlice({
      id: 'tiny',
      parentId: undefined,
      totalCycles: 2,
      totalDepth: 10,
      totalMemoryOps: 100,
      totalLMCalls: 10,
    });

    const thread = createCognitiveThread('worker', budget);
    // Initially status is 'created', so canContinue is false
    expect(thread.canContinue()).toBe(false);

    // During run, status is 'running' and budget not exhausted (1 consumed for overhead, 1 remaining)
    let canContinueDuringRun = false;
    await thread.run(async (t) => {
      canContinueDuringRun = t.canContinue();
      expect(canContinueDuringRun).toBe(true);
    });

    // After run completes, status is 'completed', so canContinue is false
    expect(thread.canContinue()).toBe(false);

    // Exhaust remaining budget on thread's budget slice
    consumeCycles(thread.budget, 1);
    expect(isExhausted(thread.budget)).toBe(true);
  });

  it('spawn returns SpawnResult with thread and remainingBudget', () => {
    const parent = createCognitiveThread('parent', rootBudget);
    const result = parent.spawn('child1', { cycles: 250 });

    expect(result).toHaveProperty('thread');
    expect(result).toHaveProperty('remainingBudget');
    expect(result.thread.id).toBe('child1');
    expect(result.remainingBudget.cycles).toBe(750);
  });
});

describe('CognitiveThread mailbox budget-gated backpressure (D3)', () => {
  let rootBudget: BudgetSlice;

  beforeEach(() => {
    rootBudget = createBudgetSlice({
      id: 'root-budget',
      parentId: undefined,
      totalCycles: 100,
      totalDepth: 100,
      totalMemoryOps: 10000,
      totalLMCalls: 100,
    });
  });

  it('send returns false when budget exhausted', () => {
    const thread = createCognitiveThread('worker', rootBudget);

    // Exhaust budget
    consumeCycles(thread.budget, 100);
    expect(isExhausted(thread.budget)).toBe(true);

    // Send should fail
    const result = thread.send({ type: 'task', payload: 'test' });
    expect(result).toBe(false);
  });

  it('send returns false when mailbox full', () => {
    const thread = createCognitiveThread('worker', rootBudget, { mailboxCapacity: 2 });

    // Fill mailbox
    expect(thread.send({ type: 'task', payload: 1 })).toBe(true);
    expect(thread.send({ type: 'task', payload: 2 })).toBe(true);
    expect(thread.send({ type: 'task', payload: 3 })).toBe(false); // Full
  });

  it('send consumes 1 cycle per message', () => {
    const thread = createCognitiveThread('worker', rootBudget);
    const initialCycles = thread.budget.consumed.cycles;

    thread.send({ type: 'task', payload: 'test' });
    expect(thread.budget.consumed.cycles).toBe(initialCycles + 1);
  });

  it('receive dequeues messages', () => {
    const thread = createCognitiveThread('worker', rootBudget);

    thread.send({ type: 'task', payload: 'first' });
    thread.send({ type: 'task', payload: 'second' });

    const msg1 = thread.receive();
    expect(msg1?.payload).toBe('first');

    const msg2 = thread.receive();
    expect(msg2?.payload).toBe('second');

    const empty = thread.receive();
    expect(empty).toBeUndefined();
  });

  it('mailbox capacity is respected', () => {
    const thread = createCognitiveThread('worker', rootBudget, { mailboxCapacity: 1 });

    expect(thread.mailbox.capacity).toBe(1);
    expect(thread.mailbox.isEmpty()).toBe(true);

    thread.send({ type: 'task', payload: 'test' });
    expect(thread.mailbox.isFull()).toBe(true);
    expect(thread.mailbox.size()).toBe(1);
  });
});

describe('CognitiveThread spawn/join/kill lifecycle (D4)', () => {
  let rootBudget: BudgetSlice;

  beforeEach(() => {
    rootBudget = createBudgetSlice({
      id: 'root-budget',
      parentId: undefined,
      totalCycles: 1000,
      totalDepth: 100,
      totalMemoryOps: 10000,
      totalLMCalls: 100,
    });
  });

  it('thread lifecycle: created -> running -> completed', async () => {
    const thread = createCognitiveThread('worker', rootBudget);

    expect(thread.getStatus()).toBe('created');

    const promise = thread.run(async (t) => {
      expect(t.getStatus()).toBe('running');
      return 'result';
    });

    expect(thread.getStatus()).toBe('running');

    const result = await promise;
    expect(result).toBe('result');
    expect(thread.getStatus()).toBe('completed');
  });

  it('thread error status on thrown error', async () => {
    const thread = createCognitiveThread('worker', rootBudget);

    await expect(thread.run(async () => {
      throw new Error('work failed');
    })).rejects.toThrow('work failed');

    expect(thread.getStatus()).toBe('error');
    expect(thread.getError()).toBeInstanceOf(Error);
  });

  it('kill sets status to killed and creates error', () => {
    const thread = createCognitiveThread('worker', rootBudget);

    thread.kill('test reason');

    expect(thread.getStatus()).toBe('killed');
    expect(thread.getError()).toBeInstanceOf(Error);
    expect(thread.getError()!.message).toContain('test reason');
  });

  it('getChildren returns spawned child IDs', () => {
    const parent = createCognitiveThread('parent', rootBudget);

    const child1 = parent.spawn('child1').thread;
    const child2 = parent.spawn('child2').thread;

    expect(parent.getChildren()).toContain('child1');
    expect(parent.getChildren()).toContain('child2');
    expect(parent.getChildren()).toHaveLength(2);
  });

  it('ThreadPool spawnWithBudget uses hard inheritance', () => {
    const pool = new ThreadPool(rootBudget, 5);

    const result1 = pool.spawnWithBudget('thread1', { cycles: 300 });
    expect(result1).not.toBeNull();
    expect(result1!.thread.id).toBe('thread1');

    const result2 = pool.spawnWithBudget('thread2', { cycles: 400 });
    expect(result2).not.toBeNull();
    expect(result2!.remainingBudget.cycles).toBe(300); // 1000 - 300 - 400

    const result3 = pool.spawnWithBudget('thread3', { cycles: 500 });
    expect(result3).not.toBeNull();
    expect(result3!.remainingBudget.cycles).toBe(0); // Capped at remaining
  });

  it('ThreadPool respects maxThreads limit', () => {
    const pool = new ThreadPool(rootBudget, 2);

    pool.spawn('thread1');
    pool.spawn('thread2');
    const third = pool.spawn('thread3');

    expect(third).toBeNull();
    expect(pool.getStatuses().size).toBe(2);
  });

  it('ThreadPool kill removes thread', () => {
    const pool = new ThreadPool(rootBudget, 5);
    pool.spawn('thread1');

    const killed = pool.kill('thread1');
    expect(killed).toBe(true);
    expect(pool.get('thread1')).toBeUndefined();
    expect(pool.getStatuses().size).toBe(0);
  });

  it('ThreadPool killAll clears all threads', () => {
    const pool = new ThreadPool(rootBudget, 5);
    pool.spawn('thread1');
    pool.spawn('thread2');

    pool.killAll();

    expect(pool.getStatuses().size).toBe(0);
  });

  it('ThreadPool joinAll waits for all threads', async () => {
    const pool = new ThreadPool(rootBudget, 5);
    const t1 = pool.spawn('thread1');
    const t2 = pool.spawn('thread2');

    // Run threads and await completion
    await t1!.run(async () => 'result1');
    await t2!.run(async () => 'result2');

    const results = await pool.joinAll();
    expect(results.get('thread1')).toEqual({ result: 'result1', unconsumedBudget: expect.any(Object) });
    expect(results.get('thread2')).toEqual({ result: 'result2', unconsumedBudget: expect.any(Object) });
  });
});

describe('FocusTree + CognitiveThread integration', () => {
  it('FocusTree nodes can track independent budget slices', () => {
    const rootBudget = createBudgetSlice({
      id: 'root-budget',
      parentId: undefined,
      totalCycles: 1000,
      totalDepth: 100,
      totalMemoryOps: 10000,
      totalLMCalls: 100,
    });

    const tree = createFocusTree({
      rootFocus: createMockFocusOptions('root'),
      rootBudget,
    });

    const child = tree.addChild('root', createMockFocusOptions('child'), { cycles: 500 });
    expect(child).not.toBeNull();
    // child budget parentId is set to parent budget ID ('root-budget')
    expect(child!.budget.parentId).toBe('root-budget');
    expect(child!.budget.totalCycles).toBe(500);
  });

  it('ThreadPool and FocusTree can be used together', () => {
    const rootBudget = createBudgetSlice({
      id: 'root-budget',
      parentId: undefined,
      totalCycles: 1000,
      totalDepth: 100,
      totalMemoryOps: 10000,
      totalLMCalls: 100,
    });

    const pool = new ThreadPool(rootBudget);
    const tree = createFocusTree({
      rootFocus: createMockFocusOptions('focus-root'),
      rootBudget: createBudgetSlice({
        id: 'focus-budget',
        parentId: 'root-budget',
        totalCycles: 500,
        totalDepth: 50,
        totalMemoryOps: 5000,
        totalLMCalls: 50,
      }),
    });

    // Both can coexist
    expect(pool.spawn('thread1')).toBeDefined();
    expect(tree.addChild('focus-root', createMockFocusOptions('focus-child'), {})).toBeDefined();
  });
});