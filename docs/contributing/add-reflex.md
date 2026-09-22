# Adding a Reflex

A **reflex** is a fast, model-free action proposer/learner that negotiates
with NAL derivations inside a `GameFocus`. Implement the `Reflex` interface
(`nar/src/reflex/Reflex.ts`):

```ts
export interface ActionProposal {
  action: string;
  args?: Record<string, unknown>;
  value: number;          // estimated value of the action
  confidence: number;     // 0..1; ranking uses value * confidence
  source: string;         // your reflex id
}

export interface LearningEvent {
  perception: Perception;
  previousPerception: Perception | null;
  actionProposed: string;
  actionExecuted: string | null;   // null when vetoed/blocked
  reward: number;
  terminal: boolean;
  overriddenBy: string | null;    // veto reason (e.g. "nal-<source>")
}

export interface Reflex<S = unknown, A = unknown> {
  readonly id: string;
  propose(state: S, legalActions: A[]): ActionProposal[];
  learn(event: LearningEvent): void;
}
```

## Rules of the contract

- `propose` must be **synchronous and pure** (no I/O) — it runs every tick in
  `GameFocus.proposeStage` (see `nar/src/focus/GameFocus.ts`). Semantic
  prefetching is optional: implement a `prefetch(stateId, embedding,
  legalActions, manifold, budget, observation?)` method and wire
  `GameFocus.setReflexPrefetchContext(...)`; it is called at the attend stage.
- Return `[]` freely — an empty proposal list is normal (the tick yields).
- `learn` fires only on ticks where your reflex *proposed* the executed action
  (A2 fan-out in `GameFocus.learnStage`); treat `actionExecuted: null` +
  `overriddenBy` as an overridden/vetoed trial and discount accordingly.
- Existing implementations to mirror: `EpsilonGreedyReflex.ts`,
  `UCBReflex.ts`, `TabularQReflex.ts` in `nar/src/reflex/`.

## Example — a simple optimistic-init tabular reflex

```ts
// nar/src/reflex/CountReflex.ts
import type { ActionProposal, LearningEvent, Reflex } from './Reflex.js';

interface Entry { value: number; count: number }

export class CountReflex implements Reflex<string, string> {
  readonly id: string;
  private readonly table = new Map<string, Map<string, Entry>>();

  constructor(id: string) {
    this.id = id;
  }

  propose(state: string, legalActions: string[]): ActionProposal[] {
    const q = this.table.get(state) ?? new Map();
    return legalActions.map((action) => {
      const e = q.get(action) ?? { value: 0.5, count: 0 };
      return { action, value: e.value, confidence: Math.min(1, e.count / 10), source: this.id };
    });
  }

  learn(event: LearningEvent): void {
    if (!event.actionExecuted) return; // vetoed/blocked — no credit assignment
    const q = this.table.get(event.perception.stateId) ?? new Map();
    this.table.set(event.perception.stateId, q);
    const e = q.get(event.actionExecuted) ?? { value: 0.5, count: 0 };
    e.count++;
    e.value += (event.reward - e.value) / e.count; // incremental mean
  }
}
```

## Registration and negotiation

- **Per-focus:** `gameFocus.bindReflex(reflex)` — pushes onto
  `Focus.reflexes` (`nar/src/focus/Focus.ts`). Or pass them in
  `GameManager.attachGame(game, { reflexes: [...] })`
  (`nar/src/nar/games.ts`).
- **Disable at runtime:** `Focus.disableReflex(reflexId)` filters the reflex
  out; the meta-game reaches it across focuses via
  `SelfMetaGame.disableReflex(focusId, reflexId)` (`nar/src/game/SelfMetaGame.ts`).
- **Negotiation** (`nar/src/reflex/Negotiator.ts`): proposals compete by
  `value * confidence` against `reflexThreshold` (default `0.3`; `GameFocus`
  uses `-1` so any proposal is in-band). NAL derivations veto an action when
  `truth.f < 0.3 && truth.c >= nalVetoThreshold` (default `0.8`) — the veto
  blocks the trap and a clean fallback proposal acts instead. Rewards are
  only ever applied to policy weights (kernel reward firewall), never truth.

## Checklist

- [ ] `Reflex<S, A>` implemented with a unique `id`; `source` matches `id`
- [ ] `propose` synchronous, pure, handles unseen states
- [ ] `learn` handles `actionExecuted: null` (vetoed) without corrupting values
- [ ] Optional `onEpisodeEnd()` hook if you need per-episode decay
      (`GameFocus.markEpisodeEnd` calls it duck-typed)
- [ ] Bound via `bindReflex`; removable via `disableReflex`

## Tests to write

Follow `tests/nar/focus-game-reflex/` and `tests/nar/rl/` conventions
(vitest, direct construction, deterministic seeds):

- Convergence: reflex value converges to the true reward mean on a fixed game.
- Veto honoring: with a seeded NAL derivation (`f < 0.3, c >= 0.8`), the
  Negotiator vetoes the trapped action and picks the fallback.
- Learning event fan-out: only proposing reflexes receive `learn`
  (see `GameFocus.learnStage` A2 semantics).