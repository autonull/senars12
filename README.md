# 🧠 SeNARS12

> **Semantic Non-Axiomatic Reasoning System** — Next-generation cognitive architecture fusing fluid LLM creativity with
> rigorous symbolic logic 🚀

---

## 🌟 Vision

**SeNARS12** is more than a reasoning engine—it's a **cognitive kernel** for the AI-native future. We're building a
system that thinks like humans do: fluidly, adaptively, and resourcefully, while maintaining mathematical rigor.

---

## ✨ What Makes SeNARS12 Special

### 🔮 Parser-less Symbolic Foundation

### 🧩 Principles

- **Anytime** ⏱️ — Interruptible execution at any point
- **Interruptible** ⏸️ — Cooperative yielding to event loop
- **AIKR** 📚 — Assumption of Insufficient Knowledge Resources: Memory/attention/bag capacity, derivation depth enforced
  by types, CPU throttling, backpressure

### 🎨 Zero-Cost Abstractions

TypeScript metaprogramming shifts correctness checks from runtime to compile-time:

- Phantom types track derivation depth
- Discriminated unions ensure exhaustive pattern matching
- Structural sharing via memoization factory
- Canonical normalization with stable hashes

### 🎯 Design Philosophy

> **TypeScript is not just a safety net—it's a reasoning layer.** 🎓

By encoding NAL semantics at the type level:

- Derivation depth tracked via phantom types
- Rule patterns enforced at compile-time
- Term structure guaranteed by discriminated unions
- Resource bounds baked into types

This eliminates entire classes of bugs, enables IDE-native development with full IntelliSense, and guarantees AIKR
compliance **by construction** rather than runtime monitoring.

---

## 🚀 Quick Start

```bash
# Install dependencies
pnpm install

# Development mode (watch)
pnpm run dev

# Run once
pnpm run start

# Test everything
pnpm run test

# Type check
pnpm run typecheck

# Lint
pnpm run lint
```

## 🤖 Run the bot on IRC

The `pnpm bot` command starts a multi-transport agent that drives a single SeNARS agent through IRC, CLI, and WebSocket.
Three commands:

```bash
cp .env.example .env       # fill in your LM provider credentials
pnpm bot                    # IRC + WS by default
```

Default behavior: connects to `irc.libera.chat#senars` as `senars-bot`
and starts a WebSocket server on `ws://localhost:8765`. Friends can join the IRC channel and chat, or connect their bots
to the WebSocket.

To enable HTTP (REST) too: set `ENABLE_HTTP=true` in `.env`. See
`docs/bot-api.md` for the bot-to-bot API and `docs/manual-test-irc.md`
for a 9-step manual test protocol.

---

## 🧪 Testing

```bash
# Run all tests
pnpm run test

# Unit tests only
pnpm run test:unit

# With coverage
pnpm run test --coverage
```

### End-to-end smoke scripts

End-to-end smokes are spawned as child processes from Jest (the VM breaks ONNX's cross-realm Float32Array checks). They
can also be run directly once the model weights are cached locally.

```bash
# Real-LM agent.executeEpisode end-to-end (used by tests/integration/execute-turn.test.ts)
pnpm exec tsx scripts/execute-turn-smoke.ts

# Full cognitive pipeline: multi-hop inference, belief recording, contradiction
pnpm exec tsx scripts/cli-smoke.ts
```

The `cli-smoke` script seeds NARS with `(cat --> animal)` and
`(animal --> living)`, then runs three probes that exercise the neurosymbolic loop end-to-end against the real
`TransformersLMClient`. It prints one log line per probe and exits non-zero if any check fails.

---

### Code Guidelines

Following @AGENTS.md:

- ✨ **Elegant** — Clean, readable code
- 📦 **Consolidated** — No duplication
- 🎯 **Consistent** — Follow conventions
- 📁 **Organized** — Logical structure
- 🔁 **DRY** — Don't repeat yourself
- 🧩 **Abstract** — Generalize appropriately
- 🧱 **Modularized** — Separate concerns
- 🔧 **Parameterized** — Configurable behavior

---

<div align="center">

[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue)](https://www.typescriptlang.org/)
[![pnpm](https://img.shields.io/badge/pnpm-10.0-cyan)](https://pnpm.io/)

</div>
