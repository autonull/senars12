import {normalize, TermBuilder} from '../terms';
import {computeHash} from '../utils';

test('normalize sorts conjunction args and recomputes hash', () => {
    const a = TermBuilder.atom('A');
    const b = TermBuilder.atom('B');

    const badHash = computeHash('conjunction', [b.hash, a.hash]);
    const malformed: any = {kind: 'conjunction', args: [b, a], hash: badHash};

    expect(malformed.args[0].hash).toBeGreaterThan(malformed.args[1].hash);

    const normalized = normalize(malformed);
    expect((normalized as any).args[0].hash).toBeLessThanOrEqual((normalized as any).args[1].hash);

    const expectedHash = computeHash('conjunction', (normalized as any).args.map((t: any) => t.hash));
    expect(normalized.hash).toBe(expectedHash);
});
