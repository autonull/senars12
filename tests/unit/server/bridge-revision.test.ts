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

describe('CognitiveBridge revision history delegation', () => {
  let nar: ReturnType<typeof SeNARSFactory.createMinimal>;
  let bridge: CognitiveBridge;
  let sent: IncomingFromServer[];

  beforeAll(async () => {
    nar = SeNARSFactory.createMinimal();
    await nar.believe('<bird --> animal>.');
    await nar.believe('<bird --> animal>. %0.3;0.8%');
    await nar.run(3);

    sent = [];
    bridge = new CognitiveBridge(nar);
    bridge.mount(new SilentSource() as CognitiveEventSource, (msg) => sent.push(msg));
  });

  it('getRevisionHistory returns non-empty real entries for a believed statement', () => {
    const history = bridge.getRevisionHistory('<bird --> animal>');
    expect(history.length).toBeGreaterThanOrEqual(2);
    expect(history[0]!.source).toBe('revision');
  });

  it('getRevisionHistory falls back to [] without a NAR attached', () => {
    const detached = new CognitiveBridge();
    expect(detached.getRevisionHistory('<bird --> animal>')).toEqual([]);
  });

  it('onNodeHistoryRequest emits real history over the wire', () => {
    sent.length = 0;
    bridge.onNodeHistoryRequest('<bird --> animal>');
    const msg = sent.find((m) => m.type === 'node.history');
    expect(msg).toBeDefined();
    if (msg && msg.type === 'node.history') {
      expect(msg.term).toBe('<bird --> animal>');
      expect(msg.history.length).toBeGreaterThanOrEqual(2);
    }
  });
});
