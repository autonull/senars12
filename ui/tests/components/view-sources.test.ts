import { describe, expect, it } from 'vitest';
import { atom } from '../../src/client/core/store.js';
import { viewSource } from '../../src/client/core/view-sources.js';
import type { ViewDataset } from '../../src/client/core/view-spec.js';

describe('view source', () => {
  it('projects the atom value into a dataset and forwards notifications', () => {
    const values = atom<number[]>([1, 2, 3]);
    const source = viewSource<number[]>(values, (items): ViewDataset => ({
      kind: 'table',
      columns: [{ id: 'v', label: 'V' }],
      rows: items.map((v, index) => ({ id: String(index), v })),
    }));

    expect(source.get().kind).toBe('table');
    expect((source.get() as { rows: unknown[] }).rows).toHaveLength(3);

    let notifications = 0;
    const unsubscribe = source.subscribe?.(() => notifications++);
    values.set([7]);
    expect(notifications).toBe(1);
    expect((source.get() as { rows: unknown[] }).rows).toHaveLength(1);

    unsubscribe?.();
    values.set([8, 9]);
    expect(notifications).toBe(1);
  });
});