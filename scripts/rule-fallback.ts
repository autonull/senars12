#!/usr/bin/env tsx

/**
 * `rule:has-fallback` — the gate A1 lands (TODO29.a §5.1 step 8).
 *
 * Two halves, because one is not enough. Every model-backed rule must *declare* a
 * symbolic body, and the declared body must be *what runs* when the model call
 * fails: a fallback that exists but is unreachable is a comment. The second half
 * is measured by driving every built rule over a provider that fails every call
 * and counting the `lm.fallback` events — the event is emitted from inside the
 * degradation path and from nowhere else, so it cannot be satisfied by a
 * declaration alone.
 */

import { checkFallbacks, type FallbackSubject } from './lib/rule-fallback.js';
import { LMRule } from '../nar/src/lm/rule/LMRule.js';
import { ruleDefs } from '../nar/src/lm/rule-templates/index.js';
import { LMRules } from '../nar/src/lm/rule-selectors/factory.js';
import { TermBuilder } from '../nar/src/terms/index.js';
import type { NAREventMap, NarEventBus } from '../nar/src/types/index.js';

const { atom, inheritance } = TermBuilder;

const neverAnswers = {
  tryGenerateText: () => new Promise<string>(() => {}),
  generateObject: () => new Promise<never>(() => {}),
} as never;

// The probe's provider never resolves and the call deadlines are unref'd timers,
// so this interval is the only thing holding the loop open. It is the *rule* that
// must stop waiting, not the process.
const keepAlive = setInterval(() => {}, 50);

const subjects: FallbackSubject[] = [];
for (const def of ruleDefs) {
  const events: NAREventMap['lm.fallback'][] = [];
  const bus = {
    emit: (name: string, payload: unknown) => {
      if (name === 'lm.fallback') events.push(payload as NAREventMap['lm.fallback']);
    },
  } as unknown as NarEventBus;
  // Activation is orthogonal to the question: a rule whose condition skips it
  // never calls the model, and "no fallback ran" would be a fact about the probe.
  const rule: LMRule = LMRules.createById(def.id, neverAnswers, {
    callTimeoutMs: 50,
    activationCondition: () => true,
  });
  rule.setEventBus(bus);
  await rule.apply(
    inheritance(atom('cat'), atom('animal')),
    inheritance(atom('cat'), atom('animal'))
  );
  subjects.push({ id: def.id, hasFallback: rule.hasSymbolicFallback, fallbackRuns: events.length });
}

clearInterval(keepAlive);

const failures = checkFallbacks(subjects);

console.log(`model-backed rules — ${subjects.length} built, each driven over a failing provider\n`);
for (const subject of subjects) {
  const declared = subject.hasFallback ? 'declared' : 'MISSING ';
  const ran = subject.fallbackRuns! > 0 ? 'ran on failure' : 'NEVER RAN';
  console.log(`  ${declared}  ${ran.padEnd(14)}  ${subject.id}`);
}
console.log();

if (failures.length > 0) {
  for (const failure of failures)
    console.error(
      `rule:has-fallback FAILED — ${failure.kind} ${failure.ruleId}: ${failure.detail}`
    );
  process.exit(1);
}

console.log(
  'rule:has-fallback ok — every model-backed rule derives symbolically when the model does not.\n'
);
