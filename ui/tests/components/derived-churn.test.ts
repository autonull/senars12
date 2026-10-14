/**
 * The derived-selection guard: a source change that leaves the derived value
 * equal must not notify subscribers (no churn). Covers the graph node
 * selection and the view-system selection (`$viewSelection`).
 */
import { afterEach, describe, expect, it } from 'vitest';
import {
  $selectedNodeId,
  $selectedNodeIds,
  $viewSelection,
  $workspaceGraph,
  emptyWorkspaceGraph,
} from '../../src/client/core/store.js';

const setSelection = (refs: Iterable<string>): void =>
  $workspaceGraph.set({ ...$workspaceGraph.get(), selection: new Set(refs) });

const count = (readable: { subscribe: (fn: () => void) => () => void }) => {
  let calls = 0;
  const off = readable.subscribe(() => (calls += 1));
  return { calls: () => calls, off };
};

afterEach(() => {
  $workspaceGraph.set(emptyWorkspaceGraph());
  $selectedNodeId.set(null);
});

describe('derived selection does not churn', () => {
  it('notifies $selectedNodeIds only when the node selection actually changes', () => {
    const c = count($selectedNodeIds);
    setSelection(['a']);
    expect(c.calls()).toBe(1);
    setSelection(['a']);
    expect(c.calls()).toBe(1);
    setSelection(['a', 'b']);
    expect(c.calls()).toBe(2);
    c.off();
  });

  it('notifies $viewSelection only when focus or nodes change', () => {
    const c = count($viewSelection);
    $selectedNodeId.set('n1');
    expect(c.calls()).toBe(1);
    $selectedNodeId.set('n1');
    expect(c.calls()).toBe(1);
    setSelection([]);
    expect(c.calls()).toBe(1);
    $selectedNodeId.set('n2');
    expect(c.calls()).toBe(2);
    c.off();
  });

  it('reflects the graph selection as the view selection nodes', () => {
    setSelection(['a', 'b']);
    expect([...$viewSelection.get().nodes].sort()).toEqual(['a', 'b']);
  });
});
