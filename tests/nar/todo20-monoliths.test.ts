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

describe('Bench 62: monolith split — M3 providers', () => {
  const LM_DIR = join(import.meta.dirname, '../../nar/src/lm');
  const loc = (p: string) => readFileSync(p, 'utf-8').split('\n').length;

  it('providers facade + split modules are <400 LOC each', () => {
    for (const f of [
      'providers.ts',
      'providers/settings.ts',
      'providers/webllm.ts',
      'providers/capabilities.ts',
      'providers/chains.ts',
      'providers/routing.ts',
      'providers/health.ts',
      'providers/model-factory.ts',
    ]) {
      const n = loc(join(LM_DIR, f));
      expect(n, `${f} has ${n} LOC`).toBeLessThan(400);
    }
  });

  it('provider cycles stay deleted (facade and factory must not import lm-service)', () => {
    const barrel = readFileSync(join(LM_DIR, 'providers.ts'), 'utf-8');
    const factory = readFileSync(join(LM_DIR, 'providers/model-factory.ts'), 'utf-8');
    const chains = readFileSync(join(LM_DIR, 'providers/chains.ts'), 'utf-8');
    expect(barrel).not.toContain("from './lm-service");
    expect(factory).not.toContain("from '../lm-service");
    expect(chains).not.toContain("from '../lm-service");
    const embedded = readFileSync(join(LM_DIR, 'providers/embedded-llamacpp.ts'), 'utf-8');
    expect(embedded).not.toContain("from '../providers.js'");
  });
});

describe('Bench 62: monolith split — M4 lm-service', () => {
  const LM_DIR = join(import.meta.dirname, '../../nar/src/lm');
  const loc = (p: string) => readFileSync(p, 'utf-8').split('\n').length;

  it('service split modules are <400 LOC each (core LMService has an M2-style deviation, <520)', () => {
    for (const f of [
      'service/errors.ts',
      'service/cache.ts',
      'service/spend.ts',
      'service/mock.ts',
      'service/structured.ts',
    ]) {
      const n = loc(join(LM_DIR, f));
      expect(n, `${f} has ${n} LOC`).toBeLessThan(400);
    }
    const core = loc(join(LM_DIR, 'service/LMService.ts'));
    expect(core, `service/LMService.ts has ${core} LOC`).toBeLessThan(520);
  });

  it('lm-service.ts is a facade re-exporting the unchanged public surface', () => {
    const facade = readFileSync(join(LM_DIR, 'lm-service.ts'), 'utf-8');
    for (const symbol of [
      'LMService',
      'createLMService',
      'createMockLMService',
      'createMockLanguageModel',
      'LMUnavailableError',
      'ProviderSpend',
    ]) {
      expect(facade, `facade missing ${symbol}`).toContain(symbol);
    }
    expect(loc(join(LM_DIR, 'lm-service.ts'))).toBeLessThan(60);
  });

  it('prompt extraction is consolidated in @senars/util (no local copies)', () => {
    for (const f of [
      'lm-service.ts',
      'service/mock.ts',
      'providers/model-factory.ts',
      'providers/embedded-llamacpp.ts',
    ]) {
      const src = readFileSync(join(LM_DIR, f), 'utf-8');
      expect(src, `${f} defines a local extractor`).not.toMatch(
        /^function extract(LastUserMessage|TextFromPrompt)/m
      );
    }
  });

  it('X5: single generic breaker lives in utils/resilience', () => {
    const resilience = readFileSync(
      join(import.meta.dirname, '../../nar/src/utils/resilience.ts'),
      'utf-8'
    );
    expect(resilience).toContain('CircuitBreaker');
    expect(loc(join(import.meta.dirname, '../../nar/src/utils/circuit-breaker.ts'))).toBeGreaterThan(0);
  });
});

describe('Bench 62: monolith split — M5 tool-registry (+X4 typed bus)', () => {
  const TOOLS_DIR = join(import.meta.dirname, '../../nar/src/tools');
  const loc = (p: string) => readFileSync(p, 'utf-8').split('\n').length;

  it('split modules are <400 LOC each and the facade is a barrel', () => {
    for (const f of ['registry.ts', 'manager.ts', 'goal.ts', 'core-adapter.ts']) {
      expect(loc(join(TOOLS_DIR, f)), `${f} over 400 LOC`).toBeLessThan(400);
    }
    const facade = readFileSync(join(TOOLS_DIR, 'tool-registry.ts'), 'utf-8');
    expect(facade).toContain('export {');
    expect(facade).not.toContain('class ToolManager');
  });

  it('X4: ToolManager bus is typed on NAREventMap — no as never bus casts remain', () => {
    for (const f of ['tool-registry.ts', 'manager.ts', 'goal.ts', 'core-adapter.ts']) {
      const src = readFileSync(join(TOOLS_DIR, f), 'utf-8');
      expect(src, `${f} still casts as never`).not.toContain('as never');
    }
    const manager = readFileSync(join(TOOLS_DIR, 'manager.ts'), 'utf-8');
    expect(manager).toContain('EventBus<NAREventMap>');
    // Remaining `as never` casts in nar/src are branded-type/FFI workarounds, not event-bus
    // defeats — none may sit adjacent to bus calls (emit/on).
    const offenders = listFiles(join(import.meta.dirname, '../../nar/src')).filter((f) =>
      /as never[^\n]*(\bon\b|\bemit\b)|(\bon\b|\bemit\b)[^\n]*as never/.test(
        readFileSync(f, 'utf-8')
      )
    );
    expect(offenders, `bus casts remain in: ${offenders.join(', ')}`).toEqual([]);
  });
});

describe('Bench 62: monolith split — M6 perception-action adapters', () => {
  const RL_DIR = join(import.meta.dirname, '../../nar/src/rl');
  const loc = (p: string) => readFileSync(p, 'utf-8').split('\n').length;

  it('adapters split modules are <400 LOC each', () => {
    for (const f of ['adapters/perception.ts', 'adapters/action.ts', 'adapters/agent.ts']) {
      expect(loc(join(RL_DIR, f)), `${f} over 400 LOC`).toBeLessThan(400);
    }
  });

  it('monolith is gone; facade routes through the adapters barrel', () => {
    expect(readdirSync(RL_DIR).includes('perception-action-adapters.ts')).toBe(false);
    const facade = readFileSync(join(RL_DIR, 'adapters.ts'), 'utf-8');
    expect(facade).toContain("from './adapters/index.js'");
  });

  it('T1 sweep: selectors and q-store take RandomSource; no bare Math.random outside defaults', () => {
    const action = readFileSync(join(RL_DIR, 'adapters/action.ts'), 'utf-8');
    expect(action).toContain('rng: RandomSource');
    const qStore = readFileSync(join(RL_DIR, 'q-belief-store.ts'), 'utf-8');
    expect(qStore).toContain('rng: RandomSource');
    for (const f of ['adapters/action.ts', 'adapters/perception.ts', 'adapters/agent.ts', 'q-belief-store.ts']) {
      const src = readFileSync(join(RL_DIR, f), 'utf-8');
      const bare = src.split('\n').filter(
        (l) => l.includes('Math.random') && !l.includes('rng: RandomSource = Math.random')
      );
      expect(bare, `${f} has bare Math.random: ${bare.join('; ')}`).toEqual([]);
    }
  });
});
