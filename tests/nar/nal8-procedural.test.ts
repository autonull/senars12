import {describe, expect, test} from '@jest/globals';
import {NALExtendedRules, TermBuilder} from '../../src/nar';

describe('NAL8 Procedural Rules', () => {
    const {inheritance, sequence, operation, predictive: _predictive, atom} = TermBuilder;

    // DISABLED: BOT7 §1.1 — operationExecution produces ^ in inheritance predicates
    describe('operationExecution', () => {
        test('is disabled to prevent operation misuse', () => {
            expect(NALExtendedRules.operationExecution).toBeUndefined();
        });
    });

    // DISABLED: BOT7 §1.1 — goalExecution conflates goals with inheritance
    describe('goalExecution', () => {
        test('is disabled to prevent goal conflation', () => {
            expect(NALExtendedRules.goalExecution).toBeUndefined();
        });
    });

    describe('proceduralDecomposition', () => {
        test('decomposes sequence with operation', () => {
            const a = atom('a');
            const b = atom('b');
            const c = atom('c');
            const seq = sequence(a, b);
            const op = operation(b, c);

            const result = NALExtendedRules.proceduralDecomposition([seq, op]);

            expect(result).toBeDefined();
            expect(result?.toString()).toBe('(a ,/ (b ^ c))');
        });

        test('returns undefined for non-sequence', () => {
            const a = atom('a');
            const op = operation(atom('b'), atom('c'));

            const result = NALExtendedRules.proceduralDecomposition([a, op]);
            expect(result).toBeUndefined();
        });
    });

    describe('proceduralChaining', () => {
        test('chains operations when input matches', () => {
            const a = atom('a');
            const b = atom('b');
            const c = atom('c');
            const op1 = operation(a, b);
            const op2 = operation(b, c);

            const result = NALExtendedRules.proceduralChaining([op1, op2]);

            expect(result).toBeDefined();
            expect(result?.toString()).toBe('(a ,/ c)');
        });

        test('returns undefined when operations do not chain', () => {
            const a = atom('a');
            const b = atom('b');
            const c = atom('c');
            const d = atom('d');
            const op1 = operation(a, b);
            const op2 = operation(c, d);

            const result = NALExtendedRules.proceduralChaining([op1, op2]);
            expect(result).toBeUndefined();
        });
    });

    describe('operationToPredictive', () => {
        test('converts operation to predictive implication', () => {
            const a = atom('a');
            const b = atom('b');
            const op = operation(a, b);
            const seq = sequence(a, b);

            const result = NALExtendedRules.operationToPredictive([op, seq]);

            expect(result).toBeDefined();
            expect(result?.toString()).toBe('(a /> b)');
        });

        test('returns undefined when operation and sequence do not match', () => {
            const a = atom('a');
            const b = atom('b');
            const c = atom('c');
            const op = operation(a, b);
            const seq = sequence(a, c);

            const result = NALExtendedRules.operationToPredictive([op, seq]);
            expect(result).toBeUndefined();
        });
    });

    describe('procedural term creation', () => {
        test('creates operation terms', () => {
            const op = atom('op');
            const input = atom('input');
            const operationTerm = operation(op, input);

            expect(operationTerm.toString()).toBe('(op ^ input)');
        });

        test('handles f(x) syntax as (f ^ (x))', () => {
            const f = atom('f');
            const x = atom('x');
            const fx = operation(f, x);

            expect(fx.toString()).toBe('(f ^ x)');
        });

        test('handles undefined input gracefully', () => {
            const op = operation(undefined!, undefined!);
            expect(op.toString()).toBe('TRUE');
        });
    });
});
