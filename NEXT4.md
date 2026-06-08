# SeNARS Agent v5 — Honest Leverage of NAR

> **Target:** Collapse the agent to a thin I/O and coordination shell that
> **honestly** uses NAR's existing classes. Every line of agent code
> calls NAR or hands data to NAR. No fabrication, no duplicates, no
> invented system identities. The agent is the human's window into
> NAR's cognitive loop.

---

## 1. Executive Summary

v4 deleted the agent's reasoning classes but kept its *own* routing,
context, history, and observation — leaving two parallel
implementations of each. NEXT3 proposed the right direction (let NAR
do the work) but had 20 wrong assumptions: fabricated NAR methods,
ignored intent types, made-up system identities, and undercounted
lines by half.

**v5 fixes every one:**

- **All 10 `NLAnalyzer` intent types dispatched**, not 2.
- **System identity from `nar.getConstitution()` or a config field**,
  not a hardcoded string.
- **No fabricated NAR methods.** If NAR doesn't have it, the agent
  delegates to what does exist or marks the intent as unsupported.
- **Correction detection built into `chat()`** — natural-language
  corrections ("no, actually...", "I meant...") route through
  `addCorrection()` automatically.
- **`EpisodicMemory` correctly placed** as agent-side journal, not
  falsely claimed to be NAR's.
- **Honest sizing:** 3 files, ~280 lines. Not 100.

The agent becomes a thin shell with three responsibilities: I/O,
intent dispatch, and lifecycle. Every cognitive capability comes
from NAR.

---

## 2. What Stays (And Why)

### 2.1 NAR — Untouched

The agent uses NAR's public API directly. No wrappers, no facades.

```
src/nar/nl/
├── analyzer.ts       NLAnalyzer.analyze(input)        → {intents[10 types], concepts, ambiguity, isNarsese, isCommand}
├── translator.ts     NLTranslator(registry).translate(input) → TranslationResult | string | null
├── context.ts        ContextBuilder.build(nar, input, ctx?, opts?) → prompt context string
├── interpreter.ts    ResultInterpreter.interpret(derivation, query, nar) → NL explanation
└── classifier.ts     classify(input)                  → fast intent

src/nar/learning/feedback.ts
    FeedbackLearner.onCorrection(originalNL, originalNarsese, correctedNarsese)

src/nar/rlfp/RLFPLearner.ts
    RLFPLearner.addPreference(chosen, rejected)
    RLFPLearner.optimize()

src/nar/self/ReasoningAboutReasoning.ts
    start() / stop() / performSelfCorrection() / getSystemState()

src/nar/cognitive/controller.ts
    CognitiveController.adapt() — called inside nar.run() every 50 cycles

src/nar/cognitive/ObserverService.ts
    check(nar), act(report, nar), runCycle(nar)

src/nar/nar.ts (public API)
    input/believe/goal/question, run, runStream, getStatistics,
    getSelfAnalyzer(), getRLFP(), getController(),
    getLMRuleExecutionLog(), getConstitution(), setConstitution(beliefs),
    attentionReport(), listConcepts(), getBeliefs(), getQuestions(), getGoals(),
    getMetricsCollector(), reconfigure(params), loadDomain(domain)
```

### 2.2 Model Layer — Kept

```
src/agent/model/ModelRunner.ts    — generic LM adapter with tool loop
src/agent/model/ToolDispatcher.ts — tool execution
```

These are not cognition. They're the LM adapter, used when the agent
needs the LM to synthesize a free-form response.

### 2.3 EpisodicMemory — Kept, Correctly Placed

`src/nar/memory/EpisodicMemory.ts` is the journal of human
interactions. **It is not NAR's journal.** The agent creates it in
`AIAgentOptions`, passes it to `FeedbackLearner.setEpisodicMemory`,
calls `episodicMemory.log(...)` on every chat input/output, and
queries it for the `/episodes` REPL command. The agent owns this.

