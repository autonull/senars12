import {Ground, grounded} from '../src/index.js';
import {describe, expect, test} from '@jest/globals';

describe('ReflectionOps', () => {
    const ground = new Ground();

    test('&js-new and &js-call', async () => {
        // Create a new Map
        const mapAtom = ground.execute('&js-new', grounded(Map));
        expect(mapAtom.type).toBe('grounded');
        expect(mapAtom.value).toBeInstanceOf(Map);

        // Call set
        ground.execute('&js-call', mapAtom, grounded('set'), grounded('key1'), grounded('value1'));

        // Call get
        const val = await ground.execute('&js-call', mapAtom, grounded('get'), grounded('key1'));
        expect(val.name !== undefined ? val.name : val.value).toBe('value1');
    });

    test('&js-get and &js-set', () => {
        const obj = {foo: 'bar'};
        const objAtom = grounded(obj);

        const val = ground.execute('&js-get', objAtom, grounded('foo'));
        expect(val.name !== undefined ? val.name : val.value).toBe('bar');

        ground.execute('&js-set', objAtom, grounded('foo'), grounded('baz'));
        const val2 = ground.execute('&js-get', objAtom, grounded('foo'));
        expect(val2.name !== undefined ? val2.name : val2.value).toBe('baz');
        expect(obj.foo).toBe('baz');
    });

    test('&js-type', () => {
        const objAtom = grounded(123);
        const typeAtom = ground.execute('&js-type', objAtom);
        expect(typeAtom.name).toBe('number');
    });

    test('&js-call with property access path', async () => {
        const obj = {
            nested: {
                method: (x) => x * 2
            }
        };
        const objAtom = grounded(obj);

        // Call nested.method(21)
        const result = await ground.execute('&js-call', objAtom, grounded('nested.method'), grounded(21));
        expect(result.name !== undefined ? Number(result.name) : result.value).toBe(42);
    });

    test('&js-import', async () => {
        // Import 'path' module
        const pathModAtom = await ground.execute('&js-import', grounded('path'));
        expect(pathModAtom.type).toBe('grounded');

        // Check if we can access exports
        const sepAtom = ground.execute('&js-get', pathModAtom, grounded('sep'));
        expect(typeof (sepAtom.name !== undefined ? sepAtom.name : sepAtom.value)).toBe('string');

        const joinAtom = ground.execute('&js-get', pathModAtom, grounded('join'));
        expect(typeof joinAtom.value).toBe('function');
    });

    test('Integration: Reflection with SymbolicTensor', async () => {
        // Import SymbolicTensor from tensor package
        // Note: Dynamic import path relative to ReflectionOps.js location (metta/src/kernel/ops/)
        // ../../../../tensor/src/index.js
        const tensorModAtom = await ground.execute('&js-import', grounded('../../../../tensor/src/index.js'));
        const SymbolicTensorAtom = ground.execute('&js-get', tensorModAtom, grounded('SymbolicTensor'));

        // Create SymbolicTensor instance
        const data = new Float32Array([1, 2, 3, 4]);
        const shape = [2, 2];
        const tensorAtom = ground.execute('&js-new', SymbolicTensorAtom, grounded(data), grounded(shape));

        expect(tensorAtom.type).toBe('grounded');
        expect(tensorAtom.value.shape).toEqual([2, 2]);

        // Annotate using method call
        // tensor.annotate([0, 0], 'zero')
        ground.execute('&js-call', tensorAtom, grounded('annotate'), grounded([0, 0]), grounded('zero'));

        const annotation = tensorAtom.value.getAnnotation([0, 0]);
        expect(annotation.symbol).toBe('zero');
    });
});
