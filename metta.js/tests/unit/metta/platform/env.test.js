/**
 * Unit tests for environment detection module
 */

import {ENV, getEnvironment, requireEnvironment} from '../../../../metta/src/platform/env.js';

describe('Environment Detection', () => {
    describe('ENV flags', () => {
        test('should detect Node.js environment', () => {
            expect(ENV.isNode).toBeTruthy(); // Returns version string, not boolean
            expect(ENV.hasFileSystem).toBeTruthy();
        });

        test('should not detect browser environment in Node.js', () => {
            expect(ENV.isBrowser).toBe(false);
            expect(ENV.isWorker).toBe(false);
        });

        test('should have consistent environment flags', () => {
            // In Node.js, these should be false
            expect(ENV.hasIndexedDB).toBe(false);
            expect(ENV.hasSharedArrayBuffer).toBeDefined();
        });
    });

    describe('getEnvironment()', () => {
        test('should return "node" in Node.js environment', () => {
            expect(getEnvironment()).toBe('node');
        });

        test('should return a valid environment string', () => {
            const env = getEnvironment();
            expect(['node', 'browser', 'worker', 'unknown']).toContain(env);
        });
    });

    describe('requireEnvironment()', () => {
        test('should not throw when requiring current environment', () => {
            expect(() => requireEnvironment('node')).not.toThrow();
        });

        test('should throw when requiring different environment', () => {
            expect(() => requireEnvironment('browser')).toThrow();
            expect(() => requireEnvironment('browser')).toThrow(/requires browser environment/);
        });

        test('should throw with descriptive error message', () => {
            try {
                requireEnvironment('worker');
                fail('Should have thrown');
            } catch (e) {
                expect(e.message).toContain('requires worker environment');
                expect(e.message).toContain('running in node');
            }
        });
    });
});