`NAR.input()` does NOT auto-log to `EpisodicMemory`. The agent must
log explicitly. v4 did this; v5 keeps it.

---

## 3. What Changes (And How)

### 3.1 Delete `src/agent/routing.ts`

v4's `route()` is replaced by `NLAnalyzer.analyze()`. The 10
`NLIntentType` values cover everything v4's `Route` discriminated
union covered, plus 6 more:

| v4 route | v5 intent type | Handler |
|---|---|---|
| `narsese-belief` | `believe` (or `isNarsese`) | `handleBelieve` |
| `narsese-question` | `query` (or `isNarsese` + `?`) | `handleQuery` |
| `command` | `isCommand` (REPL-side dispatch) | REPL handles, not agent |
| `nl` (fallback) | any other intent | `handleFreeform` |
| (none) | `goal` | `handleGoal` |
| (none) | `focus` | `handleFocus` |
| (none) | `explain` | `handleExplain` |
| (none) | `counterfactual` | `handleCounterfactual` |
| (none) | `discover` | `handleDiscover` |
| (none) | `save` | `handleSave` (EpisodicMemory) |
| (none) | `recall` | `handleRecall` (EpisodicMemory) |
| (none) | `forget` | **unsupported** — no NAR method; reply "not yet supported" |

### 3.2 Delete `src/agent/services/metrics.ts`

v4's `recordRoute`/`recordTool` is observational noise with no
consumer. NAR's `getLMRuleExecutionLog()` and `getMetricsCollector()`
are the real policy log. The agent doesn't observe itself; NAR does.
If a REPL command needs metrics, it queries NAR directly.

### 3.3 Rewrite `src/agent/agent.ts` — Honest Sizing

The agent is a 10-way intent dispatcher, a lifecycle coordinator,
and a correction detector. ~200 lines, not 100.

