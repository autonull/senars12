import type { CognitiveEventSource } from '@senars/core/cognitive-event';
import type { IncomingFromServer } from '@senars/ui/shared/protocol';
import { SeNARSFactory } from '@senars/nar';
import { beforeAll, describe, expect, it } from 'vitest';
import { CognitiveBridge } from '@senars/ui/server/cognitive-bridge';

class SilentSource implements Partial<CognitiveEventSource> {
  on() {}
  off() {}
  capabilities() {
    return [];
  }
  start() {}
  stop() {}
  submit() {}
  health() {
    return { status: 'healthy' as const, lastCycle: 0, cycleCount: 0, errorRate: 0 };
  }
  mount() {}
  unmount() {}
}

describe('CognitiveBridge.syncFromNAR with a real NAR', () => {
  let sent: IncomingFromServer[];

  beforeAll(async () => {
    const nar = SeNARSFactory.createMinimal();
    await nar.believe('<bird --> animal>.');
    await nar.believe('<robin --> bird>.');
    await nar.believe('<sky --> blue>.');
    await nar.run(5);

    sent = [];
    const bridge = new CognitiveBridge(nar);
    bridge.mount(new SilentSource() as CognitiveEventSource, (msg) => sent.push(msg));
    bridge.syncFromNAR();
  });

  it('captures concept nodes from the NAR', () => {
    const ids = new Set<string>();
    for (const msg of sent) {
      if (msg.type === 'cognitive.delta') {
        for (const op of msg.ops) if (op.action === 'add_node') ids.add(op.id);
      }
    }
    for (const term of ['bird', 'animal', 'robin', 'sky', 'blue']) {
      expect(ids.has(term), `expected concept node for ${term}`).toBe(true);
    }
  });

  it('emits inheritance edges from Narsese relations', () => {
    const edges: Array<{ source: string; target: string; type: string }> = [];
    for (const msg of sent) {
      if (msg.type === 'cognitive.delta') {
        for (const op of msg.ops) {
          if (op.action === 'add_edge') {
            edges.push({ source: op.source, target: op.target, type: op.data.type });
          }
        }
      }
    }
    expect(
      edges.some((e) => e.source === 'bird' && e.target === 'animal' && e.type === 'inheritance'),
      `edges: ${JSON.stringify(edges)}`,
    ).toBe(true);
    expect(
      edges.some((e) => e.source === 'robin' && e.target === 'bird' && e.type === 'inheritance'),
    ).toBe(true);
  });
});
