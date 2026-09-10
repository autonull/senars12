import { describe, expect, it } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import { hydrateRecord } from '../../nar/src/rules/hydration.js';
import { Memory } from '../../nar/src/memory/memory.js';
import { termParser } from '../../nar/src/terms/index.js';
import { validateDerivationRecord } from '@senars/kernel/schemas';
import type { DerivationRecord } from '@senars/kernel/schemas';

const record = (conclusions: string[]): DerivationRecord => validateDerivationRecord({
    derivationId: uuidv4(), taskId: uuidv4(), goalTerm: '(a --> c)', timestamp: Date.now(), engine: 'nar',
    totalCycles: conclusions.length, maxDepthReached: 1,
    finalTruth: { frequency: 0.9, confidence: 0.8 },
    steps: conclusions.map((conclusion) => ({
        stepId: uuidv4(), ruleId: 'deduction', ruleCategory: 'logic',
        premises: ['(a --> b)', '(b --> c)'], conclusion,
        truth: { frequency: 0.9, confidence: 0.8 },
        premiseTruths: [{ frequency: 1, confidence: 0.9 }, { frequency: 1, confidence: 0.9 }],
        evidenceLineage: [], independence: 'independent',
    })),
});

describe('todo7: record hydration', () => {
  it('applies conclusions as beliefs; dedupes; skips unparseable', () => {
    const memory = new Memory({ maxConcepts: 100 } as never);
    const result = hydrateRecord(memory, record(['(a --> c)', '(a --> c)', '(((not a term']));
    expect(result.applied).toBe(1);
    expect(result.skipped).toBe(2);
    expect(memory.getConcept(termParser.parse('(a --> c)'))).toBeDefined();
  });
  it('empty record hydrates nothing', () => {
    const memory = new Memory({ maxConcepts: 100 } as never);
    const empty = { ...record([]), steps: [] };
    expect(hydrateRecord(memory, empty)).toEqual({ applied: 0, skipped: 0 });
  });
});
