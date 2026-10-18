import { describe, expect, it } from 'vitest';
import {
  createMockLMService,
  type PerceivedInterpretation,
  validateInterpretation,
} from '@senars/nar';
import type { NARConfig } from '@senars/nar/facade/config.js';
import { NAR } from '@senars/nar/nar.js';
import { NarEventBus } from '@senars/nar/types/events.js';
import { e2eNARConfig } from '../e2e/fixtures.js';

/**
 * CORE.19 C6 — the neuro-symbolic voice.
 *
 * One formalizer contract with a deterministic (null) provider and a hosted one
 * (D10), one firewall validation gate, admission only through the perception
 * gate (`llm-proposed` tagged, D17), and an explanation generator that cites
 * the kernel's own rule-fire records (C6.4).
 */

interface Captured {
  channel: string;
  payload: unknown;
}

const buildNar = (overrides: Partial<NARConfig> = {}): { nar: NAR; events: Captured[] } => {
  const bus = new NarEventBus();
  const events: Captured[] = [];
  const nar = new NAR(e2eNARConfig({ eventBus: bus, persistState: false, ...overrides }));
  const original = (bus as { emit: (channel: string, payload: unknown) => void }).emit.bind(bus);
  (bus as { emit: (channel: string, payload: unknown) => void }).emit = (channel, payload) => {
    events.push({ channel, payload });
    original(channel, payload);
  };
  return { nar, events };
};

const start = async (nar: NAR): Promise<void> => {
  await nar.initialize();
  await nar.start();
};

const stop = async (nar: NAR): Promise<void> => {
  await nar.stop();
  await nar.dispose();
};

const taskBatch = (term: string) => ({
  beliefs: [{ narsese: term, source: 'user' as const }],
  questions: [],
  goals: [],
  meta: {
    detectedIntent: 'learning' as const,
    ambiguities: [],
    coreferences: [],
    implicitContext: [],
  },
});

describe('CORE.19 C6 — structured formalizer (no LM, D10)', () => {
  it('formalizes Narsese deterministically and tags it user', async () => {
    const { nar } = buildNar();
    await start(nar);

    const interpretation = await nar.formalize('(bird --> animal).');
    expect(interpretation.provider).toBe('structured');
    expect(interpretation.createdBy).toBe('user');
    expect(interpretation.candidates).toHaveLength(1);
    expect(interpretation.candidates[0]!.taskType).toBe('belief');
    expect(interpretation.candidates[0]!.narsese).toContain('bird');

    await stop(nar);
  });

  it('perceives Narsese through the one gate and stores it', async () => {
    const { nar } = buildNar();
    await start(nar);

    const result = await nar.perceive('(bird --> animal).');
    expect(result.admitted).toHaveLength(1);
    expect(result.admitted[0]!.source).toBe('user');
    expect(result.rejected).toEqual([]);
    expect(nar.getBeliefs().some((b) => b.term.toString().includes('bird'))).toBe(true);

    await stop(nar);
  });

  it('declares a rejection instead of a silent no-op when the input is not Narsese', async () => {
    const { nar } = buildNar();
    await start(nar);

    const result = await nar.perceive('birds can fly');
    expect(result.admitted).toEqual([]);
    expect(result.interpretation.candidates).toEqual([]);
    expect(result.rejected[0]?.reason).toMatch(/not Narsese/);

    await stop(nar);
  });

  it('refuses a tool invocation the firewall blocks', async () => {
    const { nar } = buildNar();
    await start(nar);

    const interpretation = await nar.formalize('tool(arg).');
    expect(interpretation.candidates).toEqual([]);
    expect(interpretation.rejection).toMatch(/firewall/);

    await stop(nar);
  });
});

describe('CORE.19 C6 — validation gate', () => {
  it('drops an out-of-range truth and a blocked operator, keeping the valid candidate', () => {
    const interpretation: PerceivedInterpretation = {
      batchId: 'b',
      sourceText: 'x',
      createdBy: 'llm-proposed',
      provider: 'test',
      candidates: [
        {
          candidateId: 'good',
          narsese: '(a --> b)',
          taskType: 'belief',
          confidence: 0.6,
          sourceSpans: [],
          ambiguityFlags: [],
        },
        {
          candidateId: 'bad-truth',
          narsese: '(a --> b)',
          taskType: 'belief',
          truth: { frequency: 2, confidence: 0.9 },
          confidence: 0.9,
          sourceSpans: [],
          ambiguityFlags: [],
        },
        {
          candidateId: 'bad-op',
          narsese: 'tool(arg)',
          taskType: 'goal',
          confidence: 0.5,
          sourceSpans: [],
          ambiguityFlags: [],
        },
      ],
    };

    const { interpretation: valid, rejected } = validateInterpretation(interpretation);
    expect(valid.candidates.map((c) => c.candidateId)).toEqual(['good']);
    expect(rejected.map((r) => r.candidateId)).toEqual(['bad-truth', 'bad-op']);
    expect(rejected.every((r) => r.reason.length > 0)).toBe(true);
  });
});

