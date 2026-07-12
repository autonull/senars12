import type { CognitiveEvent, CognitiveEventSource } from '@senars/core/cognitive-event';
import type { LensSpec } from '@senars/core/lens-schema';
import { CognitiveBridge } from '@senars/ui/server/cognitive-bridge';
import type { IncomingFromServer } from '@senars/ui/shared/protocol';
import { beforeEach, describe, expect, it } from 'vitest';

type Handler = (event: CognitiveEvent) => void;

const SAMPLE_LENS: LensSpec = {
  id: 'urgency',
  label: 'Urgency',
  description: 'Size by priority',
  modulation: {
    op: 'union',
    children: [
      { op: 'channel', channel: 'size', child: { op: 'field', field: 'priority' } },
      { op: 'channel', channel: 'color', child: { op: 'const', value: '#0f0' } },
    ],
  },
};

class FakeSource implements Partial<CognitiveEventSource> {
  #handlers = new Set<Handler>();
  #submits: string[] = [];
  #caps: unknown = [];

  on(_event: string | '*', handler: Handler): void {
    this.#handlers.add(handler);
  }

  off(_event: string | '*', handler: Handler): void {
    this.#handlers.delete(handler);
  }

  emit(event: CognitiveEvent): void {
    for (const h of [...this.#handlers]) h(event);
  }

  handlerCount(): number {
    return this.#handlers.size;
  }

  submit(msg: string): void {
    this.#submits.push(msg);
  }

  submits(): string[] {
    return this.#submits;
  }

  setCapabilities(caps: unknown): void {
    this.#caps = caps;
  }

  capabilities() {
    return this.#caps as CognitiveEventSource['capabilities'] extends () => infer R ? R : never;
  }

  start() {}
  stop() {}
  health() {
    return { status: 'healthy' as const, lastCycle: 0, cycleCount: 0, errorRate: 0 };
  }
  mount() {}
  unmount() {}
}

function inputEvent(term: string): CognitiveEvent {
  return {
    type: 'input',
    term,
    source: 'ui',
    engine: 'nar',
    timestamp: 1,
    correlationId: 'c1',
  } as CognitiveEvent;
}

function mount(bridge: CognitiveBridge, source: FakeSource): IncomingFromServer[] {
  const sent: IncomingFromServer[] = [];
  bridge.mount(source as CognitiveEventSource, (msg) => sent.push(msg));
  return sent;
}

function deltas(sent: IncomingFromServer[]): IncomingFromServer[] {
  return sent.filter((m) => m.type === 'cognitive.delta');
}

function nodeIds(sent: IncomingFromServer[]): Set<string> {
  const ids = new Set<string>();
  for (const msg of sent) {
    if (msg.type === 'cognitive.delta') {
      for (const op of msg.ops) if (op.action === 'add_node') ids.add(op.id);
    }
  }
  return ids;
}

describe('CognitiveBridge supporting API (E2E prerequisites)', () => {
  let source: FakeSource;
  let bridge: CognitiveBridge;
  let sent: IncomingFromServer[];

  beforeEach(() => {
    source = new FakeSource();
    bridge = new CognitiveBridge();
    sent = mount(bridge, source);
  });

  describe('node truth editing', () => {
    it('updates a concept confidence and submits a node.truth command', () => {
      source.emit(inputEvent('<bird --> animal>.'));
      bridge.setNodeTruth('bird', { frequency: 0.9, confidence: 0.42 });

      expect(bridge.listConcepts().find((c) => c.term === 'bird')?.confidence).toBe(0.42);
      expect(source.submits().some((s) => s.startsWith('node.truth bird'))).toBe(true);
    });

    it('is a no-op for unknown concepts', () => {
      bridge.setNodeTruth('ghost', { frequency: 1, confidence: 1 });
      expect(source.submits()).toHaveLength(0);
    });
  });

  describe('revision history', () => {
    it('onNodeHistoryRequest emits an empty history for the term', () => {
      bridge.onNodeHistoryRequest('bird');
      const msg = sent.find((m) => m.type === 'node.history');
      expect(msg).toBeDefined();
      if (msg && msg.type === 'node.history') {
        expect(msg.term).toBe('bird');
        expect(msg.history).toEqual([]);
      }
    });

    it('getRevisionHistory returns [] (upstream Stamp chain not exposed)', () => {
      expect(bridge.getRevisionHistory('bird')).toEqual([]);
    });
  });

  describe('lens projection', () => {
    it('setLens re-emits a delta tagged with the chosen lens', () => {
      source.emit(inputEvent('<robin --> bird>.'));
      sent.length = 0;
      bridge.setLens('contradiction');
      const last = deltas(sent).at(-1);
      expect(last?.type === 'cognitive.delta' && last.lens).toBe('contradiction');
    });

    it('setFocus centers the projected graph on the focused term', () => {
      source.emit(inputEvent('<robin --> bird>.'));
      source.emit(inputEvent('<cat --> dog>.'));
      sent.length = 0;
      bridge.setFocus('bird');
      expect(nodeIds(sent).has('bird')).toBe(true);
    });

    it('setFocus filters out unrelated relation endpoints (Option A)', () => {
      source.emit(inputEvent('<robin --> bird>.'));
      source.emit(inputEvent('<cat --> dog>.'));
      sent.length = 0;
      bridge.setFocus('bird');
      const ids = nodeIds(sent);
      expect(ids.has('bird')).toBe(true);
      expect(ids.has('cat')).toBe(false);
      expect(ids.has('dog')).toBe(false);
      expect(ids.has('robin')).toBe(false);
    });

    it('no focus keeps the full relation projection (additive path)', () => {
      source.emit(inputEvent('<robin --> bird>.'));
      source.emit(inputEvent('<cat --> dog>.'));
      sent.length = 0;
      bridge.setFocus(null);
      const ids = nodeIds(sent);
      for (const term of ['robin', 'bird', 'cat', 'dog']) {
        expect(ids.has(term), `expected ${term} present with no focus`).toBe(true);
      }
    });
  });

  describe('initial state handshake', () => {
    it('sendInitialState sends schema, lens fields, lens list, and a delta', () => {
      source.emit(inputEvent('<sparrow {-- bird>'));
      sent.length = 0;
      bridge.sendInitialState();
      const types = new Set(sent.map((m) => m.type));
      expect(types.has('config.schema')).toBe(true);
      expect(types.has('lens.fields')).toBe(true);
      expect(types.has('lens.list')).toBe(true);
      expect(types.has('cognitive.delta')).toBe(true);
    });
  });

  describe('lens definition', () => {
    it('onLensDefine registers the lens and broadcasts lens.defined', () => {
      bridge.onLensDefine(SAMPLE_LENS);
      const def = sent.find((m) => m.type === 'lens.defined');
      expect(def?.type === 'lens.defined' && def.lens.id).toBe('urgency');
    });
  });

  describe('config', () => {
    it('getConfigSchema surfaces the source capability schema', () => {
      source.setCapabilities({ configSchema: { temperature: { type: 'number' } } });
      bridge.mount(source as CognitiveEventSource, () => {});
      expect(bridge.getConfigSchema().temperature).toEqual({ type: 'number' });
    });

    it('setConfig submits a config.set command', () => {
      bridge.setConfig('temperature', 0.7);
      expect(source.submits().some((s) => s.startsWith('config.set temperature'))).toBe(true);
    });
  });

  describe('state reporting', () => {
    it('listConcepts / attentionReport / getDriveManager reflect live concepts', () => {
      source.emit(inputEvent('<robin --> bird>.'));
      expect(bridge.listConcepts().some((c) => c.term === 'robin')).toBe(true);
      expect(bridge.attentionReport().concepts.some((c) => c.term === 'robin')).toBe(true);
      expect(bridge.getDriveManager()?.getAllStates().length).toBeGreaterThan(0);
    });

    it('reset clears all concepts', () => {
      source.emit(inputEvent('<robin --> bird>.'));
      bridge.reset();
      expect(bridge.listConcepts()).toHaveLength(0);
    });
  });

  describe('event subscription lifecycle', () => {
    it('subscribeEvents registers on the source and unsubscribe removes it', () => {
      const before = source.handlerCount();
      const unsub = bridge.subscribeEvents({} as never, () => 'belief');
      expect(source.handlerCount()).toBe(before + 1);
      unsub();
      expect(source.handlerCount()).toBe(before);
    });
  });
});
