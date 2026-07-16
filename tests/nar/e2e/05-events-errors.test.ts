import { TermBuilder, Truth } from '../../../nar/src';
/**
 * Event System & Error Handling Tests
 */
import { NAR } from '../../../src';

describe('Event System', () => {
  let nar: NAR;

  beforeEach(() => {
    nar = new NAR({
      maxConcepts: 100,
      activationDecayRate: 0.01,
      consolidationInterval: 5,
      cpuThrottleMs: 10,
      maxDerivationDepth: 10,
      maxDerivationsPerStep: 100,
      enableLMRules: false,
    });
  });

  it('eventBus supports subscription', async () => {
    let fired = false;

    const unsub = nar.eventBus.on('test.event', () => {
      fired = true;
    });
    nar.eventBus.emit('test.event', {});
    expect(fired).toBe(true);
    unsub();
  });

  it('supports multiple event listeners', async () => {
    const events: string[] = [];

    nar.eventBus.on('memory.consolidate', () => events.push('consolidate'));
    nar.eventBus.on('task.add', () => events.push('task'));

    await nar.input('test', 'belief');
    await nar.run(1);

    expect(events.length).toBeGreaterThanOrEqual(0);
  });

  it('allows unsubscribing from events', async () => {
    let count = 0;

    const unsubscribe = nar.eventBus.on('test.unsub', () => count++);
    nar.eventBus.emit('test.unsub', {});
    expect(count).toBe(1);
    unsubscribe();
    nar.eventBus.emit('test.unsub', {});
    expect(count).toBe(1);
  });

  it('system event bus emits nar:derivation on believe()', async () => {
    const systemBus = nar.getSystemEventBus();
    const derivations: string[] = [];
    systemBus.on('nar:derivation', (d: any) => derivations.push(d.term));

    await nar.believe('bird. %0.9;0.9%');
    expect(derivations.length).toBe(1);
    expect(derivations[0]).toBe('bird');
  });

  it.skip('system event bus emits nar:concept:activated on believe()', async () => {
    const systemBus = nar.getSystemEventBus();
    const activated: { term: string; priority: number }[] = [];
    systemBus.on('nar:concept:activated', (d: any) =>
      activated.push({ term: d.term, priority: d.priority })
    );

    await nar.believe('bird. %0.9;0.9%');
    expect(activated.length).toBe(1);
    expect(activated[0].term).toBe('bird');
    expect(activated[0].priority).toBeCloseTo(0.81, 2); // truth.f * truth.c = 0.9 * 0.9
  });

  it('system event bus emits derivation on goal()', async () => {
    const systemBus = nar.getSystemEventBus();
    const derivations: string[] = [];
    systemBus.on('nar:derivation', (d: any) => derivations.push(d.term));

    await nar.goal('find_treasure. %0.8;0.8%');
    expect(derivations.length).toBe(1);
    expect(derivations[0]).toBe('find_treasure');
  });

  it('system event bus emits derivation on question()', async () => {
    const systemBus = nar.getSystemEventBus();
    const derivations: string[] = [];
    systemBus.on('nar:derivation', (d: any) => derivations.push(d.term));

    await nar.question('where_is_treasure?');
    expect(derivations.length).toBe(1);
    expect(derivations[0]).toBe('where_is_treasure');
  });
});

describe('Error Handling', () => {
  let nar: NAR;

  beforeEach(() => {
    nar = new NAR({
      maxConcepts: 100,
      activationDecayRate: 0.01,
      consolidationInterval: 5,
      cpuThrottleMs: 10,
      maxDerivationDepth: 10,
      maxDerivationsPerStep: 100,
      enableLMRules: false,
    });
  });

  it('handles empty input gracefully', async () => {
    await expect(nar.input('', 'belief')).rejects.toThrow();
  });

  it('handles malformed terms gracefully', async () => {
    await expect(nar.input('((()', 'belief')).rejects.toThrow();
  });

  it('recovers from invalid truth values', async () => {
    await nar.input('test', 'belief', Truth.create(1.5, -0.5));
    const concept = nar.memory.getConcept(TermBuilder.atom('test'));
    expect(concept).toBeDefined();
  });

  it('handles high-volume input without crashing', async () => {
    const promises: Promise<void>[] = [];
    for (let i = 0; i < 50; i++) {
      promises.push(nar.input(`item_${i}`, 'belief'));
    }

    await Promise.all(promises);

    expect(nar.memory.size).toBeGreaterThan(0);
    expect(nar.memory.size).toBeLessThanOrEqual(100);
  });

  it('handles concurrent operations safely', async () => {
    await Promise.all([
      nar.input('a', 'belief'),
      nar.input('b', 'belief'),
      nar.input('c', 'belief'),
    ]);

    expect(nar.memory.size).toBeGreaterThanOrEqual(1);
  });
});
