import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ADAPTERS_DIR = join(import.meta.dirname, '../../nar/src/tools/adapters');

const listFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((entry) => {
    const p = join(dir, entry);
    return statSync(p).isDirectory() ? listFiles(p) : [p];
  });

describe('Bench 62: monolith split — M1 external-tools', () => {
  it('every split adapter file is <400 LOC', () => {
    const files = listFiles(ADAPTERS_DIR).filter((f) => f.endsWith('.ts'));
    expect(files.length).toBeGreaterThan(10);
    for (const f of files) {
      const loc = readFileSync(f, 'utf-8').split('\n').length;
      expect(loc, `${f} has ${loc} LOC`).toBeLessThan(400);
    }
  });

  it('external-tools.ts is fully decomposed (no dangling references)', () => {
    expect(listFiles(ADAPTERS_DIR).some((f) => f.includes('external-tools'))).toBe(false);
    const barrel = readFileSync(join(ADAPTERS_DIR, 'index.ts'), 'utf-8');
    expect(barrel).not.toContain('external-tools');
  });

  it('barrel re-exports the full public adapter API', () => {
    const barrel = readFileSync(join(ADAPTERS_DIR, 'index.ts'), 'utf-8');
    for (const symbol of [
      'createWebSearchTools',
      'createCodeExecTools',
      'createFileSystemTools',
      'createRagQueryTools',
      'createCoverageConceptTools',
      'createHumanApprovalTool',
      'createTestGenTools',
      'createTestRunnerTools',
      'createScenarioGenTools',
      'createCodemodTools',
      'createSelfTools',
      'ApprovalManager',
    ]) {
      expect(barrel, `barrel missing ${symbol}`).toContain(symbol);
    }
  });
});

describe('Bench 62: monolith split — M2 nar.ts', () => {
  const NAR_DIR = join(import.meta.dirname, '../../nar/src');
  const loc = (p: string) => readFileSync(p, 'utf-8').split('\n').length;

  it('extracted subsystem modules are <400 LOC each', () => {
    for (const f of ['nar/config.ts', 'nar/games.ts', 'nar/persistence.ts', 'nar/system-one.ts']) {
      const n = loc(join(NAR_DIR, f));
      expect(n, `${f} has ${n} LOC`).toBeLessThan(400);
    }
  });

  it('NAR facade stays under the M2 budget (public aggregate API)', () => {
    expect(loc(join(NAR_DIR, 'nar.ts'))).toBeLessThan(900);
  });

  it('NARExecution takes an options object — no positional undefined slots', () => {
    const src = readFileSync(join(NAR_DIR, 'nar.ts'), 'utf-8');
    expect(src).toContain('new NARExecution({');
    expect(src).not.toMatch(/new NARExecution\(\s*[^)]*undefined/);
  });
});
