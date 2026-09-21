# SeNARS Arcade (TODO17)

The arcade puts System One in public: many games on one attention economy, a
real language model deciding in real time, the community's open one-pass
decision models on the same harness, and every decision Brier-scored against
what actually happened.

## Run

```bash
pnpm arcade -- --games snake,tetris,2048,tictactoe,gridworld,bandit --arms heuristic,random --episodes 5 --seed 7
pnpm arcade -- --arms manifold                      # local Judgment Manifold heads
OPEN_REPLICA_ENDPOINT=http://127.0.0.1:8421 pnpm arcade -- --arms replica
pnpm open-replica-fixture                           # CI fixture replica (offline)
pnpm arcade -- --arms lm                            # real LM decisions (LM_LLAMACPP_MODEL)
```

Arms are **fail-closed per arm**: an arm whose subsystem is missing (no LM
model, no replica endpoint) is skipped with an explicit report note — never
silently substituted.

## Arms

| arm | subsystem | availability |
|---|---|---|
| `heuristic` | per-game baselines (flood-fill snake, lines+holes tetris, corner-greedy 2048, minimax ttt) | always |
| `random` | seeded random policy (the control the community taught us to never demo without) | always |
| `manifold` | local Judgment Manifold heads via `ManifoldReflex` | always (deterministic heads) |
| `lm` | `LMReflex` — GBNF-constrained LM proposals judged by the manifold | `LM_LLAMACPP_MODEL` set |
| `replica` | `createOpenSystemOneManifold` — community `{state, questions}` wire | `OPEN_REPLICA_ENDPOINT` set |

## Harness

`nar/src/eval/brier-harness.ts` records per-tick `(arm, game, state, action,
predicted, observed, reward, latency, handover?)` and emits per-arm Brier,
isotonic-calibrated ECE (reusing the TODO16c calibration metrics), return
curves, and handover counts into `.reports/arcade.{json,md}`.

Controls (Bench 34): a shuffled-probability arm must degrade ECE vs the honest
arm; the random arm's advantage signal must stay ≈ 0 — the harness measures
real signal, not vibes.

## Parity table (Bench 35, §0.4 targets)

| claim | target | reference |
|---|---|---|
| calibration | held-out ECE ≤ 0.07 (stretch ≤ 0.03) | kev / minojev |
| latency | local manifold decision P50 ≤ 15 ms | von |
| performance | every arm ≥ random on every game | PlayJev |
| structure | exactly one batched judgment call per decision | one-prefill parity |

Parity is asserted on *our* harness over *our* seeds; published numbers are
thresholds only (apples-to-oranges caveat lives in the report).

## Handover (E2)

Review-band decisions escalate to the game's heuristic baseline (minimax for
TicTacToe) instead of acting; the block band yields the tick (AIKR). Counted
per game and surfaced in the report.

## Cognitive mode (E7)

```bash
pnpm arcade -- --games gridworld --arms manifold --mode cognitive
```

Opt-in mode where SeNARS reasoning is visible in gameplay: the game's domain
rules are seeded as Narsese beliefs (`(<action> ==> <consequence>)`) so the
Negotiator's NAL veto has domain content (e.g. gridworld `(0 ==> wall_bump)` —
the start cell's top row), each tick prints a `[panel]` thought-stream line
(proposals → decision, veto/handover markers, NAL derivation count, focus
weight), and every veto carries a recorder-verifiable justification record
(`GameFocus.getVetoJustifications()` — passes the standalone derivation
verifier). Non-cognitive runs are unchanged.

## Tests

`tests/nar/todo17-{scheduler,arbitration,games,lm-reflex,open-replica,arcade,parity}.test.ts`
— Benches 29–35. Model/endpoint-gated legs skip when their env is unset.
