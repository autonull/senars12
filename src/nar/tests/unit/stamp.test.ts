import { Stamp, MAX_DEPTH } from '../../terms/stamp.js';

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
    });
});