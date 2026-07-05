/**
 * SerializationUtils Tests
 */

import {describe, expect, it} from '@jest/globals';
import {safeDeserialize, safeSerialize, Serializable} from '@senars/core/src/util/SerializationUtils';

describe('SerializationUtils', () => {
    describe('safeSerialize', () => {
        it('should serialize objects with serialize method', () => {
            const obj = {
                name: 'test',
                serialize: () => ({name: 'test', serialized: true})
            };
            const result = safeSerialize(obj);
            expect(result).toEqual({name: 'test', serialized: true});
        });

        it('should return null for null input', () => {
            expect(safeSerialize(null)).toBeNull();
        });

        it('should return null for undefined input', () => {
            expect(safeSerialize(undefined)).toBeNull();
        });

        it('should use toString as fallback', () => {
            const obj = {name: 'test', toString: () => '[object Test]'};
            const result = safeSerialize(obj);
            expect(result).toBe('[object Test]');
        });

        it('should use custom fallback', () => {
            const obj = {name: 'test'};
            const result = safeSerialize(obj, (o) => o.name);
            expect(result).toBe('test');
        });

        it('should handle errors in serialize method', () => {
            const obj = {
                serialize: () => {
                    throw new Error('Serialization failed');
                }
            };
            expect(() => safeSerialize(obj)).toThrow();
        });
    });

    describe('safeDeserialize', () => {
        it('should deserialize with custom deserializer', async () => {
            const data = {name: 'test', value: 42};
            const deserializer = async (d) => ({...d, deserialized: true});
            const result = await safeDeserialize(data, deserializer, 'test');
            expect(result).toEqual({name: 'test', value: 42, deserialized: true});
        });

        it('should return null for null data', async () => {
            const result = await safeDeserialize(null, async (d) => d);
            expect(result).toBeNull();
        });

        it('should return data if no deserializer', async () => {
            const data = {name: 'test'};
            const result = await safeDeserialize(data);
            expect(result).toBe(data);
        });

        it('should handle deserializer errors', async () => {
            const data = {name: 'test'};
            const deserializer = async () => {
                throw new Error('Failed');
            };
            const result = await safeDeserialize(data, deserializer, 'test');
            expect(result).toBeNull();
        });
    });

    describe('Serializable', () => {
        describe('serializeWithVersion', () => {
            it('should serialize with version field', () => {
                const data = {id: 1, name: 'test'};
                const result = Serializable.serializeWithVersion(data);
                expect(result).toEqual({id: 1, name: 'test', version: '1.0.0'});
            });

            it('should use custom version', () => {
                const data = {id: 1};
                const result = Serializable.serializeWithVersion(data, '2.0.0');
                expect(result.version).toBe('2.0.0');
            });
        });

        describe('createSerializer', () => {
            it('should create serialized wrapper', () => {
                const obj = {id: 1};
                const serializer = (o) => ({id: o.id, serialized: true});
                const result = Serializable.createSerializer(obj, serializer);
                expect(result).toEqual({id: 1, serialized: true, version: '1.0.0'});
            });
        });

        describe('standardDeserialize', () => {
            it('should return false for null data', async () => {
                // Re-import to ensure clean module reference
                const {Serializable: LocalSerializable} = await import('@senars/core/src/util/SerializationUtils');
                const result = await LocalSerializable.standardDeserialize(null, async () => {});
                expect(result).toBe(false);
            });
        });
    });
});
