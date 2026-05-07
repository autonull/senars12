import { Stamp, MAX_DEPTH, getStampId, getStampSource } from '../../terms/stamp.js';

describe('Stamp', () => {
    describe('createInput', () => {
        test('creates stamp with INPUT source', () => {
            const stamp = Stamp.createInput();
            expect(stamp.source).toBe('INPUT');
            expect(stamp.depth).toBe(0);
            expect(stamp.derivations).toHaveLength(0);
            expect(stamp.id).toBeDefined();
            expect(stamp.creationTime).toBeDefined();
        });

        test('creates frozen stamp', () => {
            const stamp = Stamp.createInput();
            expect(Object.isFrozen(stamp)).toBe(true);
        });
    });

    describe('derive', () => {
        test('creates derived stamp within depth limit', () => {
            const parent = Stamp.createInput();
            const derived = Stamp.derive([parent], 'DERIVED');
            expect(derived).toBeDefined();
            expect(derived!.source).toBe('DERIVED');
            expect(derived!.depth).toBe(1);
            expect(derived!.derivations).toContain(parent.id);
        });

        test('returns undefined when parent at max depth', () => {
            const deepParent = { ...Stamp.createInput(), depth: MAX_DEPTH };
            const derived = Stamp.derive([deepParent]);
            expect(derived).toBeUndefined();
        });

        test('deduplicates derivations', () => {
            const parent1 = Stamp.createInput();
            const derived = Stamp.derive([parent1, parent1], 'DERIVED');
            expect(derived!.derivations).toHaveLength(1);
        });

        test('derives from multiple parents', () => {
            const p1 = Stamp.createInput();
            const p2 = Stamp.createInput();
            const derived = Stamp.derive([p1, p2]);
            expect(derived!.derivations).toContain(p1.id);
            expect(derived!.derivations).toContain(p2.id);
            expect(derived!.depth).toBe(1);
        });

        test('depth increases from max parent', () => {
            const deepParent = { ...Stamp.createInput(), depth: 5 };
            const derived = Stamp.derive([deepParent]);
            expect(derived!.depth).toBe(6);
        });

        test('handles empty parent array', () => {
            const derived = Stamp.derive([], 'DERIVED');
            expect(derived!.depth).toBe(0);
            expect(derived!.derivations).toHaveLength(0);
        });
    });

    describe('helpers', () => {
        test('getDepth returns stamp depth', () => {
            const stamp = Stamp.createInput();
            expect(Stamp.getDepth(stamp)).toBe(0);
        });

        test('getMaxDepth finds max depth', () => {
            const stamps = [
                Stamp.createInput(),
                { ...Stamp.createInput(), depth: 3 }
            ];
            expect(Stamp.getMaxDepth(stamps)).toBe(3);
        });

        test('canDerive checks depth', () => {
            const shallow = [Stamp.createInput()];
            expect(Stamp.canDerive(shallow)).toBe(true);

            const deepParent = { ...Stamp.createInput(), depth: MAX_DEPTH };
            expect(Stamp.canDerive([deepParent])).toBe(false);
        });

        test('getMaxDepth handles empty array', () => {
            expect(Stamp.getMaxDepth([])).toBe(0);
        });
    });

    describe('legacy exports', () => {
        test('getStampId extracts id', () => {
            const stamp = Stamp.createInput();
            expect(getStampId(stamp)).toBe(stamp.id);
        });

        test('getStampSource extracts source', () => {
            const stamp = Stamp.createInput();
            expect(getStampSource(stamp)).toBe('INPUT');
        });
    });
});