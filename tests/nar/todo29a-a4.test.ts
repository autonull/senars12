/**
 * A4 — state ownership, and observational reads (TODO29.a §5.4).
 *
 * Every gate rule's failure case first, per §10.1: the surface rules are pure
 * functions over source text, so a rule nobody has seen fail is a rule nobody
 * knows is a rule. The behavioural half — a read that does not write, a goal
 * whose identity survives two reads, a store whose sampling is the clock-free
 * ranking — is asserted on real objects.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Memory } from '@senars/nar/memory';
import { describe, expect, it } from 'vitest';
import { Concept } from '../../nar/src/memory/concept.js';
import { NullAttentionModel } from '../../nar/src/strategies/attention/NullAttentionModel.js';
import { SimpleAttention } from '../../nar/src/strategies/attention/SimpleAttention.js';
import { TermBuilder } from '../../nar/src/terms/impls/factory.js';
import {
  ATTENTION_OWNER,
  ATTENTION_REASONS,
  methodBody,
  type SurfaceSubject,
  scanSubject,
  surfaceViolations,
  writeSites,
} from '../../scripts/lib/attention-surface.js';

const term = (name: string) => TermBuilder.atom(name);
const rulesOf = (violations: ReturnType<typeof surfaceViolations>) =>
  violations.map((violation) => violation.rule);
/** Every reason written once, so a fixture's other rules stay quiet. */
const allReasons = () =>
  ATTENTION_REASONS.map(
    (reason) => `c.writeAttention({ reason: '${reason}', amount: 1, value: 1 });`
  ).join('\n');

const owner = (source: string): SurfaceSubject => ({ files: [{ path: ATTENTION_OWNER, source }] });

describe('A4 — attention has one write surface', () => {
  it('the shipped owner has a reader and no setter', () => {
    const source = readFileSync(join(process.cwd(), ATTENTION_OWNER), 'utf8');
    expect(source).toContain('get priority');
    expect(source).not.toContain('set priority');
  });

  it('a setter in the owner fails, because nothing else can see it coming back', () => {
    const source = readFileSync(join(process.cwd(), ATTENTION_OWNER), 'utf8');
    expect(
      rulesOf(surfaceViolations(owner(`${source}\n  set priority(v: number) {}\n`)))
    ).toContain('priority-setter-present');
  });

  it('a reason nothing writes fails', () => {
    const used = ATTENTION_REASONS.filter((reason) => reason !== 'self-tune')
      .map((reason) => `c.writeAttention({ reason: '${reason}', amount: 1, value: 1 });`)
      .join('\n');
    expect(rulesOf(surfaceViolations(owner(`get priority() { return 0; }\n${used}\n`)))).toContain(
      'dead-reason'
    );
  });

  it('a reason the union does not have fails', () => {
    expect(
      rulesOf(
        surfaceViolations(
          owner(
            `get priority() { return 0; }\n${allReasons()}\nc.writeAttention({ reason: 'nudge', amount: 1 });\n`
          )
        )
      )
    ).toContain('unknown-reason');
  });

  it('every declared reason is written with somewhere in the tree', () => {
    const sites = writeSites(scanSubject());
    expect([...new Set(sites.map((site) => site.reason))].sort()).toEqual(
      [...ATTENTION_REASONS].sort()
    );
  });
});

