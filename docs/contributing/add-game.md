# Adding a Game

A **game** is any `Game<S, A>` environment: it exposes observations, legal
actions, and a reward-bearing outcome per step. The NAR plays it through a
`GameFocus` (reflex proposals vs NAL vetoes) attached via `GameManager`.

## Core contract — `nar/src/game/Game.ts`

```ts
export interface Game<S = unknown, A = unknown> {
  readonly id: string;
  observe(): Perception;                    // { stateId, features?, confidence?, terminal? }
  state(): S;
  legalActions(state: S): A[];
  step(action: A): GameOutcome;             // { reward, terminal, info? }
}
```

Rules of the contract (see `CatchGame.ts`, `BanditGame.ts` for reference):

- `observe()` must be side-effect free and callable many times per tick.
- `stateId` should be a compact, discretized identity — reflexes key their
  Q-tables on it (`EpsilonGreedyReflex`).
- Rewards are clamped to `[-1, 1]` by the reward firewall in `GameFocus.actStage`;
  emit them in that range.
- Use `SeededRNG` (`nar/src/game/SeededRNG.ts`) for reproducibility; take a
  `seed` in a `*GameConfig` interface, plus optional `id`.

## Example — a minimal two-arm game

```ts
// nar/src/game/FlipGame.ts
import type { Game, GameOutcome, Perception } from './Game.js';
import { SeededRNG } from './SeededRNG.js';

export interface FlipGameConfig {
  seed: number;
  maxSteps?: number;
  id?: string;
}

export class FlipGame implements Game<number, 0 | 1> {
  readonly id: string;
  private readonly rng: SeededRNG;
  private readonly maxSteps: number;
  private target = 0;
  private steps = 0;
  private terminal_ = false;

  constructor(config: FlipGameConfig) {
    this.id = config.id ?? 'flip';
    this.rng = new SeededRNG(config.seed);
    this.maxSteps = config.maxSteps ?? 20;
  }

  observe(): Perception {
    return {
      stateId: `t${this.target}`,
      features: { target: this.target, steps: this.steps },
      confidence: 1.0,
      terminal: this.terminal_,
    };
  }

  state(): number {
    return this.target;
  }

  legalActions(): (0 | 1)[] {
    return [0, 1];
  }

  step(action: 0 | 1): GameOutcome {
    if (this.terminal_) return { reward: 0, terminal: true };
    const reward = action === this.target ? 1 : -1;
    this.target = this.rng.int(2) as 0 | 1; // SeededRNG API — see SeededRNG.ts
    this.steps++;
    this.terminal_ = this.steps >= this.maxSteps;
    return { reward, terminal: this.terminal_ };
  }
}
```

## Attaching — `nar/src/nar/games.ts`

`GameManager.attachGame(game, options)` creates a scoped-gate `GameFocus`
(`nar/src/focus/GameFocus.ts`), binds your reflexes, auto-binds a
`ManifoldReflex` when System One is enabled, and inserts the focus into a
`FocusBag`. Perceptions/rewards flow automatically: `GameFocus.step(budget)`
runs perceive → propose → negotiate → act → learn each tick; the game's
`observe()` becomes tasks and its `step()` reward becomes beliefs via
`getRewardGate().toBeliefs(outcome)`.

```ts
import { FlipGame } from '../game/FlipGame.js';
import { EpsilonGreedyReflex } from '../reflex/EpsilonGreedyReflex.js';
// on a NAR instance:
const focus = nar.games.attachGame(new FlipGame({ seed: 42 }), {
  id: 'flip-1',
  reflexes: [new EpsilonGreedyReflex('flip-eg', { numArms: 2 })],
  weight: 1.0,
});
```

Action strings: `GameFocus` stringifies legal actions before reflexes see them
and parses numeric ones back in `parseAction` — so numeric action types work.

## Meta-game knobs — `nar/src/config/parameter-table.ts`

Game-local tunables are `ParameterTable` scopes (`game:<id>`); system knobs
live under `system` and are owned by `SelfMetaGameImpl`
(`nar/src/game/SelfMetaGame.ts`). Each parameter is
`{ name, scope, min, max, value, owner, actuate? }`; `actuate` runs on every
accepted `set`. `SelfMetaGame.setKnob/setKnobs` route through
`parameterTable.set/setMany` with scope enforcement (`ParameterScopeError`).

To expose a custom knob, pass `knobs: KnobConfig[]` when constructing the
meta-game (`SelfMetaGameConfig.knobs`) and read it via `getKnobValue(knob)` —
note the actuator switch in `SelfMetaGameImpl` is the place where knob writes
reach real subsystems; a knob without an actuator is tuning-surface-only.

## Checklist

- [ ] `Game<S, A>` implemented; `id` unique; rewards in `[-1, 1]`
- [ ] `SeededRNG` used; config interface exported with `seed` + optional `id`
- [ ] Exported from `nar/src/game/index.ts`
- [ ] Attached via `GameManager.attachGame`, not by hand-rolling `GameFocus`
- [ ] No truth mutation from rewards (epistemic firewall — policy only)
- [ ] `detachGame(id)` called on teardown (releases scoped gates)

## Tests to write

Follow `tests/nar/game-registry.test.ts` and `tests/nar/focus-game-reflex/`
conventions (vitest, direct object construction, no mocks):

- Deterministic episode: fixed seed → fixed reward sequence.
- Reflex learning on your game (`EpsilonGreedyReflex` improves over random).
- Attach/detach leaves no gate residue (`releaseScope`).

See `tests/nar/todo17-games.test.ts` for end-to-end attach wiring examples.