import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { ulid } from 'ulid';
import { createLogger } from 'senars/util/logger';
import { governanceArtifactRegistry } from 'senars/governance/artifacts';
import type { Manifest, Verdict, Finding } from './schema.js';
import type { ObserveProgram } from './programs.js';

const logger = createLogger({ scope: 'ObservePromote' });

export interface PromoteResult {
  fixturePath: string;
  profileName: string;
  hardeningSuggestion?: string;
}

export async function promoteRun(runId: string): Promise<PromoteResult> {
  const bundleDir = findBundle(runId);
  if (!bundleDir) {
    throw new Error(`Bundle not found: ${runId}`);
  }

  const manifest = JSON.parse(await fs.readFile(join(bundleDir, 'manifest.json'), 'utf-8')) as Manifest;
  const verdict = JSON.parse(await fs.readFile(join(bundleDir, 'verdict.json'), 'utf-8')) as Verdict;
  const fixedVerdict = await findFixedVerdict(runId);

  const program = manifest.program as ObserveProgram;
  const clearedSignatures = findClearedSignatures(verdict, fixedVerdict);

  const fixtureId = ulid();
  const profileName = `${program.name}_${fixtureId}`;
  const fixtureDir = join(process.cwd(), 'fixtures', 'observe', profileName);
  await fs.mkdir(fixtureDir, { recursive: true });

  const fixtureProgram: ObserveProgram = {
    ...program,
    metadata: {
      ...program.metadata,
      profile: 'regression',
    },
  };

  const fixtureManifest = {
    ...manifest,
    runId: fixtureId,
    originalRunId: runId,
    fixedRunId: fixedVerdict?.runId,
    clearedSignatures,
    promotedAt: new Date().toISOString(),
  };

  await fs.writeFile(join(fixtureDir, 'program.json'), JSON.stringify(fixtureProgram, null, 2));
  await fs.writeFile(join(fixtureDir, 'manifest.json'), JSON.stringify(fixtureManifest, null, 2));
  await fs.writeFile(join(fixtureDir, 'verdict.json'), JSON.stringify(verdict, null, 2));
  if (fixedVerdict) {
    await fs.writeFile(join(fixtureDir, 'fixed-verdict.json'), JSON.stringify(fixedVerdict, null, 2));
  }

  const hardeningSuggestion = generateHardeningSuggestion(verdict, program);
  if (hardeningSuggestion) {
    await fs.writeFile(join(fixtureDir, 'hardening-suggestion.md'), hardeningSuggestion);
  }

  await registerRegressionFixture(profileName, fixtureManifest);

  logger.info('Run promoted to fixture', { runId, profileName, fixtureDir, clearedSignatures: clearedSignatures.length });

  return {
    fixturePath: fixtureDir,
    profileName,
    hardeningSuggestion,
  };
}

function findBundle(runId: string): string | null {
  const possiblePaths = [
    join(process.cwd(), '.cache', 'observations', runId),
    join(process.cwd(), 'generated', 'observations', runId),
  ];
  for (const path of possiblePaths) {
    try {
      require('node:fs').accessSync(path);
      return path;
    } catch {
      continue;
    }
  }
  return null;
}

async function findFixedVerdict(originalRunId: string): Promise<Verdict | null> {
  const observationsDir = join(process.cwd(), '.cache', 'observations');
  try {
    const entries = await fs.readdir(observationsDir);
    for (const entry of entries) {
      if (entry.startsWith('verify_')) {
        const verifyDir = join(observationsDir, entry);
        const verificationPath = join(verifyDir, 'verification.json');
        try {
          const verification = JSON.parse(await fs.readFile(verificationPath, 'utf-8'));
          if (verification.criteria?.resolve) {
            const baselineRunId = Object.keys(verification.criteria.resolve).find((k) => k.includes(originalRunId));
            if (baselineRunId) {
              return JSON.parse(await fs.readFile(join(verifyDir, 'verdict.json'), 'utf-8'));
            }
          }
        } catch {
          continue;
        }
      }
    }
  } catch {
    return null;
  }
  return null;
}

