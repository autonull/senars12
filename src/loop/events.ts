/**
 * Loop Events — event emission and subscription for the cognitive loop.
 */

import type { Clock } from '../kernel/env';
import { LOOP_EVENTS } from './types';
import type { LoopEvent, LoopEventType } from './types';

/** Event listener map. */
type ListenerMap = Map<LoopEventType, Set<(event: LoopEvent) => void>>;

/** Creates a new event emitter for loop events. */
export function createLoopEventEmitter(clock: Clock, defaultIteration = 0, defaultCorrelationId = ''): {
  emit: (type: LoopEventType, data: Record<string, unknown>) => void;
  on: (type: LoopEventType, listener: (event: LoopEvent) => void) => () => void;
  getListeners: () => ListenerMap;
  setDefaults: (iteration: number, correlationId: string) => void;
} {
  const listeners: ListenerMap = new Map();
  let currentIteration = defaultIteration;
  let currentCorrelationId = defaultCorrelationId;

  for (const eventType of LOOP_EVENTS) {
    listeners.set(eventType, new Set());
  }

  function emit(type: LoopEventType, data: Record<string, unknown>): void {
    const typeListeners = listeners.get(type);
    if (!typeListeners) return;

    const event: LoopEvent = {
      type,
      iteration: currentIteration,
      timestamp: clock.now(),
      correlationId: currentCorrelationId,
      data,
    };

    for (const listener of typeListeners) {
      try {
        listener(event);
      } catch {
        // Ignore listener errors
      }
    }
  }

  function on(type: LoopEventType, listener: (event: LoopEvent) => void): () => void {
    const typeListeners = listeners.get(type);
    if (!typeListeners) return () => {};
    typeListeners.add(listener);
    return () => typeListeners.delete(listener);
  }

  function getListeners(): ListenerMap {
    return listeners;
  }

  function setDefaults(iteration: number, correlationId: string): void {
    currentIteration = iteration;
    currentCorrelationId = correlationId;
  }

  return { emit, on, getListeners, setDefaults };
}