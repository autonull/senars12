/**
 * CognitiveThread — lifecycle (spawn/join/kill) + mailbox + BudgetSlice inheritance.
 * Hard budget inheritance: spawn enforces Σ(child) ≤ parent.remaining; join returns unconsumed budget.
 */

import { BoundedRing, makeId, toError } from '@senars/util';
import {
  type BudgetAllocation,
  type BudgetSlice,
  type BudgetSliceOptions,
  chargeAllocation,
  consumeCycles,
  createBudgetSlice,
  isExhausted,
  remainingAll,
  remainingCycles,
  resolveAllocation,
  sliceBudget,
  snapshotBudget,
} from './budget.js';
import { emitDomainEvent } from './event-sink.js';

/** Why a send was admitted or refused — and the pairing is exact: `allowed ⇔ reason !== refusal`. */
export type BackpressureReason = 'budget-exhausted' | 'mailbox-full' | 'ok';

/** One backpressure decision, as a trace event. Core reaches the tracer through the sink. */
const emitBackpressureDecision = (attributes: {
  threadId: string;
  allowed: boolean;
  reason: BackpressureReason;
  budgetRemaining: number;
  mailboxSize: number;
  mailboxCapacity: number;
}): void => {
  emitDomainEvent('thread.backpressure', '', attributes);
};

export type ThreadStatus = 'created' | 'running' | 'waiting' | 'completed' | 'killed' | 'error';

export interface ThreadMessage {
  readonly id: string;
  readonly type: 'task' | 'control' | 'result' | 'error';
  readonly payload: unknown;
  readonly timestamp: number;
  readonly correlationId?: string;
}

export type { BudgetAllocation };

export interface CognitiveThreadOptions {
  readonly id: string;
  readonly parentBudget: BudgetSlice;
  readonly budgetAllocation?: BudgetAllocation;
  readonly mailboxCapacity?: number;
}

export interface SpawnResult {
  thread: CognitiveThread;
  remainingBudget: BudgetAllocation;
}

export interface JoinResult {
  result: unknown;
  unconsumedBudget: BudgetAllocation;
}

/**
 * A bounded FIFO of messages. A mailbox is a bounded ring that *refuses* rather
 * than evicts — a dropped message is a silently lost request, where a refused one
 * is a backpressure signal the sender is told about — so the policy is the only
 * thing that differs and the ring is the whole implementation. That it satisfies
 * `BoundedContainer` is the point: the mailbox now reports `pressure()` like every
 * other bounded structure instead of being the one a capacity report skips.
 */
export type ThreadMailbox = BoundedRing<ThreadMessage>;

/** A mailbox that refuses at capacity rather than evicting. */
const createMailbox = (capacity: number): ThreadMailbox => new BoundedRing(capacity, 'refuse');

export class CognitiveThread {
  readonly id: string;
  readonly budget: BudgetSlice;
  readonly mailbox: ThreadMailbox;
  readonly parentId?: string;
  private status: ThreadStatus = 'created';
  private readonly children = new Set<string>();
  private result: unknown = null;
  private error: Error | null = null;
  private readonly onComplete?: (result: unknown) => void;
  private readonly onError?: (error: Error) => void;

  constructor(options: CognitiveThreadOptions) {
    this.id = options.id;
    this.parentId = options.parentBudget.id;
    this.budget = sliceBudget(options.parentBudget, options.id, options.budgetAllocation ?? {});
    this.mailbox = createMailbox(options.mailboxCapacity ?? 100);
  }

  /** Spawn a child thread with hard budget inheritance: Σ(child) ≤ parent.remaining. */
  spawn(childId: string, allocation?: BudgetAllocation): SpawnResult {
    const shares = this.children.size + 2;
    const childAllocation = resolveAllocation(this.budget, allocation, (remaining) => ({
      cycles: Math.floor(remaining.cycles / shares),
      depth: remaining.depth,
      memoryOps: Math.floor(remaining.memoryOps / shares),
      llmCalls: Math.floor(remaining.llmCalls / shares),
    }));
    chargeAllocation(this.budget, childAllocation);

    const child = new CognitiveThread({
      id: childId,
      parentBudget: this.budget,
      budgetAllocation: childAllocation,
      mailboxCapacity: 50,
    });
    this.children.add(child.id);

    return { thread: child, remainingBudget: remainingAll(this.budget) };
  }

