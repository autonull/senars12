import {beforeEach, describe, expect, jest, test} from '@jest/globals';
import {Config, ConfigValidator, DEFAULT_CONFIG_CORE} from '@senars/core/src/config/Config.js';
import {BaseComponent} from '@senars/core/src/util/BaseComponent.js';
import {validateConfig, validateConfigWithDefaults} from '@senars/core/src/config/ConfigSchemas.js';

jest.unstable_mockModule('fs', () => ({
    default: {
        existsSync: jest.fn(),
        readFileSync: jest.fn(),
        writeFileSync: jest.fn(),
        mkdirSync: jest.fn(),
    },
    existsSync: jest.fn(),
    readFileSync: jest.fn(),
    writeFileSync: jest.fn(),
    mkdirSync: jest.fn(),
}));

let ConfigManager, DEFAULT_CONFIG;

beforeAll(async () => {
    const cm = await import('@senars/core/src/config/ConfigManager.js');
    ConfigManager = cm.ConfigManager;
    const cfg = await import('@senars/core/src/config/Config.js');
    DEFAULT_CONFIG = cfg.DEFAULT_CONFIG;
});

describe('Config', () => {
    describe('parse', () => {
        test('parses default arguments', () =>
            expect(Config.parse([])).toEqual(DEFAULT_CONFIG_CORE)
        );

        const parseTests = [
            {
                name: 'LM flags',
                args: ['--ollama', 'llama3', '--temperature', '0.7'],
                expect: (config) => {
                    expect(config.lm.enabled).toBe(true);
                    expect(config.lm.modelName).toBe('llama3');
                    expect(config.lm.temperature).toBe(0.7);
                }
            },
            {
                name: 'provider flag',
                args: ['--provider', 'openai', '--api-key', 'sk-test'],
                expect: (config) => {
                    expect(config.lm.enabled).toBe(true);
                    expect(config.lm.provider).toBe('openai');
                    expect(config.lm.apiKey).toBe('sk-test');
                }
            },
            {
                name: 'UI flags',
                args: ['--port', '3000', '--prod', '--graph-ui'],
                expect: (config) => {
                    expect(config.ui.port).toBe(3000);
                    expect(config.ui.dev).toBe(false);
                    expect(config.ui.layout).toBe('graph');
                }
            },
            {
                name: 'WebSocket flags',
                args: ['--ws-port', '9090', '--host', '127.0.0.1'],
                expect: (config) => {
                    expect(config.webSocket.port).toBe(9090);
                    expect(config.webSocket.host).toBe('127.0.0.1');
                }
            }
        ];

        test.each(parseTests)('parses $name', ({args, expect: expectFn}) =>
            expectFn(Config.parse(args))
        );
    });
});

describe('ConfigValidator.mergeWithDefaults', () => {
    test('merges with defaults', () => {
        const result = ConfigValidator.mergeWithDefaults({});
        expect(result).toBeDefined();
    });
});

describe('Component Lifecycle (BaseComponent)', () => {
    class TestComponent extends BaseComponent {
        constructor(config = {}) {
            super(config, 'TestComponent');
            this.initCalled = false;
            this.startCalled = false;
            this.stopCalled = false;
            this.disposeCalled = false;
        }

        async _initialize() { this.initCalled = true; }
        async _start() { this.startCalled = true; }
        async _stop() { this.stopCalled = true; }
        async _dispose() { this.disposeCalled = true; }
    }

    let component;

    beforeEach(() => component = new TestComponent({}));

    test('lifecycle flow', async () => {
        expect(component.isInitialized).toBe(false);

        await component.initialize();
        expect(component.isInitialized).toBe(true);
        expect(component.initCalled).toBe(true);

        await component.start();
        expect(component.isStarted).toBe(true);
        expect(component.startCalled).toBe(true);

        await component.stop();
        expect(component.isStarted).toBe(false);
        expect(component.stopCalled).toBe(true);
    });

    test('prevents start before initialize', async () => {
        const result = await component.start();
        expect(result).toBe(false);
    });

    test('handles dispose', async () => {
        await component.initialize();
        await component.start();
        await component.dispose();
        expect(component.isStarted).toBe(false);
        expect(component.isDisposed).toBe(true);
        expect(component.disposeCalled).toBe(true);
    });

    test('prevents double initialization', async () => {
        await component.initialize();
        const result = await component.initialize();
        expect(result).toBe(true); // warns but returns true
        expect(component.isInitialized).toBe(true);
    });

    test('configure merges values', () => {
        const comp = new TestComponent({a: 1, b: {c: 2}});
        comp.configure({b: {d: 3}});
        expect(comp.config.b.d).toBe(3);
    });
});

describe('Config Validation', () => {
    test('handles empty command line args', () => {
        const config = Config.parse([]);
        expect(config).toBeDefined();
        expect(config.lm).toBeDefined();
    });

    test('handles invalid port numbers', () => {
        const config = Config.parse(['--port', 'invalid']);
        expect(config).toBeDefined();
    });
});

describe('ConfigManager', () => {
    let configManager;

    beforeEach(() => {
        jest.clearAllMocks();
        configManager = new ConfigManager(DEFAULT_CONFIG);
    });

    test('initializes with default config', () => {
        expect(configManager.config).toMatchObject(DEFAULT_CONFIG);
        expect(configManager.config.memory.focusCapacity).toBe(100);
    });

    test('updates config values', () => {
        configManager.update({lm: {enabled: true}});
        expect(configManager.config.lm.enabled).toBe(true);
    });

    test('validates config on update', () => {
        const result = configManager.update({webSocket: {port: 1234}});
        expect(result).toBe(configManager);
    });
});

describe('ConfigSchemas', () => {
    describe('validateConfig', () => {
        test('validates a correct minimal config', () => {
            const result = validateConfig({memory: {capacity: 1000}});
            expect(result.error).toBeNull();
            expect(result.value.memory.capacity).toBe(1000);
        });

        test('returns error for invalid config', () => {
            const result = validateConfig({memory: {capacity: -1}});
            expect(result.error).not.toBeNull();
            expect(result.value).toBeNull();
        });
    });

    describe('validateConfigWithDefaults', () => {
        test('returns validated config with defaults', () => {
            const result = validateConfigWithDefaults({});
            expect(result.memory.capacity).toBe(1000);
            result.system && expect(result.system.port).toBeDefined();
        });

        test('throws error for invalid config', () =>
            expect(() => validateConfigWithDefaults({cycle: {delay: -10}}))
                .toThrow(/validation failed/i)
        );
    });

    describe('Schema Specifics', () => {
        test('validates nested objects', () => {
            const result = validateConfigWithDefaults({
                lm: {
                    enabled: true,
                    providers: {
                        test: {
                            name: 'Test',
                            model: 'gpt-4',
                            baseURL: 'http://localhost:8080'
                        }
                    }
                }
            });
            expect(result.lm.enabled).toBe(true);
            expect(result.lm.providers.test.model).toBe('gpt-4');
        });

        test('allows passthrough for unknown keys', () => {
            const result = validateConfigWithDefaults({
                extra: 'value',
                memory: {custom: 123}
            });
            expect(result.extra).toBe('value');
            expect(result.memory.custom).toBe(123);
        });
    });
});