describe('A4 — reads are observational', () => {
  const memorySource = (reads: string) =>
    `  ${reads}\n  consolidate() { this.decayAll(1); }\n  private decayAll(n: number) {}\n`;

  it('a read that decays fails', () => {
    const violations = surfaceViolations({
      files: [
        {
          path: 'nar/src/memory/memory.ts',
          source: memorySource('sample(limit: number) { this.decayAll(); return []; }'),
        },
      ],
    });
    expect(rulesOf(violations)).toContain('read-writes');
  });

  it('a clean pair of reads passes', () => {
    expect(
      surfaceViolations({
        files: [
          {
            path: 'nar/src/memory/memory.ts',
            source: memorySource(
              `sample(limit: number) { return this.topConcepts(limit); } sampleWindow(size: number) { return []; }`
            ),
          },
          {
            path: ATTENTION_OWNER,
            source: `get priority() { return 0; }\n${allReasons()}`,
          },
        ],
      })
    ).toEqual([]);
  });

  it('a second decay call site fails, and a missing sweep fails', () => {
    const withTwo = `${memorySource('sample(limit: number) { return []; }')}  tick() { this.decayAll(1); }\n`;
    expect(
      rulesOf(surfaceViolations({ files: [{ path: 'nar/src/memory/memory.ts', source: withTwo }] }))
    ).toContain('decay-call-site-count');
    expect(
      rulesOf(
        surfaceViolations({
          files: [
            { path: 'nar/src/memory/memory.ts', source: '  sample(limit: number) { return []; }' },
          ],
        })
      )
    ).toContain('no-decay-sweep');
  });

  it('the brace-matched body is the method, not the file', () => {
    const source = 'class A { sample() { return 1; } sampleWindow() { return 2; } }';
    expect(methodBody(source, 'sample')).toContain('return 1');
    expect(methodBody(source, 'sampleWindow')).not.toContain('return 1');
    expect(methodBody(source, 'absent')).toBe('');
  });

  it('sampling a store twice does not change what it holds', () => {
    const memory = new Memory();
    const concept = memory.addConcept(term('a'));
    concept.writeAttention({ reason: 'assign', value: 0.42 });
    const other = memory.addConcept(term('b'));
    other.writeAttention({ reason: 'assign', value: 0.1 });

    expect(memory.sample(2)).toEqual([concept, other]);
    expect(memory.sample(2)).toEqual([concept, other]);
    expect(concept.priority).toBe(0.42);
    expect(other.priority).toBe(0.1);
  });

  it('two stores built in the same instant rank identically', () => {
    const build = () => {
      const memory = new Memory();
      for (const [name, priority] of [
        ['a', 0.1],
        ['b', 0.9],
        ['c', 0.5],
      ] as const) {
        memory.addConcept(term(name)).writeAttention({ reason: 'assign', value: priority });
      }
      return memory.sample(3).map((c) => c.term.toString());
    };
    expect(build()).toEqual(build());
  });
});

describe('A4 — the decay clock is consolidation and it says how much elapsed', () => {
  it('decay is the clock tick, so only consolidation moves it', () => {
    const memory = new Memory(
      { activationDecayRate: 0.5 },
      { attentionModel: new SimpleAttention() }
    );
    const concept = memory.addConcept(term('a'));
    concept.writeAttention({ reason: 'assign', value: 1 });

    memory.sample(5);
    expect(concept.priority).toBe(1);

    for (let i = 0; i < 10; i++) memory.consolidate();
    expect(concept.priority).toBeLessThan(1);
  });

  it('the substrate default decays nothing, and says so', () => {
    const memory = new Memory(
      { activationDecayRate: 0.5 },
      { attentionModel: new NullAttentionModel() }
    );
    const concept = memory.addConcept(term('a'));
    concept.writeAttention({ reason: 'assign', value: 1 });

    for (let i = 0; i < 40; i++) memory.consolidate();
    expect(concept.priority).toBe(1);
  });

  it('consolidation reports the cycles it elapsed, not a literal one', () => {
    const memory = new Memory(
      { activationDecayRate: 0.5 },
      { attentionModel: new SimpleAttention() }
    );
    const concept = memory.addConcept(term('a'));
    concept.writeAttention({ reason: 'assign', value: 1 });

    // Ten consolidations on an interval of ten = one interval = one cycle.
    for (let i = 0; i < 10; i++) memory.consolidate();
    const afterOneInterval = concept.priority;
    for (let i = 0; i < 20; i++) memory.consolidate();
    expect(concept.priority).toBeLessThan(afterOneInterval);
  });
});

describe('A4 — a goal keeps its identity across reads', () => {
  it('two reads of one goal return the same stamp', () => {
    const memory = new Memory();
    memory.addTask(term('g'), 'goal');

    const [first] = memory.getGoals();
    const [second] = memory.getGoals();
    expect(first?.stamp).toBeDefined();
    expect(second?.stamp).toBe(first?.stamp);
  });

  it('a stamp minted at admission is the one a read returns', () => {
    const concept = new Concept(term('c'));
    concept.addTask('goal', {
      term: term('c'),
      budget: { priority: 0.5, durability: 1, quality: 1, cycles: 0, depth: 0 },
    });
    expect(concept.getGoals()[0]?.stamp).toBeDefined();
    expect(concept.getGoals()[0]?.stamp).toBe(concept.getGoals()[0]?.stamp);
  });
});
