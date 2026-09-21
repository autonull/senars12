import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { runNalAB } from '../../nar/src/focus/nal-ab.js';
import { createArcadeRegistry, registerReasoningGames } from '../../nar/src/game/registry.js';
import { NARBuilder, resolveProfile } from '../../nar/src/agent/builder.js';
import { createParameterTable, ParameterScopeError } from '../../nar/src/config/parameter-table.js';
import type { Game } from '../../nar/src/game/Game.js';
import type { Reflex, ActionProposal, LearningEvent } from '../../nar/src/reflex/Reflex.js';
import { createGridWorldGame } from '../../nar/src/game/GridWorldGame.js';

/**
 * Bench 46 — Domain Deployment (TODO19 Phase D)
 * device profile skips LM at runtime; two-domain one-process smoke;
 * profile-driven arcade arm; ParameterTable/config roundtrip; P1 NAL A/B.
 */

const scriptedReflex = (action: string): Reflex => ({
  id: 'scripted',
  propose: (): ActionProposal[] => [{ action, value: 0.9, confidence: 0.9, source: 'scripted' }],
  learn: (_e: LearningEvent) => {},
});

describe('Bench 46 — Domain Deployment', () => {
  it('device profile: no LM subsystem, NAR builds without importing LM heads', async () => {
    expect(resolveProfile('device').tier).toBe(0);
    const wired = await NARBuilder.fromProfile('device').build();
    expect(wired.describe().subsystems).not.toContain('lm');
    expect(wired.describe().subsystems).not.toContain('systemOne');
    await wired.agent.stop();
  });

  it('two-domain one-process smoke: two profile-driven agents with isolated gates', async () => {
    const a = await NARBuilder.fromProfile('device').build();
    const b = await NARBuilder.fromProfile('device').build();
    expect(a.gates).not.toBe(b.gates);
    a.gates.getActionGate().setAutonomyMode('sandbox-execute');
    expect(b.gates.getActionGate().getAutonomyMode()).toBe('observe-only');
    await Promise.all([a.agent.stop(), b.agent.stop()]);
  });

  it('ParameterTable/config roundtrip: register → set → clamp → persisted values', () => {
    const table = createParameterTable();
    table.register({ name: 'focusWeight', scope: 'game:rps', min: 0, max: 1, value: 0.5, owner: 'meta:rps' });
    expect(table.set('game:rps', 'focusWeight', 2.5)).toBe(1);
    expect(table.get('game:rps', 'focusWeight')).toBe(1);
    expect(() => table.set('system', 'focusWeight', 0.2)).toThrow(ParameterScopeError);
  });

  it('P1 — same-run NAL A/B: paired rule/no-rule episodes, same seed, veto effect reported', async () => {
    const result = await runNalAB(
      () => createGridWorldGame({ id: 'nal-ab-grid', grid: ['S..', '..G'], seed: 5 }) as unknown as Game,
      () => scriptedReflex('0'),
      20
    );
    expect(result.vetoesWithoutRules).toBe(0);
    expect(result.vetoesWithRules).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(result.delta)).toBe(true);
  });

  it('profile-driven arcade arm: reasoning:* playable through the arcade registry', () => {
    const registry = registerReasoningGames(createArcadeRegistry());
    const game = registry.create('reasoning:tool-use', 3);
    expect(game.legalActions((game as unknown as { state: () => unknown }).state()).length).toBeGreaterThan(0);
  });

  it('grep-guard — fast lane excludes load-sensitive suites; slow lane collects them', () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as {
      scripts: Record<string, string>;
    };
    const unit = pkg.scripts['test:unit'];
    const slow = pkg.scripts['test:load-sensitive'];
    for (const suite of ['todo16-slo', 'parity-restoration', 'bandit-epsilon-greedy', 'todo17b-failclosed', 'budgetgate-verification']) {
      expect(unit).toContain(suite);
      expect(slow).toContain(suite);
    }
  });
});
