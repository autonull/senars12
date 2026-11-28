import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { getLogger } from './logger.js';
import type { ObserveProgram } from './programs.js';
import type { Manifest, Verdict, Finding, EvidenceRef, CheckResult } from './schema.js';
export type { Verdict } from './schema.js';
import { createFindingSignature, FindingKind, FindingSeverity } from './schema.js';
import { SystemOneManifold, type JudgmentManifold, type JudgmentQuery, type EmbeddingPointer } from '@senars/lm/system-one/manifold';
import { readBundle } from './bundle.js';
import { findingFromCheckFailure, type CheckContext } from './checks.js';

const logger = getLogger('ObserveReview');

const DEFAULT_REVIEWER_PROMPT = `You are reviewing a SeNARS cognitive run for anomalies. Analyze the provided transcript, event summary, and keyframes.

EVENTS OUTRANK NARRATION. If the event log contradicts the narrative, trust the events.

Report findings with:
- kind: one of [wrong-output, loop, stalled, broken-ui, narration-divergence, unmet-expectation]
- severity: one of [info, warn, fail, uncertain]
- claim: concise description
- evidence: array of {type: "frame"|"cast"|"event"|"mark", id, timestamp, description}
- markId: the mark ID this finding relates to
- expectationId: the success criterion ID (if applicable)
- repairHint: minimal hypothesis for repair (one sentence)

Return JSON array of findings. Empty array if none. Uncertain is allowed.`;

interface ReviewInput {
  narrative: string;
  rubricClaims: string[];
  transcript: string;
  eventSummary: string;
  keyframes: string[];
}

export async function reviewBundle(
  bundleDir: string,
  program: ObserveProgram,
  checks: CheckResult[]
): Promise<Verdict> {
  const data = await readBundle(bundleDir);
  const manifest = data.manifest!;
  const events = data.events;
  const marks = data.marks;
  const frameHashes = data.frames;

  const input = buildReviewInput(program, events, marks, frameHashes, checks);
  const findings = await callJudgeBatch(input, program.observe.reviewerPrompt ?? DEFAULT_REVIEWER_PROMPT);

  const checkFindings = checks
    .filter((c) => !c.passed)
    .map((c) => findingFromCheckFailure(c, { bundleDir, program, events, marks, frameHashes, scenarioResult: {} } as CheckContext));

  const allFindings = [...findings, ...checkFindings.filter(Boolean)] as Finding[];

  const overall = computeOverall(allFindings);

  return {
    runId: manifest.runId,
    programId: program.name,
    overall,
    perception: 'text',
    findings: allFindings,
  };
}

function buildReviewInput(
  program: ObserveProgram,
  events: any[],
  marks: any[],
  frameHashes: any[],
  checks: CheckResult[]
): ReviewInput {
  const narrative = buildNarrative(events, marks);
  const rubricClaims = buildRubricClaims(program);
  const transcript = buildTranscript(events);
  const eventSummary = buildEventSummary(events);
  const keyframes = frameHashes.slice(0, 12).map((f) => f.hash);

  return { narrative, rubricClaims, transcript, eventSummary, keyframes };
}

function buildNarrative(events: any[], marks: any[]): string {
  const lines = ['Run narrative:'];
  for (const mark of marks) {
    lines.push(`  [${mark.t}] ${mark.label} (${mark.id})`);
  }
  const eventTypes = new Map<string, number>();
  for (const entry of events) {
    const type = entry.event?.type ?? 'unknown';
    eventTypes.set(type, (eventTypes.get(type) ?? 0) + 1);
  }
  lines.push('\nEvent counts:');
  for (const [type, count] of eventTypes) {
    lines.push(`  ${type}: ${count}`);
  }
  return lines.join('\n');
}

function buildRubricClaims(program: ObserveProgram): string[] {
  const claims = ['The run completes without crashing'];
  for (const [key, value] of Object.entries(program.success_criteria)) {
    if (value === undefined || value === null) continue;
    switch (key) {
      case 'contradiction_detected_within':
        claims.push(`A contradiction is detected within ${value} steps`);
        break;
      case 'response_latency_p95':
        claims.push(`Response latency p95 is under ${value}ms`);
        break;
      case 'min_derivations':
        claims.push(`At least ${value} derivations are produced`);
        break;
      case 'specific_belief_derived':
        claims.push(`The belief "${value}" is derived`);
        break;
    }
  }
  return claims;
}

