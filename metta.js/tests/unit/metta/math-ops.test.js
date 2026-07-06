import {Ground} from '@senars/metta/src/kernel/Ground.js';
import {exp, sym} from '@senars/metta/src/kernel/Term.js';

describe('Ground.js - Math Operations', () => {
    let ground;

    beforeEach(() => {
        ground = new Ground();
    });

    describe('Transcendental functions', () => {
        test('pow-math calculates power', () => {
            const result = ground.execute('&pow-math', sym('2'), sym('8'));
            expect(result.name).toBe('256');
        });

        test('sqrt-math calculates square root', () => {
            const result = ground.execute('&sqrt-math', sym('16'));
            expect(result.name).toBe('4');
        });

        test('abs-math calculates absolute value', () => {
            expect(ground.execute('&abs-math', sym('-5')).name).toBe('5');
            expect(ground.execute('&abs-math', sym('5')).name).toBe('5');
        });

        test('log-math calculates logarithm', () => {
            const result = ground.execute('&log-math', sym('2'), sym('8'));
            expect(result.name).toBe('3');
        });
    });

    describe('Rounding functions', () => {
        test('trunc-math truncates decimal', () => {
            expect(ground.execute('&trunc-math', sym('3.7')).name).toBe('3');
            expect(ground.execute('&trunc-math', sym('-3.7')).name).toBe('-3');
        });

        test('ceil-math rounds up', () => {
            expect(ground.execute('&ceil-math', sym('3.2')).name).toBe('4');
        });

        test('floor-math rounds down', () => {
            expect(ground.execute('&floor-math', sym('3.7')).name).toBe('3');
        });

        test('round-math rounds to nearest', () => {
            expect(ground.execute('&round-math', sym('3.4')).name).toBe('3');
            expect(ground.execute('&round-math', sym('3.6')).name).toBe('4');
        });
    });

    describe('Trigonometric functions', () => {
        test('sin-math calculates sine', () => {
            const result = ground.execute('&sin-math', sym('0'));
            expect(parseFloat(result.name)).toBeCloseTo(0);
        });

        test('cos-math calculates cosine', () => {
            const result = ground.execute('&cos-math', sym('0'));
            expect(parseFloat(result.name)).toBeCloseTo(1);
        });

        test('tan-math calculates tangent', () => {
            const result = ground.execute('&tan-math', sym('0'));
            expect(parseFloat(result.name)).toBeCloseTo(0);
        });

        test('asin-math calculates arcsine', () => {
            const result = ground.execute('&asin-math', sym('0'));
            expect(parseFloat(result.name)).toBeCloseTo(0);
        });

        test('acos-math calculates arccosine', () => {
            const result = ground.execute('&acos-math', sym('1'));
            expect(parseFloat(result.name)).toBeCloseTo(0);
        });

        test('atan-math calculates arctangent', () => {
            const result = ground.execute('&atan-math', sym('0'));
            expect(parseFloat(result.name)).toBeCloseTo(0);
        });
    });

    describe('Validation functions', () => {
        test('isnan-math detects NaN', () => {
            expect(ground.execute('&isnan-math', sym('NaN')).name).toBe('True');
            expect(ground.execute('&isnan-math', sym('5')).name).toBe('False');
        });

        test('isinf-math detects infinity', () => {
            expect(ground.execute('&isinf-math', sym('Infinity')).name).toBe('True');
            expect(ground.execute('&isinf-math', sym('5')).name).toBe('False');
        });
    });

    describe('Aggregate functions', () => {
        test('min-atom finds minimum', () => {
            const list = exp(sym(':'), [sym('5'), exp(sym(':'), [sym('2'), exp(sym(':'), [sym('8'), sym('()')])])]);
            const result = ground.execute('&min-atom', list);
            expect(result.name).toBe('2');
        });

        test('max-atom finds maximum', () => {
            const list = exp(sym(':'), [sym('5'), exp(sym(':'), [sym('2'), exp(sym(':'), [sym('8'), sym('()')])])]);
            const result = ground.execute('&max-atom', list);
            expect(result.name).toBe('8');
        });

        test('sum-atom calculates sum', () => {
            const list = exp(sym(':'), [sym('5'), exp(sym(':'), [sym('2'), exp(sym(':'), [sym('3'), sym('()')])])]);
            const result = ground.execute('&sum-atom', list);
            expect(result.name).toBe('10');
        });

        test('handles empty list', () => {
            const result = ground.execute('&min-atom', sym('()'));
            expect(result.operator.name).toBe('Error');
        });
    });
});
