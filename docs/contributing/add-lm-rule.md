# Adding an LM Rule

LM rules are async inference steps that delegate to a language model and
re-enter the symbolic system as Narsese tasks. The class is `LMRule`
(`nar/src/lm/rule/LMRule.ts`), registered on the `RuleProcessor`
(`nar/src/rules/processor.ts`).

## Configuration surface

- **`LMRuleConfig`** — the base config, defined in `@senars/util`
  (`util/src/types/llm.ts`) and re-exported through
  `nar/src/lm/lm-service.ts`: `name`, `description`, `category`, `priority`,
  `enabled`, `singlePremise`, `promptTemplate` (string with
  `{{primaryTerm}}`/`{{secondaryTerm}}`/`{{premise1}}`/`{{premise2}}`
  placeholders, or a function), `responseProcessor`, `taskGenerator`,
  `activationCondition`, `lmOptions`, `fallback` (pure-NAL symbolic fallback,
  invoked on LM failure: return `Task[]` or `null` to skip).
- **`LMRuleConfigV2`** (`nar/src/lm/rule/types-v2.ts`) — extends it with
  `inputSchema`/`outputSchema` (Zod), `validate(output)`, `promptVersion`,
  `taskType`, `enableTools`, `constitutionAware`. Providing `outputSchema`
  plus a structured model switches the rule to `generateObject` structured
  output (`LMRule.setStructuredModel`).

## Response parsing — grammar validation before admission

Every text response passes through `LMResponseParser`
(`nar/src/lm/rule/response-parser.ts`) before it can become a task: it
extracts optional `{"narsese": "...", "truth": {f, c}}` JSON, then parses via
`termParser.parseWithTruth`. **Invalid Narsese never enters the system** —
`parsed.valid === false` yields the primary term fallback (see
`LMRule.taskFromProcessed`). Structured outputs with an output schema go
through `processStructuredResponse` → `validateFn` → the same parser for each
`tasks[].narsese` entry.

## Registration paths

1. **Built-in templates** — add an `LMRuleDefinition` to
   `nar/src/lm/rule-templates/` and construct via `createRule(lm, def)`
   (`nar/src/lm/rule-builders.ts`, which injects `NARSESE_INSTRUCTIONS` and
   the prompt). `LMRules.createAll(lmService)` in the templates module builds
   the full set; `nar.ts` registers each via
   `this.processor.registerLMRule(rule)`.
2. **Custom one-off** — `createCustomRule(id, lm, config)` from
   `rule-builders.ts`, then `processor.registerLMRule(rule)`.
3. **Direct** — `new LMRule(id, lmService, config)` + `registerLMRule`.
4. **Dynamic/composite** — `nar/src/lm/dynamic-rule.ts`
   (`DynamicLMRuleGenerator`, `CompositeLMRule`, `createDynamicRuleGenerator`,
   `createCompositeRule`) for rules generated or fused at runtime.

Selection per step is governed by an `LMRuleSelector` (see
`nar/src/lm/rule-selectors/` — `hasLowConfidence`, `hasConflictingBeliefs`,
`hasHighCuriosity`, `isUnderconnected`, ...) via
`processor.setLMSelector(selector, maxRules)`.

## Event typing

`LMRule.setEventBus(bus)` / `setSystemEventBus(bus)` take a `NarEventBus`
(`nar/src/types/events.ts`, `class NarEventBus extends EventBus<NAREventMap>`)
and emit typed `lm.prompt`, `lm.response`, `lm.failure`, `lm.fallback`,
`lm.tool-error` events plus `system:lm.rule:*` system events
(`applied`, `skipped`, `structured`, `constitution-violation`). The
processor wires the bus automatically on `registerLMRule`.

## Example — a custom single-premise LM rule

```ts
// nar/src/lm/ContradictionRule.ts
import type { Task, Term } from '../types';
import { LMRule } from './rule/LMRule.js';
import type { LMService } from './lm-service.js';

export const createContradictionRule = (lm: LMService | null): LMRule =>
  new LMRule('lm-contradiction', lm, {
    name: 'Contradiction Resolution',
    description: 'Reconcile conflicting beliefs via the LM',
    category: 'meta',
    priority: 0.6,
    singlePremise: true,
    activationCondition: (primary, _secondary, context) =>
      typeof context?.['conflictCount'] === 'number' && context['conflictCount'] > 0,
    promptTemplate:
      'Resolve the conflict around {{primaryTerm}} into one Narsese judgment.',
    lmOptions: { temperature: 0.2, maxTokens: 200 },
    // Pure-NAL fallback on LM failure (escalation → null): keep the primary.
    fallback: (primary: Term): Task[] | null => null,
  });

// registration:
// processor.registerLMRule(createContradictionRule(lmService));
```

## Checklist

- [ ] Unique rule `id`; `activationCondition` guards cost (rules run on LM)
- [ ] `fallback` supplied (pure NAL, no LM) for graceful degradation
- [ ] `promptTemplate` placeholders match the v1 filler set, or use
      `outputSchema` + `setStructuredModel` for structured generation
- [ ] Registered via `RuleProcessor.registerLMRule` (bus wiring is automatic)
- [ ] LM failures respect the escalation ladder: attempt → temp retry →
      fallback (circuit breaker is built into `LMRule`)

## Tests to write

Follow `tests/nar/lm.test.ts` and `tests/nar/unit/lm-rule-priority.test.ts`
conventions (vitest, direct construction):

- Parser gating: malformed LM output (`LMResponseParser.parse`) is
  `valid: false` and yields no admitted task term.
- `activationCondition` + `singlePremise` skip semantics
  (`getSkipReason` → `system:lm.rule:skipped`).
- Fallback: with the LM unavailable, `apply` returns the `fallback` tasks.
- Registration: `registerLMRule` wires the event bus and the rule appears in
  the processor's execution log.