function findClearedSignatures(originalVerdict: Verdict, fixedVerdict: Verdict | null): string[] {
  if (!fixedVerdict) return [];

  const originalSigs = new Set(originalVerdict.findings.map((f) => f.signature));
  const fixedSigs = new Set(fixedVerdict.findings.map((f) => f.signature));

  return [...originalSigs].filter((sig) => !fixedSigs.has(sig));
}

function generateHardeningSuggestion(verdict: Verdict, program: ObserveProgram): string | undefined {
  const lmFindings = verdict.findings.filter((f) => f.severity !== 'info' && !f.expectationId);

  if (lmFindings.length === 0) return undefined;

  const lines: string[] = [];
  lines.push('# Hardening Suggestion');
  lines.push('');
  lines.push('The following findings were detected by LM review and could be hardened into deterministic checks:');
  lines.push('');

  for (const finding of lmFindings) {
    lines.push(`## ${finding.kind} (${finding.severity})`);
    lines.push('');
    lines.push(`**Claim:** ${finding.claim}`);
    lines.push(`**Signature:** \`${finding.signature}\``);
    if (finding.repairHint) lines.push(`**Repair Hint:** ${finding.repairHint}`);
    lines.push('');
    lines.push('### Suggested Check');
    lines.push('');

    switch (finding.kind) {
      case 'loop':
        lines.push('Add a stall check in `checks.ts` that detects repeated event patterns:');
        lines.push('```typescript');
        lines.push('// In runStallChecks:');
        lines.push('const loopDetected = detectEventLoop(events, {');
        lines.push('  maxRepetitions: 3,');
        lines.push('  windowSize: 50,');
        lines.push('});');
        lines.push('```');
        break;
      case 'broken-ui':
        lines.push('Add a frozen UI check in `checks.ts` (already exists as runUIChecks):');
        lines.push('```typescript');
        lines.push('// In runUIChecks:');
        lines.push('const frozen = maxIdenticalConsecutiveFrames >= 6;');
        lines.push('```');
        break;
      case 'narration-divergence':
        lines.push('Add a narrative consistency check comparing event log to narrator output:');
        lines.push('```typescript');
        lines.push('// In runChecks:');
        lines.push('const narrationDivergence = compareNarrativeToEvents(narrative, events);');
        lines.push('```');
        break;
      case 'wrong-output':
        lines.push('Add a literal check for specific problematic outputs:');
        lines.push('```typescript');
        lines.push('// In runLiteralChecks:');
        lines.push('const hasProblematicOutput = events.some(e =>');
        lines.push('  JSON.stringify(e).includes("specific_pattern")');
        lines.push(');');
        lines.push('```');
        break;
      default:
        lines.push('Add a custom validator in `checks.ts` that checks for this specific condition.');
    }
    lines.push('');
  }

  lines.push('---');
  lines.push('Apply as a separate human-reviewed change per Rule 5 (grader immutability).');

  return lines.join('\n');
}

async function registerRegressionFixture(profileName: string, fixtureManifest: any): Promise<void> {
  const artifact = {
    artifactId: `regression-fixture-${profileName}`,
    kind: 'regression-fixture' as const,
    content: {
      profileName,
      fixtureManifest,
      registeredAt: new Date().toISOString(),
    },
    version: 1,
    createdAt: Date.now(),
    createdBy: 'observe-promote' as const,
    immutableByAgent: true,
    contentHash: '',
    derivationChain: [],
  };

  const { createHash } = await import('crypto');
  artifact.contentHash = createHash('sha256').update(JSON.stringify(artifact.content)).digest('hex');

  governanceArtifactRegistry.register(artifact);

  logger.info('Regression fixture registered', { profileName });
}