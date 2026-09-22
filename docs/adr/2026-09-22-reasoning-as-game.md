# ADR: Reasoning as Game — Scoped Environments for Self-Play and Reflex Training

## Status

Accepted

## Date

2026-09-22

## Context

Evaluating and improving an agent's decisions requires interactive
environments with well-defined perception, action, and outcome — the same
shape as reasoning itself. Without a shared game abstraction, each evaluation
target (TicTacToe, Snake, RL parity, self-tuning) invents its own loop, and
scoped actions can leak into global authority.

## Decision

The `Game` interface (`nar/src/game/Game.ts`) defines the universal
environment contract: `Perception`, `GameOutcome`, step/reset. The hierarchy
extends to `MetaGame` (game about choosing games) and `SelfMetaGame`
(`SelfMetaGameImpl`) — a meta-game whose knobs are the agent's own cognitive
parameters, enabling self-play over self-configuration.

Concrete games (`TicTacToe`, `Snake`, `GridWorldGame`, `BanditGame`,
`ArithmeticGame`, `Game2048`, `TetrisGame`, `RPSGame`, `SeededRNG`) are
registered in `game/registry.ts`. `GameFocus` (`focus/GameFocus.ts`) runs a
game inside a focus slot, including `ReflexPrefetchContext` and tick panel
accounting.

Veto semantics: `reflex/Negotiator.ts` vets proposed actions
(`vetoedBy`, trap detection — e.g. a high-frequency losing move), memoizes
veto decisions with a capped `vetoMemo`, and selects the best remaining
legal action on veto. Scoped game actions authorize against their own scope
via `KernelActionGate.authorizeScoped`, never the global tier ladder.

RL parity: `rl/parity-harness.ts` (`RLParityHarness`) compares reflex-driven
and RL-driven play over the same games to enforce behavioral parity.

## Consequences

- One environment contract serves evaluation, self-play, RL training, and
  interactive demos.
- Meta-cognition is testable: `SelfMetaGame` turns tuning into episodes.
- Vetoes are local and memoized; a veto blocks the trap action, not the
  episode.
- Game action scope isolation must be preserved by the action gate.

## References

- `nar/src/game/Game.ts`
- `nar/src/game/SelfMetaGame.ts`
- `nar/src/game/registry.ts`
- `nar/src/focus/GameFocus.ts`
- `nar/src/reflex/Negotiator.ts`
- `nar/src/rl/parity-harness.ts`
- `nar/src/kernel/KernelActionGate.ts`
