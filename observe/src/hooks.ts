import type { Manifest, Verdict, Finding, CheckResult } from './schema.js';
import type { ObserveProgram } from './programs.js';
import { createLogger } from '@senars/util/logger';

const logger = createLogger({ scope: 'ObserveHooks' });

export interface FailureBundle {
  runId: string;
  program: ObserveProgram;
  manifest: Manifest;
  verdict: Verdict;
  checks: CheckResult[];
  timestamp: number;
}

export type FailureHook = (bundle: FailureBundle) => Promise<void> | void;

const hooks: FailureHook[] = [];

export function registerFailureHook(hook: FailureHook): void {
  hooks.push(hook);
}

export async function runFailureHooks(bundle: FailureBundle): Promise<void> {
  if (hooks.length === 0) return;
  
  logger.info('Running failure hooks', { runId: bundle.runId, hooks: hooks.length });
  
  await Promise.allSettled(
    hooks.map(async (hook) => {
      try {
        await hook(bundle);
      } catch (error) {
        logger.error('Failure hook error', { error, runId: bundle.runId });
      }
    })
  );
}

export function createFailureBundle(
  runId: string,
  program: ObserveProgram,
  manifest: Manifest,
  verdict: Verdict,
  checks: CheckResult[]
): FailureBundle {
  return {
    runId,
    program,
    manifest,
    verdict,
    checks,
    timestamp: Date.now(),
  };
}

export function hasActionableFindings(verdict: Verdict, checks: CheckResult[]): boolean {
  const hasWarnOrFailFindings = verdict.findings.some(
    (f) => f.severity === 'warn' || f.severity === 'fail'
  );
  const hasFailedChecks = checks.some((c) => !c.passed);
  return hasWarnOrFailFindings || hasFailedChecks;
}