describe('CORE.19 C6 — hosted formalizer (LM, D17)', () => {
  const withLm = (generateObjectFn: () => unknown) =>
    buildNar({ lmService: createMockLMService({ generateObjectFn: generateObjectFn as never }) });

  it('formalizes natural language and tags it llm-proposed', async () => {
    const { nar } = withLm(() => taskBatch('(salt --> soluble)'));
    await start(nar);

    const interpretation = await nar.formalize('salt dissolves in water');
    expect(interpretation.provider).toBe('mock');
    expect(interpretation.createdBy).toBe('llm-proposed');
    expect(interpretation.candidates).toHaveLength(1);

    const result = await nar.perceive('salt dissolves in water');
    expect(result.admitted).toHaveLength(1);
    expect(result.admitted[0]!.source).toBe('llm');

    await stop(nar);
  });

  it('rejects an unparseable candidate with a reason rather than admitting it', async () => {
    const { nar } = withLm(() => taskBatch('(a -->'));
    await start(nar);

    const result = await nar.perceive('gibberish');
    expect(result.admitted).toEqual([]);
    expect(result.rejected.some((r) => r.reason.length > 0)).toBe(true);

    await stop(nar);
  });
});

describe('CORE.19 C6 — explanation cites real derivation records', () => {
  it('walks the fire records and announces the explanation', async () => {
    const { nar, events } = buildNar();
    await start(nar);

    await nar.input('(a --> b).');
    await nar.input('(b --> c).');
    await nar.step();

    const fires = nar.getRuleFires();
    expect(fires.length).toBeGreaterThan(0);
    const conclusion = fires[fires.length - 1]!.conclusion;

    const explanation = await nar.explainDerivation(conclusion);
    expect(explanation.conclusion).toBe(conclusion);
    expect(explanation.steps).toBeGreaterThan(0);
    expect(explanation.derivationIds.length).toBe(explanation.steps);
    for (const id of explanation.derivationIds) {
      expect(nar.getRuleFireById(id)).toBeDefined();
    }
    expect(explanation.derivationIds).toContain(fires[fires.length - 1]!.stepId);
    expect(explanation.facts.length).toBe(explanation.steps);
    expect(explanation.narrative).toContain(conclusion);
    expect(explanation.paraphrase).toBeUndefined();

    const emitted = events.find((e) => e.channel === 'explanation');
    expect(emitted).toBeDefined();
    expect(emitted?.payload).toMatchObject({ conclusion, paraphrased: false });

    await stop(nar);
  });

  it('produces a deterministic narrative when there is no recorded derivation', async () => {
    const { nar } = buildNar();
    await start(nar);

    const explanation = await nar.explainDerivation('(unknown --> term)');
    expect(explanation.steps).toBe(0);
    expect(explanation.narrative).toMatch(/No recorded derivation/);

    await stop(nar);
  });
});

describe('CORE.19 C6 — deterministic generation (null provider)', () => {
  it('falls back to a structured narrative with no LM configured', async () => {
    const { nar } = buildNar();
    await start(nar);

    const output = await nar.getFormalizer().formalToNl({
      query: 'x',
      derivation: null,
      beliefs: [],
      conflicts: [],
    });
    expect(output.response).toMatch(/don't have enough information/);

    await stop(nar);
  });
});

describe('CORE.19 C6 — contradiction showcase', () => {
  it('detects coexisting contradictory beliefs and explains the conflict', async () => {
    const { nar, events } = buildNar();
    await start(nar);

    await nar.input('(a --> b).');
    await nar.input('--(a --> b).');

    const pairs = nar.findContradictions();
    expect(pairs).toHaveLength(1);

    const conflict = await nar.explainConflict(pairs[0]!.a, pairs[0]!.b);
    expect(conflict.terms).toHaveLength(2);
    expect(conflict.sides).toHaveLength(2);
    expect(conflict.narrative).toMatch(/Conflict:/);
    expect(conflict.narrative).toContain(conflict.terms[0]);
    expect(conflict.narrative).toContain(conflict.terms[1]);

    const emitted = events.find(
      (e) => e.channel === 'explanation' && (e.payload as { conflict?: boolean }).conflict === true
    );
    expect(emitted).toBeDefined();

    await stop(nar);
  });

  it('cites the real derivation records of the derived side', async () => {
    const { nar } = buildNar();
    await start(nar);

    await nar.input('(a --> b).');
    await nar.input('(b --> c).');
    await nar.step();
    expect(nar.findContradictions()).toEqual([]);

    await nar.input('--(a --> c).');
    const pairs = nar.findContradictions();
    expect(pairs).toHaveLength(1);

    const conflict = await nar.explainConflict(pairs[0]!.a, pairs[0]!.b);
    const derivedSide = conflict.sides.find((side) => side.steps > 0);
    expect(derivedSide).toBeDefined();
    for (const id of derivedSide!.derivationIds) {
      expect(nar.getRuleFireById(id)).toBeDefined();
    }

    await stop(nar);
  });
});
