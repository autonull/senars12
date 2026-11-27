import { z } from 'zod';
import { ulid } from 'ulid';

export const EvidenceRefSchema = z.object({
  type: z.enum(['frame', 'cast', 'event', 'mark']),
  id: z.string(),
  timestamp: z.number(),
  description: z.string().optional(),
});
export type EvidenceRef = z.infer<typeof EvidenceRefSchema>;

export const FindingKindSchema = z.enum([
  'wrong-output',
  'loop',
  'stalled',
  'broken-ui',
  'narration-divergence',
  'unmet-expectation',
]);
export type FindingKind = z.infer<typeof FindingKindSchema>;

export const FindingSeveritySchema = z.enum(['info', 'warn', 'fail', 'uncertain']);
export type FindingSeverity = z.infer<typeof FindingSeveritySchema>;

export const FindingSchema = z.object({
  id: z.string(),
  signature: z.string(),
  kind: FindingKindSchema,
  severity: FindingSeveritySchema,
  claim: z.string(),
  evidence: z.array(EvidenceRefSchema),
  markId: z.string().optional(),
  expectationId: z.string().optional(),
  owner: z.string().optional(),
  repairHint: z.string().optional(),
});
export type Finding = z.infer<typeof FindingSchema>;

export const VerdictOverallSchema = z.enum(['pass', 'warn', 'fail', 'uncertain']);
export type VerdictOverall = z.infer<typeof VerdictOverallSchema>;

export const VerdictSchema = z.object({
  runId: z.string(),
  programId: z.string(),
  overall: VerdictOverallSchema,
  perception: z.enum(['text', 'vlm', 'unavailable']),
  findings: z.array(FindingSchema),
});
export type Verdict = z.infer<typeof VerdictSchema>;

export const CheckKindSchema = z.enum(['validator', 'literal', 'stall', 'ui', 'budget']);
export type CheckKind = z.infer<typeof CheckKindSchema>;

export const CheckResultSchema = z.object({
  checkId: z.string(),
  kind: CheckKindSchema,
  passed: z.boolean(),
  score: z.number(),
  details: z.string(),
  expectationId: z.string().optional(),
});
export type CheckResult = z.infer<typeof CheckResultSchema>;

export const RepairTaskSchema = z.object({
  taskId: z.string(),
  baselineRunId: z.string(),
  baselineGitSha: z.string(),
  program: z.any(),
  seed: z.string(),
  lane: z.enum(['hermetic', 'live']),
  repro: z.string(),
  findings: z.array(FindingSchema),
  checks: z.array(CheckResultSchema),
  evidenceIndex: z.record(z.array(EvidenceRefSchema)),
  firstDivergentMark: z.string().optional(),
  hint: z.object({
    owner: z.string().optional(),
    hypothesis: z.string().optional(),
  }),
  acceptance: z.object({
    resolve: z.array(z.string()),
    noNewFindingsAtOrAbove: z.literal('warn'),
    checksMustPass: z.literal(true),
    maxDurationMs: z.number(),
  }),
  doNotEdit: z.array(z.string()),
  riskTier: z.enum(['low', 'medium', 'high']),
});
export type RepairTask = z.infer<typeof RepairTaskSchema>;

export const ManifestSchema = z.object({
  runId: z.string(),
  program: z.any(),
  gitSha: z.string(),
  seed: z.string(),
  lane: z.enum(['hermetic', 'live']),
  marks: z.array(z.object({
    id: z.string(),
    label: z.string(),
    t: z.number(),
    castT: z.number().optional(),
    videoT: z.number().optional(),
  })),
  artifactHashes: z.record(z.string()),
  eventDigest: z.string(),
  fromSeq: z.number(),
  toSeq: z.number(),
});
export type Manifest = z.infer<typeof ManifestSchema>;

export const MarkSchema = z.object({
  id: z.string(),
  label: z.string(),
  t: z.number(),
  castT: z.number().optional(),
  videoT: z.number().optional(),
});
export type Mark = z.infer<typeof MarkSchema>;

export function createFindingSignature(kind: FindingKind, expectationId?: string, markId?: string): string {
  return `${kind}:${expectationId ?? markId ?? 'unknown'}`;
}

export function createCheckId(kind: CheckKind, expectationId: string): string {
  return `${kind}:${expectationId}`;
}

export function generateId(): string {
  return ulid();
}