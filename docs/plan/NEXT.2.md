# NEXT.2.md — Lean Value Maximization

> **Same vision. 20% of the effort. 80% of the impact.**

---

## The Strategy: Three Wins

Instead of building an ecosystem, focus on **three undeniable wins** that compound.

---

## Win 1: The 60-Second Demo (3 days)

**What**: A single script that proves SeNARS value instantly.

```bash
node examples/wow.js
```

**Does**:
1. Inputs 4 facts → derives 2 hidden conclusions
2. Shows the reasoning trace (LLMs can't do this)
3. Proves memory across "sessions"

**Effort**: One ~100-line file. Update README with 3 lines pointing to it.

**Files**:
- `examples/wow.js` — The demo
- `README.md` — Add "## See It Work" section

---

## Win 2: The Simple API (1 week)

**What**: A facade class that hides complexity.

```javascript
import { Brain } from 'senars';

const b = new Brain();
b.tell('(cats --> mammals).');
b.tell('(whiskers --> cats).');

const a = b.ask('(whiskers --> ?x)?');
// → { term: 'mammals', confidence: 0.73 }
```

**Effort**: Wrapper around existing NAR (~150 lines). No new logic.

**Files**:
- `core/src/Brain.js` — Simple facade
- `core/src/index.js` — Export it

---

## Win 3: The Proof Point (1 week)

**What**: A documented comparison showing when SeNARS wins.

Create `docs/vs-llm.md`:

| Scenario | LLM | SeNARS |
|----------|-----|--------|
| Same question, different context | Contradicts itself | Consistent |
| 10 sessions later | Forgot everything | Remembers |
| "Why did you conclude X?" | Guesses | Shows proof |

Include reproducible scripts that generate these results.

**Files**:
- `docs/vs-llm.md` — The comparison document
- `benchmarks/consistency-test.js` — Reproducible test

---

## Optional Accelerators

If the three wins land well, add these:

| Accelerator | Effort | Impact |
|-------------|--------|--------|
| `npx senars` binary | 2 hours | Instant access |
| Knowledge Book format | 3 days | Shareable knowledge |
| React hook | 2 days | Web developer reach |
| Obsidian plugin | 1 week | Passionate community |

---

## What We're NOT Doing

- ❌ WASM rewrite (nice-to-have, not needed yet)
- ❌ Full Web UI (existing demos work)
- ❌ Plugin registry (no users = no plugins)
- ❌ Multiple framework adapters (one is enough)
- ❌ Comprehensive benchmarks (one clear win is enough)

---

## Timeline

```
Week 1: wow.js demo + README update
Week 2: Brain.js facade  
Week 3: vs-llm.md proof point
Week 4: Polish, npx binary, write blog post
```

**Total: 4 weeks to "minimum viable traction"**

---

## Success = 

1. Someone runs `node examples/wow.js` and shares it
2. Someone uses `Brain` class in their project
3. Someone cites the vs-llm comparison in a discussion

Everything else can wait until these happen.

---

## Immediate Actions (Today)

1. [ ] Write `examples/wow.js` (2 hours)
2. [ ] Add "See It Work" to README.md (10 minutes)
3. [ ] Draft `Brain.js` interface (1 hour)

---

> Do less. Ship faster. Prove value. Then expand.
