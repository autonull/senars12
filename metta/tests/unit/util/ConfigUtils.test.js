/**
 * ConfigUtils Tests
 */

import {describe, expect, it} from '@jest/globals';
import {ConfigManager, mergeConfig} from '@senars/core';

describe('Config', () => {
    describe('mergeConfig', () => {
        it('should merge user config with defaults', () => {
            const defaults = {a: 1, b: 2};
            const user = {b: 3, c: 4};
            const result = mergeConfig(defaults, user, {freeze: false});
            expect(result).toEqual({a: 1, b: 3, c: 4});
        });

        it('should handle empty user config', () => {
            const defaults = {a: 1, b: 2};
            const result = mergeConfig(defaults, {}, {freeze: false});
            expect(result).toEqual({a: 1, b: 2});
        });

        it('should handle null user config', () => {
            const defaults = {a: 1};
            const result = mergeConfig(defaults, null, {freeze: false});
            expect(result).toEqual({a: 1});
        });

        it('should handle undefined user config', () => {
            const defaults = {a: 1};
            const result = mergeConfig(defaults, undefined, {freeze: false});
            expect(result).toEqual({a: 1});
        });

        it('should freeze by default', () => {
            const defaults = {a: 1};
            const result = mergeConfig(defaults, {b: 2});
            expect(Object.isFrozen(result)).toBe(true);
        });

        it('should throw on invalid defaults', () => {
            expect(() => mergeConfig(null, {})).toThrow();
            expect(() => mergeConfig('string', {})).toThrow();
        });
    });

    describe('ConfigManager', () => {
        it('should create instance with default config', () => {
            const defaultConfig = {a: 1, b: 2};
            const manager = new ConfigManager(defaultConfig);
            expect(manager.defaults).toEqual(defaultConfig);
        });

        it('should create instance with empty config', () => {
            const manager = new ConfigManager();
            expect(manager.defaults).toEqual({});
        });

        describe('config getter', () => {
            it('should return copy of current config', () => {
                const manager = new ConfigManager({a: 1});
                const config = manager.config;
                expect(config).toEqual({a: 1});
                config.a = 999;
                expect(manager.config.a).toBe(1);
            });
        });

        describe('update', () => {
            it('should update config values', () => {
                const manager = new ConfigManager({a: 1});
                manager.update({b: 2});
                expect(manager.config).toEqual({a: 1, b: 2});
            });

            it('should override existing values', () => {
                const manager = new ConfigManager({a: 1});
                manager.update({a: 10});
                expect(manager.config.a).toBe(10);
            });

            it('should return this for chaining', () => {
                const manager = new ConfigManager();
                const result = manager.update({a: 1});
                expect(result).toBe(manager);
            });
        });

        describe('get', () => {
            it('should get config value', () => {
                const manager = new ConfigManager({a: 1});
                expect(manager.get('a')).toBe(1);
            });

            it('should return undefined for missing key', () => {
                const manager = new ConfigManager();
                expect(manager.get('missing')).toBeUndefined();
            });

            it('should return fallback for missing key', () => {
                const manager = new ConfigManager();
                expect(manager.get('missing', 'default')).toBe('default');
            });
        });

        describe('set', () => {
            it('should set config value', () => {
                const manager = new ConfigManager();
                manager.set('a', 1);
                expect(manager.config.a).toBe(1);
            });

            it('should return this for chaining', () => {
                const manager = new ConfigManager();
                const result = manager.set('a', 1);
                expect(result).toBe(manager);
            });
        });

        describe('reset', () => {
            it('should reset to default config', () => {
                const defaultConfig = {a: 1};
                const manager = new ConfigManager(defaultConfig);
                manager.update({b: 2});
                manager.reset();
                expect(manager.config).toEqual(defaultConfig);
            });
        });
    });
});