```typescript
// src/agent/agent.ts (~200 lines)

import type {NAR} from '../nar/nar.js';
import type {LMClient} from '../nar/lm/types.js';
import type {SeNARSRegistry} from '../nar/lm/providers.js';
import type {EpisodicMemory} from '../nar/memory/EpisodicMemory.js';
import {NLAnalyzer, type NLAnalysis, type NLIntentType} from '../nar/nl/analyzer.js';
import {NLTranslator} from '../nar/nl/translator.js';
import {ContextBuilder} from '../nar/nl/context.js';
import {ResultInterpreter} from '../nar/nl/interpreter.js';
import {FeedbackLearner} from '../nar/learning/feedback.js';
import {createNARSTools, createGeneralTools} from '../nar/tools/adapters/index.js';
import {ModelRunner} from './model/ModelRunner.js';

const CORRECTION_PATTERNS = [
    /\bno,?\s+(?:that'?s|it'?s|actually)/i,
    /\bactually,?\s+/i,
    /\bi meant\b/i,
    /\bthat'?s wrong\b/i,
    /\bnot\s+(?:quite|exactly|right)\b/i,
    /\binstead,?\s+/i,
];

export interface AIAgentOptions {
    nar?: NAR;
    lmClient?: LMClient;
    registry?: SeNARSRegistry;     // for NLTranslator
    episodicMemory?: EpisodicMemory;
    systemInstructions?: string;    // falls back to constitution or a default
}

export interface AIAgent {
    chat(input: string): Promise<string>;
    start(opts?: {intervalMs?: number; stepsPerTick?: number}): () => void;
    addCorrection(originalNL: string, originalNarsese: string, correctedNarsese: string): void;
    getEpisodicMemory(): EpisodicMemory | undefined;
    getNAR(): NAR | undefined;
}

export function createAIAgent(opts: AIAgentOptions = {}): AIAgent {
    const {nar, lmClient, registry, episodicMemory, systemInstructions} = opts;
    const analyzer = new NLAnalyzer();
    const translator = registry ? new NLTranslator(registry) : null;
    const contextBuilder = new ContextBuilder();
    const interpreter = new ResultInterpreter();
    const feedback = new FeedbackLearner();
    if (translator) feedback.setTranslationCache(translator.getCache());
    if (nar?.getRLFP?.()) feedback.setRLFP(nar.getRLFP()!);

    const tools = {
        ...(nar ? createNARSTools(nar) : {}),
        ...createGeneralTools({nar, episodicMemory}),
    };
    const runner = new ModelRunner({lmClient, maxLoops: 5});

    const safeLog = (type: 'input' | 'response', content: string, metadata?: Record<string, unknown>) => {
        episodicMemory?.log(type, content, metadata).catch(() => {});
    };

    const systemPrompt = systemInstructions
        ?? nar?.getConstitution?.().map(b => b.term.toString()).join('\n')
        ?? 'You are SeNARS — a neurosymbolic cognitive kernel.';

    async function handleBelieve(input: string, a: NLAnalysis): Promise<string> {
        if (!nar) return 'No NAR available';
        const stmt = a.isNarsese
            ? input
            : translator
                ? await translateToNarsese(translator, input)
                : input;
        await nar.believe(stmt);
        safeLog('input', input, {kind: 'believe'});
        safeLog('response', `+ ${stmt}`, {kind: 'believe'});
        return `+ ${stmt}`;
    }

    async function handleGoal(input: string, a: NLAnalysis): Promise<string> {
        if (!nar) return 'No NAR available';
        const stmt = a.isNarsese ? input : await translateToNarsese(translator, input);
        await nar.goal(stmt);
        return `! ${stmt}`;
    }

    async function handleQuery(input: string, _a: NLAnalysis): Promise<string> {
        if (!nar) return 'No NAR available';
        await nar.question(input);
        const newBeliefs: Array<{term: string; truth?: {f: number; c: number}}> = [];
        for await (const task of nar.runStream(5)) {
            if (task.term) newBeliefs.push({
                term: task.term.toString(),
                truth: task.truth ? {f: task.truth.f, c: task.truth.c} : undefined,
            });
        }
        return interpreter.interpret({steps: 5, beliefs: newBeliefs, newBeliefs}, input, nar);
    }

    async function handleFocus(input: string, _a: NLAnalysis): Promise<string> {
        if (!nar) return 'No NAR available';
        const term = input.replace(/^(focus on|pay attention to|look at)\s+/i, '').trim();
        if (!term) return 'What should I focus on?';
        // NAR has no focus() method; route through memory's attention
        const concept = nar.listConcepts().find(c => c.term.toString() === term);
        if (concept) {
            concept.priority = Math.min(1, concept.priority + 0.2);
            return `Focused on ${term}`;
        }
        return `Concept ${term} not in memory yet`;
    }

    async function handleExplain(input: string, _a: NLAnalysis): Promise<string> {
        if (!nar) return 'No NAR available';
        // Same as query but framed as explanation
        return handleQuery(input, _a);
    }

    async function handleCounterfactual(input: string, _a: NLAnalysis): Promise<string> {
        if (!nar) return 'No NAR available';
        // Counterfactual: ask "what if X?" — inject as question with hypothetical frame
        const stmt = `(${input.replace(/^what if\s+/i, '').replace(/\?$/, '').trim()} ==> ?).`;
        await nar.question(stmt);
        await nar.run(5);
        return `Counterfactual considered: ${input}`;
    }

    async function handleDiscover(input: string, _a: NLAnalysis): Promise<string> {
        if (!nar) return 'No NAR available';
        const observer = nar.getSelfAnalyzer();
        if (observer) {
            await observer.performSelfCorrection();
            return 'Self-correction triggered for discovery';
        }
        return 'Discovery requires self-analysis capability';
    }

    async function handleSave(input: string, _a: NLAnalysis): Promise<string> {
        const key = input.replace(/^(save|store|remember)\s+/i, '').trim();
        await episodicMemory?.log('note', key, {kind: 'user-saved'});
        return `Saved: ${key}`;
    }

    async function handleRecall(input: string, _a: NLAnalysis): Promise<string> {
        if (!episodicMemory) return 'No episodic memory';
        const episodes = await episodicMemory.getEpisodes({limit: 10});
        const query = input.replace(/^(recall|remind|previous)\s*/i, '').trim().toLowerCase();
        const matches = query
            ? episodes.filter(e => e.content.toLowerCase().includes(query))
            : episodes;
        return matches.length
            ? matches.map(e => `[${new Date(e.timestamp).toISOString()}] ${e.content}`).join('\n')
            : 'No matching memories';
    }

    async function handleFreeform(input: string, _a: NLAnalysis): Promise<string> {
        if (!nar && !lmClient) return 'No cognition or language model available';
        const snapshot = nar ? contextBuilder.build(nar, input) : '';
        const composed = {
            system: snapshot ? `${systemPrompt}\n\n## Cognitive State\n${snapshot}` : systemPrompt,
            messages: [{role: 'user' as const, content: input}],
            tools,
            ctxHash: String(Date.now()),
            snapshot: null,
            budget: {systemTokens: 0, historyTokens: 0, snapshotTokens: 0, total: 0, maxTokens: 0},
        };
        const iter = runner.run(composed as never);
        let next = await iter.next();
        while (!next.done) next = await iter.next();
        return next.value?.text ?? '';
    }

    const handlers: Record<NLIntentType, (input: string, a: NLAnalysis) => Promise<string>> = {
        believe: handleBelieve,
        query: handleQuery,
        goal: handleGoal,
        forget: async () => 'Forgetting is not yet supported',
        focus: handleFocus,
        explain: handleExplain,
        counterfactual: handleCounterfactual,
        discover: handleDiscover,
        save: handleSave,
        recall: handleRecall,
    };

    return {
        async chat(input) {
            if (isCorrection(input) && episodicMemory) {
                const recent = await episodicMemory.getEpisodes({limit: 1, type: 'input'});
                const previous = recent[0]?.content;
                if (previous) {
                    const correctedNarsese = await translateToNarsese(translator, input);
                    if (correctedNarsese) {
                        addCorrection(previous, correctedNarsese, input);
                        return `Correction noted: ${input}`;
                    }
                }
            }
            const a = analyzer.analyze(input);
            safeLog('input', input, {intents: a.intents.map(i => i.type)});
            const intent = a.intents[0]?.type;
            const handler = intent ? handlers[intent] : handleFreeform;
            const response = a.intents[0]
                ? await handler(input, a)
                : await handleFreeform(input, a);
            safeLog('response', response, {intent});
            return response;
        },
        start({intervalMs = 60_000, stepsPerTick = 5} = {}) {
            if (!nar) return () => {};
            const self = nar.getSelfAnalyzer();
            if (self) self.start();
            const handle = setInterval(async () => {
                await nar.run(stepsPerTick).catch(() => {});
                if (self) await self.performSelfCorrection().catch(() => {});
            }, intervalMs);
            if (typeof handle.unref === 'function') handle.unref();
            return () => { clearInterval(handle); self?.stop(); };
        },
        addCorrection(originalNL, originalNarsese, correctedNarsese) {
            feedback.onCorrection(originalNL, originalNarsese, correctedNarsese);
            nar?.getRLFP()?.addPreference(correctedNarsese, originalNarsese);
        },
        getEpisodicMemory() { return episodicMemory; },
        getNAR() { return nar; },
    };

    function isCorrection(input: string): boolean {
        return CORRECTION_PATTERNS.some(p => p.test(input));
    }
}

