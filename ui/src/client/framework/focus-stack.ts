/**
 * The focus stack — navigation is reversible (§2, invariant 3).
 *
 * One focus is the subject of everything; visiting a new subject pushes history,
 * so back / forward / "return to context" always work. The stack is pure: the
 * store binds it, it does not bind the store.
 */

import { type FocusRef, focusEquals, MIND_FOCUS } from './coordinates.js';

type Listener = (ref: FocusRef) => void;

/** A reversible focus history. */
export interface FocusStack {
  current(): FocusRef;
  history(): readonly FocusRef[];
  canGoBack(): boolean;
  canGoForward(): boolean;
  /** Move to a subject, pushing the previous one onto history. */
  set(ref: FocusRef): void;
  /** Move to a subject without recording history (e.g. decay-driven re-centring). */
  replace(ref: FocusRef): void;
  back(): FocusRef;
  forward(): FocusRef;
  reset(ref?: FocusRef): void;
  subscribe(listener: Listener): () => void;
}

const DEFAULT_CAPACITY = 100;

class Stack implements FocusStack {
  private past: FocusRef[] = [];
  private present: FocusRef;
  private future: FocusRef[] = [];
  private readonly listeners = new Set<Listener>();

  constructor(
    initial: FocusRef = MIND_FOCUS,
    private readonly capacity = DEFAULT_CAPACITY
  ) {
    this.present = initial;
  }

  current(): FocusRef {
    return this.present;
  }

  history(): readonly FocusRef[] {
    return this.past;
  }

  canGoBack(): boolean {
    return this.past.length > 0;
  }

  canGoForward(): boolean {
    return this.future.length > 0;
  }

  set(ref: FocusRef): void {
    if (focusEquals(ref, this.present)) return;
    this.past = [...this.past, this.present].slice(-this.capacity);
    this.future = [];
    this.present = ref;
    this.emit();
  }

  replace(ref: FocusRef): void {
    if (focusEquals(ref, this.present)) return;
    this.present = ref;
    this.emit();
  }

  back(): FocusRef {
    const previous = this.past[this.past.length - 1];
    if (!previous) return this.present;
    this.past = this.past.slice(0, -1);
    this.future = [this.present, ...this.future];
    this.present = previous;
    this.emit();
    return this.present;
  }

  forward(): FocusRef {
    const [next, ...rest] = this.future;
    if (!next) return this.present;
    this.future = rest;
    this.past = [...this.past, this.present].slice(-this.capacity);
    this.present = next;
    this.emit();
    return this.present;
  }

  reset(ref: FocusRef = MIND_FOCUS): void {
    this.past = [];
    this.future = [];
    this.present = ref;
    this.emit();
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(): void {
    for (const listener of this.listeners) listener(this.present);
  }
}

/** Create a focus stack rooted at `initial` (the ambient `mind` by default). */
export const createFocusStack = (initial?: FocusRef, capacity?: number): FocusStack =>
  new Stack(initial, capacity);
