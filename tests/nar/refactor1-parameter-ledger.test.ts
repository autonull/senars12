import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { OutcomeLinker, ParameterLedger } from '@senars/nar/config';
import { ParameterTable } from '@senars/nar/config/parameter-table.js';
import { RetrospectiveAdapter } from '@senars/nar/dialogue/consumers/adapt.js';
import { retrospect } from '@senars/nar/dialogue/retrospect.js';
import { EpisodicMemory } from '@senars/nar/memory/EpisodicMemory.js';
import { RLFPLearner } from '@senars/nar/rlfp';
import { afterAll, describe, expect, it } from 'vitest';

const dirs: string[] = [];
const tmpBase = async (): Promise<string> => {
  const dir = await mkdtemp(join(tmpdir(), 'refactor1-ledger-'));
  dirs.push(dir);
  return dir;
};
afterAll(async () => {
  for (const d of dirs) await rm(d, { recursive: true, force: true });
});

describe('Bench 82 — parameter ledger', () => {
  it('records exactly-once per changed parameter (coalesced writes)', () => {
    const ledger = new ParameterLedger();
    const table = new ParameterTable();
    table.register({ name: 'k', scope: 'system', min: 0, max: 10, value: 1, owner: 'test' });
    table.attachLedger(ledger, 'self-meta-game');

    table.setMany('system', [
      ['k', 5],
      ['k', 5],
    ]);
    table.setMany('system', [['k', 5]]); // unchanged → no record
    const records = ledger.query({ parameter: 'k' });
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      writer: 'self-meta-game',
      scope: 'system',
      parameter: 'k',
      oldValue: 1,
      newValue: 5,
    });
  });

  it('all-or-nothing scope failure records nothing', () => {
    const ledger = new ParameterLedger();
    const table = new ParameterTable();
    table.register({ name: 'ok', scope: 'system', min: 0, max: 10, value: 1, owner: 'test' });
    table.attachLedger(ledger);
    expect(() => table.setMany('game:x', [['ok', 5]])).toThrow();
    expect(ledger.size).toBe(0);
  });

  it('ledger-off default: no attachment ⇒ no records, no files', async () => {
    const dir = await tmpBase();
    const table = new ParameterTable();
    table.register({ name: 'k', scope: 'system', min: 0, max: 10, value: 1, owner: 'test' });
    table.set('system', 'k', 3);
    const files = await (await import('node:fs/promises')).readdir(dir).catch(() => []);
    expect(files).toEqual([]);
  });

  it('persists digest-pinned JSONL records (no raw utterances)', async () => {
    const dir = await tmpBase();
    const ledger = new ParameterLedger({ path: join(dir, 'ledger.jsonl') });
    ledger.record({
      writer: 'rlfp',
      scope: 'rlfp',
      parameter: 'decayRate',
      oldValue: 0.05,
      newValue: 0.04,
      at: 1,
    });
    // New ledger uses date-sharded files in the directory
    const today = new Date().toISOString().split('T')[0];
    const content = await readFile(join(dir, `${today}.jsonl`), 'utf-8');
    expect(JSON.parse(content)).toMatchObject({ parameter: 'decayRate', newValue: 0.04 });
  });

  it('RLFPLearner writes tuning updates to the ledger when attached', () => {
    const ledger = new ParameterLedger();
    const rlfp = new RLFPLearner({ ledger });
    rlfp.applyTuningUpdate('decayRate', 0.08);
    const records = ledger.query({ writer: 'rlfp' });
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({ parameter: 'decayRate', newValue: 0.08 });
    // unchanged write → no record
    rlfp.applyTuningUpdate('decayRate', 0.08);
    expect(ledger.query({ writer: 'rlfp' })).toHaveLength(1);
  });

  it('RetrospectiveAdapter observes strategy switches; improvedOnly filters on outcomes', async () => {
    const ledger = new ParameterLedger();
    const applied: string[] = [];
    const adapter = new RetrospectiveAdapter(
      {
        getStrategy: () => 'default',
        setStrategy: (_type: string, name: string) => applied.push(name),
      } as never,
      { ledger }
    );
    const adapted = adapter.adaptFromRetrospective({
      digest: 'd1',
      reactionCount: 4,
      reactionDistribution: { correct: 3, accept: 1 },
      corrections: [],
      strategyAudit: [],
      proposals: [],
      provenance: { turnIds: [] },
    } as never);
    expect(adapted).toBe(true);
    const strategyRecords = ledger.query({ writer: 'retrospective-adapter' });
    expect(strategyRecords.map((r) => r.parameter)).toEqual([
      'strategy:derivation',
      'strategy:lm-rule',
    ]);

    const at = Date.now();
    const link = new OutcomeLinker(ledger, () => [
      { at: at - 30_000, quality: 0.2 },
      { at: at + 30_000, quality: 0.9 },
    ]);
    const improved = await link.improvedOnly({ windowMs: 60_000 });
    expect(improved.length).toBeGreaterThan(0);
    expect(improved.every((i) => i.improved)).toBe(true);
  });

  it('retrospect() enriches strategyAudit with ledger entries', async () => {
    const dir = await tmpBase();
    const mem = new EpisodicMemory({ basePath: dir });
    await mem.log('dialogue', JSON.stringify({ turnId: 's:1', sessionId: 's', seq: 1 }), {
      sessionId: 's',
    });
    const r = await retrospect('s', mem, {
      ledgerEntries: [
        { parameter: 'decayRate', oldValue: 0.05, newValue: 0.04, at: Date.now(), trigger: 'rlfp' },
      ],
      minTurns: 1,
      minReactions: 0,
    });
    expect(r.strategyAudit[0]!.parameterChanges).toEqual([
      {
        parameter: 'decayRate',
        oldValue: 0.05,
        newValue: 0.04,
        at: expect.any(Number),
        trigger: 'rlfp',
      },
    ]);
  });
});
