import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { createLogger } from '@senars/util/logger';
import type { Manifest, Verdict, Finding, CheckResult } from './schema.js';
import type { ObserveProgram } from './programs.js';

const logger = createLogger({ scope: 'ObserveTour' });

export interface TourStep {
  markId: string;
  label: string;
  timestamp: number;
  narrative: string;
  evidence: string[];
  frameHash?: string;
}

export interface GeneratedTour {
  runId: string;
  programName: string;
  generatedAt: string;
  steps: TourStep[];
  summary: string;
}

export async function generateTour(runId: string): Promise<GeneratedTour> {
  const bundleDir = findBundle(runId);
  if (!bundleDir) {
    throw new Error(`Bundle not found: ${runId}`);
  }

  const [manifest, verdict, checks, marks, frames] = await Promise.all([
    readManifest(bundleDir),
    readVerdict(bundleDir),
    readChecks(bundleDir),
    readMarks(bundleDir),
    readFrames(bundleDir),
  ]);

  const program = manifest.program as ObserveProgram;
  const frameMap = new Map(frames.map((f) => [f.markId, f.hash]));

  const steps: TourStep[] = [];
  for (const mark of marks) {
    const findingsAtMark = verdict.findings.filter((f) => f.markId === mark.id);
    const checksAtMark = checks.filter((c) => c.expectationId === mark.id);
    
    const narrative = buildNarrative(mark, findingsAtMark, checksAtMark, program);
    const evidence = findingsAtMark.flatMap((f) => f.evidence.map((e) => e.description ?? e.id));
    
    steps.push({
      markId: mark.id,
      label: mark.label,
      timestamp: mark.t,
      narrative,
      evidence,
      frameHash: frameMap.get(mark.id),
    });
  }

  const summary = buildSummary(verdict, checks, steps.length);

  return {
    runId,
    programName: program.name,
    generatedAt: new Date().toISOString(),
    steps,
    summary,
  };
}

function buildNarrative(mark: any, findings: Finding[], checks: CheckResult[], program: ObserveProgram): string {
  const lines: string[] = [];
  
  lines.push(`At ${mark.label} (${mark.id}):`);
  
  if (findings.length > 0) {
    for (const finding of findings) {
      lines.push(`  ⚠ ${finding.kind} (${finding.severity}): ${finding.claim}`);
      if (finding.repairHint) lines.push(`     → Repair hint: ${finding.repairHint}`);
    }
  }
  
  const failedChecks = checks.filter((c) => !c.passed);
  if (failedChecks.length > 0) {
    for (const check of failedChecks) {
      lines.push(`  ❌ Check failed: ${check.details}`);
    }
  }
  
  if (findings.length === 0 && failedChecks.length === 0) {
    const criterion = program.success_criteria[mark.id as keyof typeof program.success_criteria];
    if (criterion) {
      lines.push(`  ✅ Success criterion met: ${mark.id}`);
    } else {
      lines.push(`  ✅ No issues detected`);
    }
  }
  
  return lines.join('\n');
}

function buildSummary(verdict: Verdict, checks: CheckResult[], stepCount: number): string {
  const passedChecks = checks.filter((c) => c.passed).length;
  const totalChecks = checks.length;
  const findingsBySeverity = verdict.findings.reduce((acc, f) => {
    acc[f.severity] = (acc[f.severity] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return `Tour for ${verdict.runId} (${verdict.overall}):
- ${stepCount} marks captured
- ${passedChecks}/${totalChecks} checks passed
- Findings: ${Object.entries(findingsBySeverity).map(([k, v]) => `${k}: ${v}`).join(', ') || 'none'}
- Overall: ${verdict.overall.toUpperCase()}`;
}

export async function saveTour(tour: GeneratedTour, outputPath?: string): Promise<string> {
  const path = outputPath || join(process.cwd(), 'generated', 'tours', `${tour.runId}-tour.json`);
  await fs.mkdir(join(path, '..'), { recursive: true });
  await fs.writeFile(path, JSON.stringify(tour, null, 2));
  return path;
}

export async function renderTourMarkdown(tour: GeneratedTour): Promise<string> {
  const lines: string[] = [];
  
  lines.push(`# Tour: ${tour.programName} (${tour.runId})`);
  lines.push(`*Generated: ${tour.generatedAt}*`);
  lines.push('');
  lines.push(tour.summary);
  lines.push('');
  lines.push('---');
  lines.push('');
  
  for (const step of tour.steps) {
    lines.push(`## ${step.label} (\`${step.markId}\`)`);
    lines.push(`*Timestamp: ${step.timestamp}*`);
    lines.push('');
    lines.push(step.narrative);
    lines.push('');
    
    if (step.evidence.length > 0) {
      lines.push('**Evidence:**');
      for (const ev of step.evidence) {
        lines.push(`- ${ev}`);
      }
      lines.push('');
    }
    
    if (step.frameHash) {
      lines.push(`*Frame: \`${step.frameHash}\`*`);
      lines.push('');
    }
    
    lines.push('---');
    lines.push('');
  }
  
  return lines.join('\n');
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

async function readManifest(bundleDir: string): Promise<Manifest> {
  return JSON.parse(await fs.readFile(join(bundleDir, 'manifest.json'), 'utf-8'));
}

async function readVerdict(bundleDir: string): Promise<Verdict> {
  return JSON.parse(await fs.readFile(join(bundleDir, 'verdict.json'), 'utf-8'));
}

async function readChecks(bundleDir: string): Promise<CheckResult[]> {
  return JSON.parse(await fs.readFile(join(bundleDir, 'checks.json'), 'utf-8').catch(() => '[]'));
}

async function readMarks(bundleDir: string): Promise<any[]> {
  const content = await fs.readFile(join(bundleDir, 'marks.jsonl'), 'utf-8').catch(() => '');
  return content.trim().split('\n').filter(Boolean).map((line) => JSON.parse(line));
}

async function readFrames(bundleDir: string): Promise<any[]> {
  return JSON.parse(await fs.readFile(join(bundleDir, 'frames.json'), 'utf-8').catch(() => '[]'));
}