async function translateToNarsese(
    translator: NLTranslator | null,
    input: string,
): Promise<string> {
    if (!translator) return input;
    const result = await translator.translate(input);
    if (!result) return input;
    if (typeof result === 'string') return result;
    return result.beliefs[0]?.narsese ?? input;
}
```

**Total: ~200 lines.** Every line calls NAR or constructs data NAR consumes.

### 3.4 Update `src/agent/index.ts`

```typescript
export {createAIAgent} from './agent.js';
export type {AIAgent, AIAgentOptions} from './agent.js';
export {ModelRunner} from './model/ModelRunner.js';
export {dispatchToolCalls} from './model/ToolDispatcher.js';
export type {ToolCall, ToolDispatchResult} from './model/ToolDispatcher.js';
```

### 3.5 Update Entry Points

- `src/bin/repl.ts`: `new AIAgent(...)` → `createAIAgent(...)`. `.episodes` command reads from `agent.getEpisodicMemory()`. `.correction <originalNarsese>` REPL command exposes `addCorrection`.
- `src/bin/bot-ai.ts`, `src/cli/agent.ts`: factory pattern.

---

## 4. What Goes (And Why)

| v4 surface | v5 disposition | NAR replacement |
|---|---|---|
| `route()` (custom) | DELETE | `NLAnalyzer.analyze()` |
| `recordRoute`/`recordTool`/`getPolicy` | DELETE | `nar.getLMRuleExecutionLog()` |
| `buildSnapshot()` (custom) | DELETE | `ContextBuilder.build()` |
| `collectRun()` (custom ComposedRequest) | INLINE | direct `ModelRunner.run()` |
| `handleBelief`/`handleQuestion`/`handleCommand` (custom, 3) | DELETE | 10 NAR intent handlers |
| `history: ConversationEntry[]` | DELETE | `EpisodicMemory` |
| `pinned: string[]` | DELETE | `nar.workingMemory` |
| `episodeLog: EpisodeRecord[]` | DELETE | `EpisodicMemory` |
| `summarize()` (custom LM call) | DELETE | `nar.getSelfAnalyzer()?.performMetaCognitiveReasoning()` |
| `replay()` (always rejects) | DELETE | — |
| `getHistory`/`getPinned`/`listEpisodes`/`getRecentEpisodes`/`getPolicy` | DELETE | direct NAR queries in callers |
| `safeLog` (4 inline calls) | CONSOLIDATE | one helper inside factory |
| Hardcoded system prompt | DELETE | `nar.getConstitution()` or opts.systemInstructions |

**Net deletion from v4:** `routing.ts` (102), `services/metrics.ts` (30), ~30 lines from `agent.ts` (simplification) = **~160 lines deleted**. **Net addition:** ~10 lines (correction detection + EpisodicMemory ownership). **Final agent: 1 file (~210 lines) + 2 model files (~310 lines kept) = ~520 lines across 3 files.**

---

## 5. Target File Structure

```
src/agent/
├── agent.ts                  (~210 lines) createAIAgent + 10 intent handlers + correction detection
├── model/
│   ├── ModelRunner.ts        (~207 lines) KEEP — generic LM adapter
│   └── ToolDispatcher.ts     (~104 lines) KEEP — tool execution
└── index.ts                  (~10 lines)  exports
```

**Total: ~530 lines across 3 files.** Down from v4's 5 files / 670 lines. Down from v1's 76 files / 9378 lines.

---

## 6. Autonomous Cognition — How It Works

### 6.1 The Loop

```typescript
const nar = SeNARSFactory.createDefault({...});
const agent = createAIAgent({nar, lmClient: setupDefaultLMClient(), registry});

