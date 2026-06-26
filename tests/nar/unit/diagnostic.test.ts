/**
 * Diagnostic tests for tracing derivation root causes
 *
 * These tests verify correct behavior of:
 * - Tautology detection and rejection
 * - Revision vs new derivation reporting
 * - Query answer accuracy
 * - Input validation
 */

import {beforeEach, describe, expect, it} from '@jest/globals';
import {NAR} from '../../../src/nar/index.js';
import {isTautology, termParser, validateTaskTerm} from '../../../src/nar/terms/index.js';

describe('Diagnostic: Tautology Detection', () => {
    it('should detect self-inheritance as tautology', () => {
        const term = termParser.parse('<x --> x>');
        expect(isTautology(term)).toBe(true);
    });

    it('should detect self-similarity as tautology', () => {
        const term = termParser.parse('<x <-> x>');
        expect(isTautology(term)).toBe(true);
    });

    it('should not detect normal inheritance as tautology', () => {
        const term = termParser.parse('<cat --> animal>');
        expect(isTautology(term)).toBe(false);
    });

    it('should reject tautology as invalid task term', () => {
        const term = termParser.parse('<x --> x>');
        const result = validateTaskTerm(term);
        expect(result.valid).toBe(false);
        expect((result as any).reason).toContain('Tautology');
    });

    it('should reject TRUE as invalid task term', () => {
        const term = termParser.parse('TRUE');
        const result = validateTaskTerm(term);
        expect(result.valid).toBe(false);
    });

    it('should reject FALSE as invalid task term', () => {
        const term = termParser.parse('FALSE');
        const result = validateTaskTerm(term);
        expect(result.valid).toBe(false);
    });

    it('should accept normal terms', () => {
        const term = termParser.parse('<cat --> animal>');
        const result = validateTaskTerm(term);
        expect(result.valid).toBe(true);
    });
});

describe('Diagnostic: NAR Tautology Rejection', () => {
    let nar: NAR;

    beforeEach(() => {
        nar = new NAR();
    });

    it('should not add tautology to memory', async () => {
        const before = nar.memory.listConcepts().length;
        await nar.believe('<x --> x>.');
        await nar.run(1);
        const after = nar.memory.listConcepts().length;
        expect(after).toBe(before);
    });

    it('should not derive from tautology input', async () => {
        await nar.believe('<x --> x>.');
        const derived = await nar.run(3);
        expect(derived).toBe(0);
    });
});

describe('Diagnostic: Revision vs New Derivation', () => {
    let nar: NAR;

    beforeEach(() => {
        nar = new NAR();
    });

    it('should not report same-term revision as new derivation', async () => {
        await nar.believe('<a --> b>.');
        await nar.run(1);

        const beliefsBefore = nar.getBeliefs().map(b => b.term.toString());
        await nar.believe('<a --> b>.');
        await nar.run(1);
        const beliefsAfter = nar.getBeliefs().map(b => b.term.toString());

        const newTerms = beliefsAfter.filter(t => !beliefsBefore.includes(t));
        expect(newTerms.length).toBe(0);
    });

    it('should revise truth values for duplicate input', async () => {
        await nar.believe('<a --> b>.');
        await nar.run(1);
        const belief1 = nar.getBeliefs().find(b => b.term.toString() === '(a --> b)');

        await nar.believe('<a --> b>.');
        await nar.run(1);
        const belief2 = nar.getBeliefs().find(b => b.term.toString() === '(a --> b)');

        expect(belief2).toBeDefined();
        expect(belief2?.truth?.c).toBeGreaterThanOrEqual(belief1?.truth?.c ?? 0);
    });
});

describe('Diagnostic: Query Answer Accuracy', () => {
    let nar: NAR;

    beforeEach(() => {
        nar = new NAR();
    });

    it('should return exact match for queried term', async () => {
        await nar.believe('<cat --> animal>.');
        await nar.run(1);

        const answer = await nar.query.ask('<cat --> animal>');
        expect(answer.answer).toBe('(cat --> animal)');
        expect(answer.confidence).toBeGreaterThan(0);
    });

    it('should return exact match after multiple queries', async () => {
        await nar.believe('<cat --> animal>.');
        await nar.believe('<dog --> animal>.');
        await nar.run(3);

        await nar.question('<cat --> animal>?');
        await nar.run(5);

        await nar.question('<dog --> animal>?');
        await nar.run(5);

        const answer = await nar.query.ask('<dog --> animal>');
        expect(answer.answer).toBe('(dog --> animal)');
    });

    it('should prefer exact match over similar concepts', async () => {
        await nar.believe('<cat --> animal>.');
        await nar.believe('<dog --> animal>.');
        await nar.run(3);

        const answer = await nar.query.ask('<dog --> animal>');
        expect(answer.answer).toBe('(dog --> animal)');
    });
});

