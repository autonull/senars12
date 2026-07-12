import type { CognitiveEvent, CognitiveEventSource } from '@senars/core/cognitive-event';
import { CognitiveBridge } from '@senars/ui/server/cognitive-bridge';
import type { IncomingFromServer } from '@senars/ui/shared/protocol';
import { beforeEach, describe, expect, it } from 'vitest';

type Handler = (event: CognitiveEvent) => void;

class FakeSource implements Partial<CognitiveEventSource> {
  #handlers = new Set<Handler>();

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

function inputEvent(term: string, source = 'ui'): CognitiveEvent {
  return {
    type: 'input',
    term,
    source,
    engine: 'nar',
    timestamp: 1,
    correlationId: 'c1',
  } as CognitiveEvent;
}

function activatedEvent(term: string, priority = 0.8): CognitiveEvent {
  return {
    type: 'concept:activated',
    term,
    priority,
    engine: 'nar',
    timestamp: 2,
    correlationId: 'c2',
  } as CognitiveEvent;
}

function collect(bridge: CognitiveBridge, source: FakeSource): IncomingFromServer[] {
  const sent: IncomingFromServer[] = [];
  bridge.mount(source as CognitiveEventSource, (msg) => sent.push(msg));
  return sent;
}

function nodeIds(ops: IncomingFromServer[]): Set<string> {
  const ids = new Set<string>();
  for (const msg of ops) {
    if (msg.type === 'cognitive.delta') {
      for (const op of msg.ops) if (op.action === 'add_node') ids.add(op.id);
    }
  }
  return ids;
}

function edges(ops: IncomingFromServer[]): Array<{ source: string; target: string; type: string }> {
  const result: Array<{ source: string; target: string; type: string }> = [];
  for (const msg of ops) {
    if (msg.type === 'cognitive.delta') {
      for (const op of msg.ops) {
        if (op.action === 'add_edge')
          result.push({ source: op.source, target: op.target, type: op.data.type });
      }
    }
  }
  return result;
}

describe('CognitiveBridge relation-edge projection', () => {
  let source: FakeSource;
  let bridge: CognitiveBridge;
  let sent: IncomingFromServer[];

  beforeEach(() => {
    source = new FakeSource();
    bridge = new CognitiveBridge();
    sent = collect(bridge, source);
  });

  it('grows the graph from an input Narsese relation', () => {
    const before = bridge.listConcepts().length;
    source.emit(inputEvent('<bird --> animal>.'));

    expect(bridge.listConcepts().length).toBeGreaterThan(before);
    const ids = nodeIds(sent);
    expect(ids.has('bird')).toBe(true);
    expect(ids.has('animal')).toBe(true);
  });

  it('creates an inheritance edge for --> relations', () => {
    source.emit(inputEvent('<bird --> animal>.'));
    const rels = edges(sent);
    expect(
      rels.some((e) => e.source === 'bird' && e.target === 'animal' && e.type === 'inheritance')
    ).toBe(true);
  });

  it('creates similarity and instance edges for <-> and {--', () => {
    source.emit(activatedEvent('<cat <-> dog>'));
    source.emit(activatedEvent('<sparrow {-- bird>'));
    const rels = edges(sent);
    expect(
      rels.some((e) => e.source === 'cat' && e.target === 'dog' && e.type === 'similarity')
    ).toBe(true);
    expect(
      rels.some((e) => e.source === 'sparrow' && e.target === 'bird' && e.type === 'instance')
    ).toBe(true);
  });

  it('accumulates concepts across multiple live inputs', () => {
    source.emit(inputEvent('<robin --> bird>.'));
    source.emit(inputEvent('<bird --> animal>.'));
    const ids = nodeIds(sent);
    for (const term of ['robin', 'bird', 'animal']) expect(ids.has(term)).toBe(true);
  });
});

describe('CognitiveBridge mount lifecycle', () => {
  it('registers a single listener and mounts idempotently', () => {
    const source = new FakeSource();
    const bridge = new CognitiveBridge();
    bridge.mount(source as CognitiveEventSource, () => {});
    bridge.mount(source as CognitiveEventSource, () => {});
    bridge.mount(source as CognitiveEventSource, () => {});
    expect(source.handlerCount()).toBe(1);
  });

  it('removes its listener on unmount', () => {
    const source = new FakeSource();
    const bridge = new CognitiveBridge();
    bridge.mount(source as CognitiveEventSource, () => {});
    bridge.unmount();
    expect(source.handlerCount()).toBe(0);
  });

  it('re-binds when the event source changes', () => {
    const a = new FakeSource();
    const b = new FakeSource();
    const bridge = new CognitiveBridge();
    bridge.mount(a as CognitiveEventSource, () => {});
    bridge.mount(b as CognitiveEventSource, () => {});
    expect(a.handlerCount()).toBe(0);
    expect(b.handlerCount()).toBe(1);
  });
});
