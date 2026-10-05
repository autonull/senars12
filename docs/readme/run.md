## Run

```bash
pnpm install       # Install dependencies
pnpm run dev       # Development mode (watch)
pnpm run start     # Run once
pnpm bot              # Unified CLI-first bot (REPL + all diagnostics; see §Bot)
pnpm status        # Live System One manifold health, head calibration, LM spend
pnpm doctor        # Onboarding: credentials, lm api probe, effective LM/routing matrix
pnpm bench:system-one            # System One on/off latency + token benchmark
pnpm arcade -- --games snake,bandit --arms nal,manifold   # Multi-game System One demo (see §Arcade)
pnpm run demo:arcade -- --distill  # Arcade tournament + teacher→student distillation flywheel
pnpm exec tsx scripts/rl-manifold.ts          # Pure-RL demo on the Judgment Manifold (no NAL)
pnpm exec tsx scripts/system-one-train.ts     # Train a head from the distillation dataset
pnpm run test      # Test everything
pnpm run typecheck # Type check
pnpm run lint      # Lint
```

### Bot

`pnpm bot` starts the unified CLI-first agent: an interactive `senars> ` prompt with the full
command set (NAR/memory/LM/System One/diagnostics) and **no network connections by default**.

```bash
cp .env.example .env  # Fill in your LM provider credentials
pnpm bot              # CLI only — type .help for commands, or just chat
```

Attach transports at runtime from inside the CLI, or auto-connect at startup via env:

```bash
senars> .connect irc irc.libera.chat 6697 senars-bot #senars
senars> .connect ws 8765
senars> .connections   # list all with status
senars> .disconnect ws # by id or by type (irc|ws|http|mcp)

ENABLE_IRC=true pnpm bot   # or: pnpm bot:irc | bot:ws | bot:http | bot:mcp
```

`pnpm status`, `pnpm doctor`, `pnpm tune`, and `pnpm arcade` are aliases for
`pnpm bot -- --status|--doctor|--tune|--arcade`. See `docs/bot-api.md` for the bot-to-bot API
and `docs/manual-test-irc.md` for a 9-step manual test protocol.

### Self-Improvement Demo

```bash
# Autonomous self-improvement loop (10 cycles)
pnpm exec tsx scripts/self-improve-demo.ts

# Cognitive state report
pnpm exec tsx src/bin/self-report.ts

# RL Parity experiments (Focus-Game-Reflex kernel)
pnpm exec tsx scripts/rl-parity.ts --env bandit --mode native --seeds 5
pnpm exec tsx scripts/rl-parity.ts --env gridworld --mode native --seeds 5
pnpm exec tsx scripts/rl-parity.ts --env nonstationary --mode native --seeds 5
```