describe('Diagnostic: Derivation Chain Integrity', () => {
    let nar: NAR;

    beforeEach(() => {
        nar = new NAR();
    });

    it('should derive transitive inheritance', async () => {
        await nar.believe('<cat --> animal>.');
        await nar.believe('<animal --> mammal>.');
        await nar.run(5);

        const derived = nar.getBeliefs().map(b => b.term.toString());
        expect(derived).toContain('(cat --> mammal)');
    });

    it('should not produce duplicate terms after multiple runs', async () => {
        await nar.believe('<a --> b>.');
        await nar.believe('<b --> c>.');
        await nar.run(5);

        const terms = nar.getBeliefs().map(b => b.term.toString());
        const uniqueTerms = new Set(terms);
        expect(terms.length).toBe(uniqueTerms.size);
    });
});

describe('[Phase 1] Operation Operator Misuse', () => {
    let nar: NAR;

    beforeEach(() => {
        nar = new NAR();
    });

    it('should not produce ^ operator from pure declarative input', async () => {
        await nar.believe('<cat --> animal>.');
        await nar.run(5);

        const beliefs = nar.getBeliefs().map(b => b.term.toString());
        const hasOperation = beliefs.some(b => b.includes('^'));
        expect(hasOperation).toBe(false);
    });

    it('should not produce ^ operator from transitive chain', async () => {
        await nar.believe('<cat --> animal>.');
        await nar.believe('<animal --> mammal>.');
        await nar.run(5);

        const beliefs = nar.getBeliefs().map(b => b.term.toString());
        const hasOperation = beliefs.some(b => b.includes('^'));
        expect(hasOperation).toBe(false);
    });

    it('disabled operation rules return undefined', async () => {
        const {NALExtendedRules, TermBuilder} = await import('../../../src/nar/index.js');
        const {atom, inheritance} = TermBuilder;
        expect(NALExtendedRules.operationExecution).toBeUndefined();
        expect(NALExtendedRules.goalExecution).toBeUndefined();
        expect(NALExtendedRules.strategyEffectiveness).toBeUndefined();
        expect(NALExtendedRules.resourceAllocation).toBeUndefined();
        expect(NALExtendedRules.utilityEstimation).toBeUndefined();
    });
});

describe('[Phase 1] Spurious Derivations', () => {
    let nar: NAR;

    beforeEach(() => {
        nar = new NAR();
    });

    it('should produce limited derivations from single belief', async () => {
        await nar.believe('<dog --> animal>.');
        const derived = await nar.run(3);
        expect(derived).toBeLessThanOrEqual(5);
    });

    it('should not derive unrelated concepts from single input', async () => {
        await nar.believe('<cat --> animal>.');
        await nar.run(3);

        const beliefs = nar.getBeliefs().map(b => b.term.toString());
        const unrelatedTerms = ['allocate', 'utility', 'meta', 'self', 'model'];
        const hasUnrelated = unrelatedTerms.some(t => beliefs.some(b => b.includes(t)));
        expect(hasUnrelated).toBe(false);
    });
});

describe('[Phase 3] Premise Selection', () => {
    let nar: NAR;

    beforeEach(() => {
        nar = new NAR();
    });

    it('should select premises with shared atomic terms', async () => {
        await nar.believe('<cat --> animal>.');
        await nar.believe('<dog --> animal>.');
        await nar.believe('<car --> vehicle>.');
        await nar.run(3);

        const beliefs = nar.getBeliefs().map(b => b.term.toString());
        expect(beliefs.some(b => b.includes('cat') && b.includes('animal'))).toBe(true);
    });

    it('should filter low-priority secondary premises', async () => {
        await nar.believe('<a --> b>.');
        await nar.run(1);

        const beliefs = nar.getBeliefs();
        const lowPriority = beliefs.filter(b => b.budget.priority < 0.05);
        expect(lowPriority.length).toBe(0);
    });

    it('should not derive from completely unrelated concepts', async () => {
        await nar.believe('<cat --> animal>.');
        await nar.believe('<planet --> orbit>.');
        await nar.run(3);

        const beliefs = nar.getBeliefs().map(b => b.term.toString());
        const crossDerived = beliefs.some(b =>
            (b.includes('cat') && b.includes('planet')) ||
            (b.includes('animal') && b.includes('orbit'))
        );
        expect(crossDerived).toBe(false);
    });
});