function buildTranscript(events: any[]): string {
  return events.slice(0, 200).map((e) => `[${e.seq}] ${e.event?.type}: ${JSON.stringify(e.event?.payload ?? {}).slice(0, 200)}`).join('\n');
}

function buildEventSummary(events: any[]): string {
  const gateDecisions = events.filter((e) => e.event?.type?.includes('Gate')).length;
  const derivations = events.filter((e) => e.event?.type === 'DerivationAcceptedEvent').length;
  const toolExecutions = events.filter((e) => e.event?.type === 'ToolExecutedEvent').length;
  const budgetEvents = events.filter((e) => e.event?.type === 'BudgetExhaustedEvent').length;
  const contradictions = events.filter((e) => e.event?.type === 'ConflictDetectedEvent' || e.event?.type === 'BeliefRevisedEvent').length;

  return `Gate decisions: ${gateDecisions}, Derivations: ${derivations}, Tool executions: ${toolExecutions}, Budget exhausted: ${budgetEvents}, Contradictions: ${contradictions}`;
}

async function callJudgeBatch(input: ReviewInput, prompt: string): Promise<Finding[]> {
  try {
    const manifold = await getSystemOneManifold();
    if (!manifold) {
      logger.warn('SystemOneManifold unavailable, returning uncertain');
      return [{
        id: `finding_${Date.now()}`,
        signature: 'uncertain:reviewer_unavailable',
        kind: 'unmet-expectation',
        severity: 'uncertain',
        claim: 'LM reviewer unavailable',
        evidence: [{ type: 'event', id: 'reviewer', timestamp: Date.now(), description: 'SystemOneManifold not initialized' }],
      }];
    }

    const query: JudgmentQuery = {
      kind: 'evaluate',
      rubric: 'observe_review',
      proposition: `Review this cognitive run:\n\n${prompt}\n\nNARRATIVE:\n${input.narrative}\n\nRUBRIC CLAIMS:\n${input.rubricClaims.join('\n')}\n\nTRANSCRIPT:\n${input.transcript}\n\nEVENT SUMMARY:\n${input.eventSummary}\n\nKEYFRAMES: ${input.keyframes.join(', ')}`,
    };

    const results = await manifold.judgeBatch(
      'observe_review_context' as EmbeddingPointer,
      [query],
      { tokens: 10000, steps: 1, wallTimeMs: 30000 }
    );

    const result = results[0];
    if (result.abstained) {
      return [{
        id: `finding_${Date.now()}`,
        signature: 'uncertain:reviewer_abstained',
        kind: 'unmet-expectation',
        severity: 'uncertain',
        claim: 'Reviewer abstained',
        evidence: [{ type: 'event', id: 'reviewer', timestamp: Date.now(), description: result.abstainReason ?? 'unknown' }],
      }];
    }

    return parseFindingsFromResult(result);
  } catch (error) {
    logger.error('judgeBatch call failed', error instanceof Error ? error : new Error(String(error)));
    return [{
      id: `finding_${Date.now()}`,
      signature: 'uncertain:reviewer_error',
      kind: 'unmet-expectation',
      severity: 'uncertain',
      claim: `Reviewer error: ${error instanceof Error ? error.message : String(error)}`,
      evidence: [{ type: 'event', id: 'reviewer', timestamp: Date.now(), description: String(error) }],
    }];
  }
}

function parseFindingsFromResult(result: any): Finding[] {
  try {
    const text = result.legend ?? result.score?.toString() ?? '{}';
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((f, i) => ({
      id: `finding_${Date.now()}_${i}`,
      signature: createFindingSignature(f.kind, f.expectationId, f.markId),
      kind: f.kind,
      severity: f.severity,
      claim: f.claim,
      evidence: f.evidence ?? [],
      markId: f.markId,
      expectationId: f.expectationId,
      repairHint: f.repairHint,
    }));
  } catch {
    return [];
  }
}

function computeOverall(findings: Finding[]): Verdict['overall'] {
  if (findings.some((f) => f.severity === 'fail')) return 'fail';
  if (findings.some((f) => f.severity === 'warn')) return 'warn';
  if (findings.some((f) => f.severity === 'uncertain')) return 'uncertain';
  return 'pass';
}

async function getSystemOneManifold(): Promise<JudgmentManifold | null> {
  try {
    const { createOpenSystemOneManifold } = await import('@senars/lm/system-one/open-systemone-manifold');
    const { systemOneDefaults } = await import('@senars/config');
    return createOpenSystemOneManifold(systemOneDefaults);
  } catch {
    return null;
  }
}