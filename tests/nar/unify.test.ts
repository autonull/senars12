import {TermBuilder, termsEqual, unify} from '../../src/nar/terms';

test('unify binds variable and enforces consistency', () => {
    const A = TermBuilder.atom('A');
    const B = TermBuilder.atom('B');
    const x = TermBuilder.atom('$x');

    const s1 = unify(x, A);
    expect(s1).toBeDefined();
    if (!s1) return;
    const binding = s1['$x'];
    expect(binding).toBeDefined();
    if (binding) {
        expect(termsEqual(binding, A)).toBe(true);
    }

    const s2 = unify(x, A, s1);
    expect(s2).toBeDefined();

    const s3 = unify(x, B, s1);
    expect(s3).toBeUndefined();
});
