import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEFAULT_COGNITIVE_PARAMETERS } from '../../nar/src/config/cognitive-parameters.js';
import { Memory } from '../../nar/src/memory/index.js';
import {
  decodeMemoryState,
  encodeMemoryState,
  MEMORY_VERSION,
  validate,
} from '../../nar/src/memory/state/serialization.js';
import { NAR_STATE_VERSION, StatePersister } from '../../nar/src/nar/persistence.js';
import { decodeState, encodeState } from '../../nar/src/state/codec.js';
import { appConfigSchema } from '../../src/config/schema.js';
import { MIGRATIONS, migrateConfig, migrateConfigFile } from '../../src/utils/config-migrate.js';
import { deepFreeze } from '../../util/src/index.js';

/** Bench 66 — Configuration Hardening (TODO20 Phase 5: C1/C2/C3/C4, X7). */

const ROOT = join(import.meta.dirname, '../..');

const minimalConfig = { configVersion: '2.0', agent: { name: 'x' } };

describe('Bench 66 — C1 strict config schema', () => {
  it('accepts a minimal valid config', () => {
    const cfg = appConfigSchema.parse(minimalConfig);
    expect(cfg.profile.name).toBe('x');
  });

  it('rejects unknown top-level keys (typo protection)', () => {
    expect(() => appConfigSchema.parse({ ...minimalConfig, routng: {} })).toThrow(
      /routng|Invalid/i
    );
  });

  it('production.provider is pinned to the LMProviderName enum', () => {
    const file = JSON.parse(readFileSync(join(ROOT, 'senars.config.json'), 'utf-8'));
    expect(() => appConfigSchema.parse(file)).not.toThrow();
    expect(() =>
      appConfigSchema.parse({ ...minimalConfig, production: { provider: 'vercel' } })
    ).toThrow();
  });
});

describe('Bench 66 — C2 config migration', () => {
  it('v1 flat provider/model migrates to v2 lm section', () => {
    const { config, applied } = migrateConfig({
      configVersion: '1.0',
      model: 'm1',
      provider: 'p1',
    });
    expect(applied).toEqual(['1→2']);
    expect(config.configVersion).toBe('2.0');
    expect(config.lm).toEqual({ model: 'm1', provider: 'p1' });
  });

  it('current configs pass through unmigrated; newer versions are blocked', () => {
    expect(migrateConfig(minimalConfig).applied).toEqual([]);
    expect(migrateConfig({ configVersion: '3.0' }).blocked).toBeTruthy();
  });

  it('every migration chain step is registered so no version dead-ends', () => {
    const majors = Object.keys(MIGRATIONS).map(Number);
    for (const major of majors) expect(major + 1).toBeLessThanOrEqual(2);
    expect(migrateConfigFile).toBeTypeOf('function');
  });
});

describe('Bench 66 — C3 frozen cognitive parameters', () => {
  it('mutation throws in strict mode at every depth', () => {
    expect(() => {
      (DEFAULT_COGNITIVE_PARAMETERS as { lm: { enabled: boolean } }).lm.enabled = false;
    }).toThrow();
    const strategies = DEFAULT_COGNITIVE_PARAMETERS.strategies as unknown as Record<
      string,
      unknown
    >;
    expect(() => {
      strategies.sampling = {};
    }).toThrow();
  });

  it('deepFreeze is recursive', () => {
    const obj = deepFreeze({ a: { b: { c: 1 } } });
    expect(() => {
      (obj.a.b as { c: number }).c = 2;
    }).toThrow();
  });
});

describe('Bench 66 — X7 StateCodec', () => {
  it('round-trips an envelope', () => {
    const payload = { items: [1, 2, 3] };
    const decoded = decodeState<typeof payload>(
      encodeState('test.kind', 1, payload),
      'test.kind',
      1
    );
    expect(decoded).toEqual(payload);
  });

  it('fails loudly on version mismatch and kind mismatch', () => {
    const text = encodeState('a.kind', 99, {});
    expect(() => decodeState(text, 'a.kind', 1)).toThrow(/Unsupported state version/);
    expect(() => decodeState(encodeState('b.kind', 1, {}), 'a.kind', 1)).toThrow(/kind mismatch/);
  });

  it('StatePersister writes versioned envelopes and reads them back', async () => {
    const statePath = mkdtempSync(join(tmpdir(), 'bench66-'));
    const persister = new StatePersister({
      config: { persistState: true, statePath },
      memory: { addTask: () => {} } as never,
      processor: {
        serializeLMRules: () => ({ rules: [] }),
        deserializeLMRules: () => {},
      },
      attentionReport: () => ({ concepts: [], total: 0 }),
      query: { getBeliefs: () => [], getGoals: () => [], getQuestions: () => [] },
    });
    await persister.save();
    const written = readFileSync(join(statePath, 'beliefs.json'), 'utf-8');
    const envelope = JSON.parse(written) as { format: string; version: number; kind: string };
    expect(envelope.format).toBe('senars.state');
    expect(envelope.version).toBe(NAR_STATE_VERSION);
    expect(envelope.kind).toBe('nar.beliefs');
    await persister.load();
    rmSync(statePath, { recursive: true, force: true });
  });

  it('memory state codec round-trips and still accepts legacy bare payloads', () => {
    const memory = new Memory();
    const text = encodeMemoryState(memory);
    const decoded = decodeMemoryState(text);
    expect(decoded.version).toBe(MEMORY_VERSION);
    expect(validate(decoded)).toBe(true);
    // Legacy: bare SerializedMemory (no envelope) still loads.
    expect(decodeMemoryState(JSON.stringify(decoded)).version).toBe(MEMORY_VERSION);
  });
});