  /**
   * Record a backpressure decision. Every reason a send can be refused or
   * admitted reports the same five facts, so the reporting is one call and the
   * only thing a branch chooses is the verdict.
   */
  #backpressure(allowed: boolean, reason: BackpressureReason): void {
    emitBackpressureDecision({
      threadId: this.id,
      allowed,
      reason,
      budgetRemaining: remainingCycles(this.budget),
      mailboxSize: this.mailbox.size(),
      mailboxCapacity: this.mailbox.capacity,
    });
  }

  /** Send a message to this thread's mailbox with budget-gated backpressure. */
  send(message: Omit<ThreadMessage, 'id' | 'timestamp'>): boolean {
    // Check budget before enqueueing
    if (isExhausted(this.budget)) {
      this.#backpressure(false, 'budget-exhausted');
      return false;
    }
    // Consume 1 cycle for message handling overhead
    if (!consumeCycles(this.budget, 1)) {
      this.#backpressure(false, 'budget-exhausted');
      return false;
    }

    const enqueued = this.mailbox.tryPush({
      ...message,
      id: makeId(),
      timestamp: Date.now(),
    });
    this.#backpressure(enqueued, enqueued ? 'ok' : 'mailbox-full');
    return enqueued;
  }

  /** Receive a message from the mailbox. */
  receive(): ThreadMessage | undefined {
    return this.mailbox.shift();
  }

  /** Execute the thread's work function. */
  async run<T>(work: (thread: CognitiveThread) => Promise<T>): Promise<T> {
    this.status = 'running';
    try {
      // Consume one cycle for thread overhead
      consumeCycles(this.budget, 1);

      this.result = await work(this);
      this.status = 'completed';
      return this.result as T;
    } catch (err) {
      this.error = toError(err);
      this.status = 'error';
      throw this.error;
    }
  }

  /** Wait for thread completion (join) and return unconsumed budget. */
  async join(): Promise<JoinResult> {
    // In single-threaded mode, the thread runs synchronously
    // This is a no-op for the current thread, but provides the API for future parallel execution
    if (this.status === 'running') {
      // In true parallel implementation, this would wait on a promise
      // For now, we assume run() was already awaited
    }
    if (this.error) throw this.error;

    return { result: this.result, unconsumedBudget: remainingAll(this.budget) };
  }

  /** Kill the thread and all children. */
  kill(reason = 'killed'): void {
    this.status = 'killed';
    this.error = new Error(`Thread killed: ${reason}`);
    // Merge consumption back to parent budget
    // In a real implementation, this would signal child threads to stop
  }

  /** Check if thread can continue (budget not exhausted). */
  canContinue(): boolean {
    return !isExhausted(this.budget) && this.status === 'running';
  }

  /** Consume budget for an operation. */
  consume(cycles = 1, depth = 0, memoryOps = 0, llmCalls = 0): boolean {
    return consumeCycles(this.budget, cycles);
  }

  /** Get current status. */
  getStatus(): ThreadStatus {
    return this.status;
  }

  /** Get child thread IDs. */
  getChildren(): string[] {
    return [...this.children];
  }

  /** Get thread result. */
  getResult(): unknown {
    return this.result;
  }

  /** Get thread error. */
  getError(): Error | null {
    return this.error;
  }

  /** Get budget consumption snapshot. */
  getBudgetSnapshot(): BudgetSlice {
    return { ...snapshotBudget(this.budget), id: this.budget.id, parentId: this.budget.parentId };
  }

  /** Get unconsumed budget without joining. */
  getUnconsumedBudget(): BudgetAllocation {
    return remainingAll(this.budget);
  }
}

/** Thread pool for managing multiple threads. */
export class ThreadPool {
  private readonly threads = new Map<string, CognitiveThread>();
  private readonly rootBudget: BudgetSlice;
  private readonly maxThreads: number;

  constructor(rootBudget: BudgetSlice, maxThreads = 10) {
    this.rootBudget = rootBudget;
    this.maxThreads = maxThreads;
  }

  /** Spawn a new thread. */
  spawn(id: string, options?: Partial<CognitiveThreadOptions>): CognitiveThread | null {
    if (this.threads.size >= this.maxThreads) return null;
    if (this.threads.has(id)) return null;

    const thread = new CognitiveThread({
      id,
      parentBudget: this.rootBudget,
      ...options,
    });
    this.threads.set(id, thread);
    return thread;
  }

  /** Spawn a new thread with hard budget inheritance. Returns SpawnResult. */
  spawnWithBudget(id: string, allocation?: BudgetAllocation): SpawnResult | null {
    if (this.threads.size >= this.maxThreads) return null;
    if (this.threads.has(id)) return null;

    const childAllocation = resolveAllocation(
      this.rootBudget,
      allocation,
      (remaining) => remaining
    );
    chargeAllocation(this.rootBudget, childAllocation);

    const thread = new CognitiveThread({
      id,
      parentBudget: this.rootBudget,
      budgetAllocation: childAllocation,
      mailboxCapacity: 50,
    });
    this.threads.set(id, thread);

    return { thread, remainingBudget: remainingAll(this.rootBudget) };
  }

  /** Get a thread by ID. */
  get(id: string): CognitiveThread | undefined {
    return this.threads.get(id);
  }

  /** Kill a thread. */
  kill(id: string): boolean {
    const thread = this.threads.get(id);
    if (!thread) return false;
    thread.kill();
    this.threads.delete(id);
    return true;
  }

  /** Kill all threads. */
  killAll(): void {
    for (const thread of this.threads.values()) {
      thread.kill();
    }
    this.threads.clear();
  }

  /** Get all thread statuses. */
  getStatuses(): Map<string, ThreadStatus> {
    const statuses = new Map<string, ThreadStatus>();
    for (const [id, thread] of this.threads) {
      statuses.set(id, thread.getStatus());
    }
    return statuses;
  }

  /** Wait for all threads to complete. */
  async joinAll(): Promise<Map<string, unknown>> {
    const results = new Map<string, unknown>();
    for (const [id, thread] of this.threads) {
      try {
        results.set(id, await thread.join());
      } catch (err) {
        results.set(id, err);
      }
    }
    return results;
  }
}

/** Create a root budget slice for the main thread. */
export function createRootBudget(
  options: Omit<BudgetSliceOptions, 'id' | 'parentId'> & { id?: string }
): BudgetSlice {
  return createBudgetSlice({ id: options.id ?? 'root', parentId: undefined, ...options });
}

/** Create a cognitive thread with default options. */
export function createCognitiveThread(
  id: string,
  parentBudget: BudgetSlice,
  options?: Partial<CognitiveThreadOptions>
): CognitiveThread {
  return new CognitiveThread({ id, parentBudget, ...options });
}