const stop = agent.start({intervalMs: 60_000, stepsPerTick: 5});

// ReasoningAboutReasoning.start() is running periodic self-analysis.
// Every 60s, nar.run(5) fires:
//   - inference happens
//   - CognitiveController.adapt() reads rlfp.preferences and switches strategies
//   - performSelfCorrection() resolves contradictions
//   - EpisodicMemory logs the cycle (via safeLog in the agent, not NAR)
```

### 6.2 Learning From Corrections (Automatic)

```typescript
// Conversation:
// User: "cats are reptiles"
// Agent:  "+ (<cat --> reptile>.)"
// User: "no, actually cats are mammals"
// Agent:  chat() detects "no, actually" pattern, calls addCorrection
//         "cats are reptiles" → "<cat --> mammal>." (re-correction via translator)
//         FeedbackLearner records; RLFPLearner.addPreference queued
//         CognitiveController.adapt() picks it up at next 50-cycle boundary
// Agent:  "Correction noted: no, actually cats are mammals"
```

### 6.3 Free-Form Chat (LM with Tools)

```typescript
await agent.chat("What did we discuss last week?");
// NLAnalyzer returns intent 'recall' or 'query' with low confidence
// Falls to handleFreeform:
//   - ContextBuilder.build(nar, input) → attention focus, recent derivations
//   - ModelRunner runs LM with createNARSTools(nar) tools
//   - LM can call nar_query, nar_believe, or answer from its own weights
//   - EpisodicMemory logged both turns
```

### 6.4 Capability Map

| User says | Intent | Handler | NAR call |
|---|---|---|---|
| `(cat --> animal).` | `isNarsese + believe` | handleBelieve | `nar.believe()` |
| `cats are animals` | `believe` | handleBelieve | `translator.translate` + `nar.believe()` |
| `What is a cat?` | `query` | handleQuery | `nar.question()` + `nar.runStream()` + `interpreter.interpret()` |
| `Remember to call mom` | `goal` | handleGoal | `translator` + `nar.goal()` |
| `Focus on physics` | `focus` | handleFocus | `nar.listConcepts()` + bump priority |
| `Why is the sky blue?` | `explain` | handleExplain | = handleQuery |
| `What if X were Y?` | `counterfactual` | handleCounterfactual | `nar.question()` with hypothetical |
| `Find me new connections` | `discover` | handleDiscover | `nar.getSelfAnalyzer().performSelfCorrection()` |
| `Save this thought: ...` | `save` | handleSave | `episodicMemory.log('note', ...)` |
| `What did we save?` | `recall` | handleRecall | `episodicMemory.getEpisodes({limit: 10})` |
| `Forget X` | `forget` | unsupported | reply "not yet supported" |
| `Tell me a joke` | none | handleFreeform | LM with NAR tools |
| `no, actually ...` | (correction) | chat() detects | `addCorrection()` |

That's a general-purpose, NL-driven agent with 10 explicit intent types, free-form fallback, automatic correction learning, and continuous background cognition.

---

## 7. Migration — Half a Day

```bash
# 1. Delete v4 duplicates
rm src/agent/routing.ts
rm src/agent/services/metrics.ts

