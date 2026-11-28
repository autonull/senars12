import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { getLogger } from './logger.js';
import { governanceArtifactRegistry } from '@senars/governance/artifacts';
import { hashContent } from './bundle.js';
import { generateId } from './schema.js';
import type { Manifest, Verdict, Finding } from './schema.js';
import type { ObserveProgram } from './programs.js';
import { findBundle, readBundle } from './bundle.js';

const logger = getLogger('ObservePromote');

export interface PromoteResult {
  fixturePath: string;
  profileName: string;
  hardeningSuggestion?: string;
  autoRegistered?: boolean;
}

export async function promoteRun(runId: string): Promise<PromoteResult> {
  const bundleDir = findBundle(runId);
  if (!bundleDir) {
    throw new Error(`Bundle not found: ${runId}`);
  }

  const data = await readBundle(bundleDir);
  const manifest = data.manifest!;
  const verdict = data.verdict!;
  const fixedVerdict = await findFixedVerdict(runId);

  const program = manifest.program as ObserveProgram;
  const clearedSignatures = findClearedSignatures(verdict, fixedVerdict);

  const fixtureId = generateId();
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

  // Auto-register in scenario-profiles.ts if enabled
  const autoRegistered = await autoRegisterScenarioProfile(profileName);

  logger.info('Run promoted to fixture', { runId, profileName, fixtureDir, clearedSignatures: clearedSignatures.length, autoRegistered });

  return {
    fixturePath: fixtureDir,
    profileName,
    hardeningSuggestion,
    autoRegistered,
  };
}

async function autoRegisterScenarioProfile(profileName: string): Promise<boolean> {
  try {
    const profilesPath = join(process.cwd(), 'src/tools/adapters/scenario-profiles.ts');
    const content = await fs.readFile(profilesPath, 'utf-8');
    
    // Check if already registered
    if (content.includes(`'${profileName}'`)) {
      logger.info('Profile already registered in scenario-profiles.ts', { profileName });
      return false;
    }
    
    // Find the SCENARIO_PROFILES array and add the new profile
    const lines = content.split('\n');
    const exportLineIndex = lines.findIndex((line: string) => line.trim().startsWith('export const SCENARIO_PROFILES = ['));
    
    if (exportLineIndex === -1) {
      logger.warn('Could not find SCENARIO_PROFILES export', { profilesPath });
      return false;
    }
    
    // Find the closing bracket
    let bracketCount = 0;
    let insertIndex = -1;
    for (let i = exportLineIndex; i < lines.length; i++) {
      bracketCount += (lines[i].match(/\[/g) || []).length;
      bracketCount -= (lines[i].match(/\]/g) || []).length;
      if (bracketCount === 0 && i > exportLineIndex) {
        insertIndex = i;
        break;
      }
    }
    
    if (insertIndex === -1) {
      logger.warn('Could not find end of SCENARIO_PROFILES array', { profilesPath });
      return false;
    }
    
    // Insert the new profile before the closing bracket
    const indent = lines[insertIndex].match(/^\s*/)?.[0] ?? '  ';
    lines.splice(insertIndex, 0, `${indent}  '${profileName}',`);
    
    await fs.writeFile(profilesPath, lines.join('\n'));
    
    logger.info('Auto-registered profile in scenario-profiles.ts', { profileName });
    return true;
  } catch (error) {
    logger.warn('Failed to auto-register scenario profile', { profileName, error });
    return false;
  }
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

  artifact.contentHash = hashContent(JSON.stringify(artifact.content));

  governanceArtifactRegistry.register(artifact);

  logger.info('Regression fixture registered', { profileName });
}