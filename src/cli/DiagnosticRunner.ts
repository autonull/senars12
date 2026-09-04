/**
 * REPL Experimentation Commands for AI-driven debugging and tuning
 * Enables iterative exploration of reasoning system capabilities
 */

import type { NAR, Task } from '../../nar/src';
import { ReasoningTrace } from '../../nar/src/query';
import { extractSymbols, mentionsSymbol, termParser, termsEqual } from '../../nar/src/terms';
import { errMsg } from '../../nar/src/utils';

export interface ExperimentResult {
  input: string;
  derivations: string[];
  newBeliefs: string[];
  duration: number;
  cycles: number;
  errors: string[];
}

export interface DiagnosticReport {
  operationMisuse: boolean;
  spuriousDerivations: number;
  premiseRelevance: number;
  confidenceDistribution: { low: number; medium: number; high: number };
}

export class ExperimentRunner {
  constructor(private nar: NAR) {}

  async runExperiment(input: string, cycles = 3): Promise<ExperimentResult> {
    const startTime = Date.now();
    const errors: string[] = [];

    try {
      await this.nar.input(input);
      const derived = await this.nar.run(cycles);
      const beliefs = this.nar.getBeliefs();

      return {
        input,
        derivations: beliefs.filter((b) => b.derived).map((b) => b.term.toString()),
        newBeliefs: beliefs.map((b) => b.term.toString()),
        duration: Date.now() - startTime,
        cycles: derived,
        errors,
      };
    } catch (error) {
      errors.push(errMsg(error));
      return {
        input,
        derivations: [],
        newBeliefs: [],
        duration: Date.now() - startTime,
        cycles: 0,
        errors,
      };
    }
  }

  async runDiagnostic(input: string): Promise<DiagnosticReport> {
    this.nar.clearMemory();
    await this.nar.input(input);
    await this.nar.run(5);

    const beliefs = this.nar.getBeliefs();

    const operationMisuse = beliefs.some(
      (b) => mentionsSymbol(b.term, '^') && b.term.kind === 'inheritance'
    );

    const spuriousDerivations = beliefs.filter((b) => {
      const str = b.term.toString();
      return (
        str.includes('allocate') ||
        str.includes('utility') ||
        str.includes('meta') ||
        str.includes('self')
      );
    }).length;

    const inputTerm = termParser.parse(input.replace(/[.?!.:]+$/, '').trim());
    const relevantCount = beliefs.filter((b) => {
      if (!inputTerm) return false;
      const atoms1 = extractSymbols(b.term);
      const atoms2 = extractSymbols(inputTerm);
      for (const a of atoms1) {
        if (atoms2.has(a)) return true;
      }
      return false;
    }).length;

    const premiseRelevance = relevantCount / Math.max(beliefs.length, 1);

    const confidences = beliefs.map((b) => b.truth?.c ?? 0.5);
    const confidenceDistribution = {
      low: confidences.filter((c) => c < 0.3).length,
      medium: confidences.filter((c) => c >= 0.3 && c < 0.7).length,
      high: confidences.filter((c) => c >= 0.7).length,
    };

    return {
      operationMisuse,
      spuriousDerivations,
      premiseRelevance,
      confidenceDistribution,
    };
  }

  getTrace(term: string): string[] {
    try {
      const parsed = termParser.parse(term);
      const trace = new ReasoningTrace(this.nar.memory);
      const result = trace.trace(parsed);
      return result.history.map((h) => h.term.toString());
    } catch {
      return [];
    }
  }

  explain(term: string): string {
    try {
      const parsed = termParser.parse(term);
      const trace = new ReasoningTrace(this.nar.memory);
      const belief = this.nar.getBeliefs().find((b) => termsEqual(b.term, parsed));
      if (!belief) return `No belief found for: ${term}`;

      const result = trace.explain(belief as Task);
      return result.why;
    } catch (error) {
      return `Error: ${errMsg(error)}`;
    }
  }
}

export function formatExperimentResult(result: ExperimentResult, verbose = false): string {
  const lines: string[] = [];

  lines.push(`Input: ${result.input}`);
  lines.push(`Duration: ${result.duration}ms, Cycles: ${result.cycles}`);

  if (result.errors.length > 0) {
    lines.push(`Errors: ${result.errors.join(', ')}`);
  }

  if (verbose) {
    lines.push(`Derivations (${result.derivations.length}):`);
    result.derivations.forEach((d) => lines.push(`  ${d}`));
  }

  lines.push(`Beliefs (${result.newBeliefs.length}):`);
  result.newBeliefs.forEach((b) => lines.push(`  ${b}`));

  return lines.join('\n');
}

export function formatDiagnosticReport(report: DiagnosticReport): string {
  const lines: string[] = [];

  lines.push('Diagnostic Report:');
  lines.push(`  Operation Misuse: ${report.operationMisuse ? '❌ DETECTED' : '✅ None'}`);
  lines.push(`  Spurious Derivations: ${report.spuriousDerivations}`);
  lines.push(`  Premise Relevance: ${(report.premiseRelevance * 100).toFixed(1)}%`);
  lines.push('  Confidence Distribution:');
  lines.push(`    Low (<0.3): ${report.confidenceDistribution.low}`);
  lines.push(`    Medium (0.3-0.7): ${report.confidenceDistribution.medium}`);
  lines.push(`    High (>0.7): ${report.confidenceDistribution.high}`);

  return lines.join('\n');
}
