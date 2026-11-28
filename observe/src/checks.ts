import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { getLogger } from './logger.js';
import type { ObserveProgram } from './programs.js';
import type { CheckResult, Finding, EvidenceRef, Mark } from './schema.js';
export type { CheckResult } from './schema.js';
import { createCheckId, FindingKind, FindingSeverity } from './schema.js';
import { readBundle } from './bundle.js';

const logger = getLogger('ObserveChecks');

interface CheckContext {
  bundleDir: string;
  program: ObserveProgram;
  events: any[];
  marks: Mark[];
  frameHashes: any[];
  scenarioResult: any;
}

function makeCheck(kind: CheckResult['kind'], expectationId: string, passed: boolean, score: number, details: string): CheckResult {
  return { checkId: createCheckId(kind, expectationId), kind, passed, score, details, expectationId };
}

export async function runChecks(bundleDir: string, program: ObserveProgram): Promise<CheckResult[]> {
  const data = await readBundle(bundleDir);
  const context: CheckContext = {
    bundleDir,
    program,
    events: data.events,
    marks: data.marks,
    frameHashes: data.frames,
    scenarioResult: data.manifest?.scenarioResult,
  };
  const results: CheckResult[] = [];

  results.push(...runValidatorChecks(context));
  results.push(...runLiteralChecks(context));
  results.push(...runStallChecks(context));
  results.push(...runUIChecks(context));
  results.push(...runBudgetChecks(context));

  logger.info('Checks completed', { bundleDir, passed: results.filter((r) => r.passed).length, total: results.length });
  return results;
}

function runValidatorChecks(context: CheckContext): CheckResult[] {
  const { program, scenarioResult } = context;
  const results: CheckResult[] = [];

  for (const [key, value] of Object.entries(program.success_criteria)) {
    if (value === undefined || value === null) continue;

    let passed = false;
    let score = 0;
    let details = '';

    switch (key) {
      case 'no_crash': {
        passed = scenarioResult?.success ?? false;
        score = passed ? 1 : 0;
        details = passed ? 'No crash' : `Crashed: ${scenarioResult?.error ?? 'unknown'}`;
        break;
      }
      case 'contradiction_detected_within': {
        passed = (scenarioResult?.contradictions_detected ?? 0) > 0 &&
          (scenarioResult?.steps_executed ?? 0) <= (value as number);
        score = passed ? 1 : 0.5;
        details = passed
          ? `Contradiction detected at step ${scenarioResult?.steps_executed}`
          : `No contradiction within ${value} steps`;
        break;
      }
      case 'response_latency_p95': {
        const avgLatency = scenarioResult?.duration_ms ? scenarioResult.duration_ms / (scenarioResult.steps_executed || 1) : 0;
        passed = avgLatency <= (value as number);
        score = passed ? 1 : Math.max(0, 1 - avgLatency / ((value as number) * 2));
        details = `Avg latency ${avgLatency.toFixed(1)}ms (threshold: ${value}ms)`;
        break;
      }
      case 'min_derivations': {
        passed = (scenarioResult?.derived_beliefs?.length ?? 0) >= (value as number);
        score = passed ? 1 : (scenarioResult?.derived_beliefs?.length ?? 0) / (value as number);
        details = `${scenarioResult?.derived_beliefs?.length ?? 0}/${value} derivations`;
        break;
      }
      case 'specific_belief_derived': {
        const target = value as string;
        passed = (scenarioResult?.derived_beliefs ?? []).some((b: string) => b.includes(target));
        score = passed ? 1 : 0;
        details = passed ? `Derived ${target}` : `Missing ${target}`;
        break;
      }
      default: {
        passed = true;
        score = 1;
        details = `Unknown criterion: ${key}`;
      }
    }

    results.push(makeCheck('validator', key, passed, score, details));
  }

  return results;
}