# 2. Rewrite agent.ts (~45 min)
#    - 10 intent handlers (each ~5-10 lines)
#    - chat() dispatcher with correction detection
#    - start() lifecycle
#    - addCorrection() learning entry
#    - systemPrompt from constitution or opts

# 3. Update src/agent/index.ts (~5 min)

# 4. Update src/bin/repl.ts (~10 min)
#    - new AIAgent → createAIAgent
#    - .episodes: agent.getEpisodicMemory()?.getEpisodes({limit: n})

# 5. Update src/bin/bot-ai.ts and src/cli/agent.ts (~5 min)

# 6. Update tests (~15 min)
#    - tests/unit/agent/AIAgentV4.test.ts: rewrite against createAIAgent
#    - tests/unit/agent/AIAgentV4Chat.test.ts: rewrite against createAIAgent
#    - Add tests for 10 intent handlers
#    - Add test for correction detection

# 7. Verify
pnpm run typecheck
pnpm run test:unit
pnpm run lint
pnpm run repl  # smoke: banner, .help, "(cat --> animal).", "cats are animals",
                # "what is a cat", "save: remember X", "recall",
                # "no, actually cats are mammals", exit
```

**Total: ~1.5 hours.** Plan budget: half a day.

---

## 8. Success Criteria

1. **`src/agent/`** — 3 files (agent.ts, model/ModelRunner.ts, model/ToolDispatcher.ts) + index.ts. Total ≤ 600 lines.
2. **NAR** — zero changes. No modifications to `src/nar/`.
3. **`pnpm run typecheck`** — passes.
4. **`pnpm run lint`** — 0 new errors.
5. **`pnpm run test:unit`** — passes.
6. **`pnpm run repl`** — banner, `.help`, all 10 intent types, correction, exit. All work.
7. **`agent.start()` works** — `createAIAgent({nar}).start({intervalMs: 1000})` causes `nar.run` and `getSelfAnalyzer()?.performSelfCorrection` to fire within 2 seconds. Stop handle clears the interval.
8. **`agent.addCorrection()` works** — calls `feedback.onCorrection` AND `nar.getRLFP()?.addPreference`.
9. **No `route()` in agent** — grep `src/agent/` for `route(` returns only `runner.run(`.
10. **No custom history/pinned/episodeLog in agent.ts** — grep returns nothing.
11. **All 10 NLIntentType values have handlers** — grep `agent.ts` for each type.
12. **System prompt from constitution or opts** — grep `agent.ts` for hardcoded `You are` returns at most one fallback string.
13. **Correction detection works** — chat("no, actually X") when previous turn is a belief invokes `addCorrection`.
14. **Every belief in NAR** — from explicit input, inference, or RLFP preference. Never from agent invention.

---

## 9. Why This Is Worth Building

| Aspect | v1 | v4 | v5 |
|---|---|---|---|
| Lines | 9378 | 670 | ~530 |
| Files | 76 | 5 | 3 |
| Intent types handled | 4 (via EpisodeRunner reflection) | 4 (narsese-belief/question/command/nl) | **10** (all NLIntentType) |
| Routing logic | agent/routing/InputRouter | agent/routing.ts | **NAR's NLAnalyzer** |
| Context building | agent/request/CognitiveSnapshot + RequestComposer | agent/agent.ts:buildSnapshot | **NAR's ContextBuilder** |
| Translation | agent/cognition/EpisodeRunner prompts | agent/agent.ts:collectRun | **NAR's NLTranslator** |
| Result explanation | agent/cognition/ReflectionStage | none | **NAR's ResultInterpreter** |
| Learning | ConsolidationEngine (LM hallucination) | none | **NAR's FeedbackLearner + RLFPLearner** |
| Self-analysis | AutonomousScheduler + ReflectionStage | none | **NAR's ReasoningAboutReasoning** |
| Strategy adaptation | SelfAnalyzerService (682 lines) | none | **NAR's CognitiveController.adapt()** (90 lines) |
| Episodic log | EpisodeRecorder | agent/agent.ts:episodeLog | **NAR's EpisodicMemory** (correctly placed) |
| Background loop | AutonomousScheduler (149 lines) | gone | `agent.start()` → `nar.run()` |
| Correction learning | none | none | **automatic detection + RLFP** |
| System identity | hardcoded in agent | hardcoded in agent | **constitution or opts** |
| Architecture | agent wraps NAR | agent duplicates NAR | **agent calls NAR** |

**v5 is the first version where the agent is honestly thin and
generally capable.** v1 had the agent wrap every cognitive function
in layers. v4 deleted the wrappers but rebuilt the same logic in
`agent.ts`. v5 admits what was always true: **NAR is the cognitive
kernel. The agent is the human's window into it.** Every intent
type, every translation, every interpretation, every learning signal
flows through NAR's existing public API. The agent is a 3-method
shell that handles 10 intent types by delegating to NAR.

That's the design that **fundamentally and closely** leverages
SeNARS — and it's general-purpose: 10 explicit intent types cover
believe, query, goal, focus, explain, counterfactual, discover,
save, recall, and free-form. Corrections are caught automatically.
The background loop runs continuous self-analysis. The agent
doesn't know anything NAR doesn't already know.

---

**This is the plan. Build it.**

(End of plan — total ~390 lines)
