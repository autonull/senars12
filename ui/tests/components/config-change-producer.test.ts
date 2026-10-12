import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { initConfigChangeProducer } from '../../src/client/core/config-change-producer.js';
import { $config, $configChanges, $workspaceGraph, clearConfigChanges } from '../../src/client/core/store.js';

describe('config-change producer', () => {
  beforeAll(() => {
    initConfigChangeProducer();
  });

  beforeEach(() => {
    clearConfigChanges();
  });

  it('records an adjustment in $configChanges and mirrors it into the live graph', () => {
    const before = $config.get();
    const density = before.density === 'compact' ? 'comfortable' : 'compact';
    $config.set({ ...before, density });

    expect($configChanges.get()).toHaveLength(1);
    expect($configChanges.get()[0]).toMatchObject({
      kind: 'config-change',
      role: 'system',
      data: { from: 'density', before: before.density, after: density },
    });
    expect([...$workspaceGraph.get().blocks.values()].some((block) => block.kind === 'config-change')).toBe(
      true
    );
  });

  it('keeps the durable trail across a graph replacement, as syncWorkspaceGraph performs', () => {
    const before = $config.get();
    $config.set({ ...before, showMinimap: !before.showMinimap });
    const recorded = $configChanges.get();
    expect(recorded).toHaveLength(1);

    $workspaceGraph.set({ ...$workspaceGraph.get() });
    expect($configChanges.get()).toBe(recorded);
  });
});