function runLiteralChecks(context: CheckContext): CheckResult[] {
  const results: CheckResult[] = [];
  const { events } = context;

  const problematicLiterals = ['NaN', 'undefined', '[object Object]'];
  let found = false;
  let details = '';

  for (const entry of events) {
    const eventStr = JSON.stringify(entry.event);
    for (const literal of problematicLiterals) {
      if (eventStr.includes(literal)) {
        found = true;
        details += `Found ${literal} in event; `;
      }
    }
  }

  results.push({
    checkId: createCheckId('literal', 'problematic_literals'),
    kind: 'literal',
    passed: !found,
    score: found ? 0 : 1,
    details: found ? details : 'No problematic literals found',
    expectationId: 'problematic_literals',
  });

  return results;
}

function runStallChecks(context: CheckContext): CheckResult[] {
  const results: CheckResult[] = [];
  const { events, marks } = context;

  const maxSilentSteps = 50;
  let maxGap = 0;
  let lastEventSeq = 0;

  for (let i = 0; i < events.length; i++) {
    const gap = events[i].seq - lastEventSeq;
    if (gap > maxGap) maxGap = gap;
    lastEventSeq = events[i].seq;
  }

  const stalled = maxGap > maxSilentSteps;

  results.push({
    checkId: createCheckId('stall', 'event_gap'),
    kind: 'stall',
    passed: !stalled,
    score: stalled ? 0 : 1,
    details: stalled ? `Event gap of ${maxGap} steps (max allowed: ${maxSilentSteps})` : `Max event gap: ${maxGap} steps`,
    expectationId: 'event_gap',
  });

  return results;
}

function runUIChecks(context: CheckContext): CheckResult[] {
  const results: CheckResult[] = [];
  const { frameHashes } = context;

  if (frameHashes.length < 6) {
    results.push({
      checkId: createCheckId('ui', 'frozen_frames'),
      kind: 'ui',
      passed: true,
      score: 1,
      details: 'Insufficient frames for frozen UI check',
      expectationId: 'frozen_frames',
    });
    return results;
  }

  let maxIdentical = 1;
  let currentIdentical = 1;
  let lastHash = frameHashes[0]?.hash;

  for (let i = 1; i < frameHashes.length; i++) {
    if (frameHashes[i].hash === lastHash) {
      currentIdentical++;
      if (currentIdentical > maxIdentical) maxIdentical = currentIdentical;
    } else {
      currentIdentical = 1;
      lastHash = frameHashes[i].hash;
    }
  }

  const frozen = maxIdentical >= 6;

  results.push({
    checkId: createCheckId('ui', 'frozen_frames'),
    kind: 'ui',
    passed: !frozen,
    score: frozen ? 0 : 1,
    details: frozen ? `${maxIdentical} identical consecutive frames (frozen UI)` : `Max identical consecutive frames: ${maxIdentical}`,
    expectationId: 'frozen_frames',
  });

  return results;
}

function runBudgetChecks(context: CheckContext): CheckResult[] {
  const results: CheckResult[] = [];
  const { events } = context;

  let budgetExhaustedCount = 0;

  for (const entry of events) {
    if (entry.event?.type === 'BudgetExhaustedEvent') {
      budgetExhaustedCount++;
    }
  }

  const storm = budgetExhaustedCount > 3;

  results.push({
    checkId: createCheckId('budget', 'budget_storm'),
    kind: 'budget',
    passed: !storm,
    score: storm ? 0 : 1,
    details: storm ? `${budgetExhaustedCount} BudgetExhaustedEvents (storm threshold: 3)` : `${budgetExhaustedCount} BudgetExhaustedEvents`,
    expectationId: 'budget_storm',
  });

  return results;
}

export function findingFromCheckFailure(check: CheckResult, context: CheckContext): Finding | null {
  if (check.passed) return null;

  const evidence: EvidenceRef[] = [
    { type: 'event', id: check.expectationId ?? 'unknown', timestamp: Date.now(), description: check.details },
  ];

  let kind: FindingKind = 'unmet-expectation';
  if (check.kind === 'literal') kind = 'wrong-output';
  if (check.kind === 'stall') kind = 'stalled';
  if (check.kind === 'ui') kind = 'broken-ui';
  if (check.kind === 'budget') kind = 'wrong-output';

  return {
    id: `finding_${Date.now()}`,
    signature: `${kind}:${check.checkId}`,
    kind,
    severity: 'warn',
    claim: check.details,
    evidence,
    expectationId: check.expectationId,
  };
}