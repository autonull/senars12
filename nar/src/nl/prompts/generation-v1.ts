import { formatTruth, takeFirst } from '@senars/util';
// Type-only, so the pair stays acyclic at runtime: `generation.ts` imports this
// builder, and this borrows the belief/conflict shapes rather than spelling a
// second copy that a widened field would leave behind.
import type { BeliefInfo, ConflictInfo } from '../generation.js';

export function buildGenerationPrompt(opts: {
  query: string;
  beliefs: BeliefInfo[];
  conflicts: ConflictInfo[];
  derivationSteps?: number;
  reasoningType?: string;
  keyPremises?: string[];
  gaps?: string[];
  userProfile?: { expertise: string; verbosity: string };
}): string {
  const parts: string[] = [];

  parts.push('You are a neurosymbolic reasoning agent.');
  parts.push('Convert Narsese derivation results into clear natural language.');
  parts.push('');
  parts.push('Guidelines:');
  parts.push('  - Be precise about confidence levels');
  parts.push('  - Explain reasoning chain when steps > 2');
  parts.push('  - Flag contradictions clearly');
  parts.push('  - Suggest what additional evidence would strengthen the answer');
  parts.push('  - Adapt verbosity to user expertise');

  if (opts.userProfile) {
    parts.push(
      `\nUser profile: expertise=${opts.userProfile.expertise}, verbosity=${opts.userProfile.verbosity}`
    );
  }

  if (opts.beliefs.length > 0) {
    parts.push('\nDerived beliefs:');
    for (const b of takeFirst(opts.beliefs, 10)) {
      const truth = b.truth ? ` ${formatTruth(b.truth)}` : '';
      parts.push(`  ${b.term}${truth}`);
    }
  }

  if (opts.conflicts.length > 0) {
    parts.push('\nConflicts detected:');
    for (const c of opts.conflicts) {
      parts.push(`  ${c.belief.term} conflicts with ${c.conflictWith.term} (type: ${c.type})`);
    }
  }

  if (opts.reasoningType) {
    parts.push(`\nReasoning type: ${opts.reasoningType}`);
  }

  if (opts.keyPremises?.length) {
    parts.push(`Key premises: ${opts.keyPremises.join(', ')}`);
  }

  if (opts.gaps?.length) {
    parts.push(`Knowledge gaps: ${opts.gaps.join(', ')}`);
  }

  parts.push(`\nUser asked: "${opts.query}"`);
  parts.push('\nProvide a natural language response.');

  return parts.join('\n');
}
