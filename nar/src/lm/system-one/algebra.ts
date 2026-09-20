import type { JudgmentQuery, SynthesisQuery } from './types.js';

export class AlgebraPurityError extends Error {
  public readonly queryKind: string;

  constructor(message: string, queryKind: string) {
    super(message);
    this.name = 'AlgebraPurityError';
    this.queryKind = queryKind;
  }
}

function isSynthesisQueryInternal(query: JudgmentQuery | SynthesisQuery): query is SynthesisQuery {
  return (query as SynthesisQuery).kind === 'synthesize';
}

export function assertJudgmentQuery(query: JudgmentQuery | SynthesisQuery): asserts query is JudgmentQuery {
  if (isSynthesisQueryInternal(query)) {
    throw new AlgebraPurityError(
      'SynthesisQuery passed where JudgmentQuery required — algebra purity violation',
      'synthesize'
    );
  }
}

export function isJudgmentQuery(query: JudgmentQuery | SynthesisQuery): query is JudgmentQuery {
  return !isSynthesisQueryInternal(query);
}

export function isSynthesisQuery(query: JudgmentQuery | SynthesisQuery): query is SynthesisQuery {
  return isSynthesisQueryInternal(query);
}

export function validateBatchQueries(queries: readonly (JudgmentQuery | SynthesisQuery)[]): JudgmentQuery[] {
  for (const q of queries) {
    assertJudgmentQuery(q);
  }
  return queries as JudgmentQuery[];
}