import { afterEach, describe, expect, it } from 'vitest';
import { createGateRegistry, gateRegistry } from '../../nar/src/kernel/index.js';
import { NAR } from '../../nar/src/nar.js';
import { GameFocus } from '../../nar/src/focus/GameFocus.js';
import { createArcadeRegistry } from '../../nar/src/game/index.js';

/**
 * Bench 42 — Gate Isolation (TODO19 F2)
 * Two agents/registries in one process: autonomy/allowlist/veto changes in A
 * don't affect B. Reset helper retained only for suites that share the global.
 */

const gameRegistry = createArcadeRegistry();

afterEach(() => {
  gateRegistry.reset();
});

describe('Bench 42 — Gate Isolation', () => {
  it('F2 — per-instance registries: autonomy mode change in A leaves B untouched', () => {
    const a = createGateRegistry();
    const b = createGateRegistry();
    a.initialize({ initialAutonomyMode: 'sandbox-execute' });
    b.initialize({ initialAutonomyMode: 'observe-only' });

    a.getActionGate().setAutonomyMode('sandbox-execute');
    expect(b.getActionGate().getAutonomyMode()).toBe('observe-only');

    b.getActionGate().setAutonomyMode('sandbox-execute');
    b.getActionGate().setAutonomyMode('observe-only');
    expect(a.getActionGate().getAutonomyMode()).toBe('sandbox-execute');
  });

  it('F2 — scoped allowlists are registry-local (game scopes never collide)', () => {
    const a = createGateRegistry();
    const b = createGateRegistry();
    a.getActionGate().setScopeAutonomy('game-x', 'sandbox-execute');
    a.getActionGate().addScopedOperation('game-x', 'up');
    expect(a.getActionGate().getScopeAutonomy('game-x')).toBe('sandbox-execute');
    expect(b.getActionGate().getScopeAutonomy('game-x')).toBeUndefined();
  });

  it('F2 — NAR instances isolate their kernel gates (input to A gates only A)', () => {
    const narA = new NAR();
    const narB = new NAR();
    narA.gates.getActionGate().setAutonomyMode('sandbox-execute');
    expect(narA.gates.getActionGate().getAutonomyMode()).toBe('sandbox-execute');
    expect(narB.gates.getActionGate().getAutonomyMode()).toBe('observe-only');
  });

  it('F2 — two GameFocus agents on isolated registries keep separate scopes', () => {
    const gatesA = createGateRegistry();
    const gatesB = createGateRegistry();
    const fa = new GameFocus({
      focusId: 'iso-a',
      game: gameRegistry.create('rps', 1),
      gateRegistry: gatesA,
    });
    const fb = new GameFocus({
      focusId: 'iso-b',
      game: gameRegistry.create('rps', 2),
      gateRegistry: gatesB,
    });
    expect(gatesA.getActionGate().getScopeAutonomy('iso-a')).toBe('sandbox-execute');
    expect(gatesB.getActionGate().getScopeAutonomy('iso-b')).toBe('sandbox-execute');
    expect(gatesB.getActionGate().getScopeAutonomy('iso-a')).toBeUndefined();
    fa.releaseScope();
    fb.releaseScope();
    expect(gatesA.getActionGate().getScopeAutonomy('iso-a')).toBeUndefined();
  });
});
