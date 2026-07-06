/**
 * Unified Configuration Schema for SeNARS v10
 * Implements validation and standardized configuration patterns for all components
 */

export const DEFAULT_CONFIG = Object.freeze({
    termFactory: {
        maxCacheSize: 5000,
        canonicalization: {
            enableAdvancedNormalization: true,
            handleCommutativity: true,
            handleAssociativity: true,
        },
    },
    memory: {
        focusCapacity: 100,
        bagCapacity: 1000,
        forgettingThreshold: 0.1,
        consolidationInterval: 1000,
    },
    reasoning: {
        maxSteps: 1000,
        priorityThreshold: 0.01,
        revisionThreshold: 0.01,
    },
    system: {
        enableLogging: true,
        logLevel: 'INFO',
        enableMetrics: true,
        aiKRCompliance: true,
    },
    layers: {
        termLayerCapacity: 1000,
    },
    functors: {
        maxExecutionTime: 1000,
        enableSafety: true,
    },
});

import {validateConfigWithDefaults} from './ConfigValidator.js';
import {deepMerge} from '../util/object.js';

export const DEFAULT_CONFIG_CORE = Object.freeze({
    nar: {
        tools: {enabled: true},
        lm: {enabled: false},
        reasoningAboutReasoning: {enabled: true},
        debug: {pipeline: false},
    },
    lm: {
        provider: 'transformers',
        modelName: 'Xenova/t5-small',
        baseUrl: 'http://localhost:11434',
        temperature: 0,
        enabled: false,
    },
    persistence: {
        defaultPath: './agent.json',
    },
    webSocket: {
        port: 8080,
        host: '0.0.0.0',
        maxConnections: 20,
    },
    ui: {
        port: 5173,
        layout: 'default',
        dev: true,
    },
});

export class Config {
    static parse(argv) {
        if (!argv) {
            argv = typeof process !== 'undefined' && process.argv ? process.argv.slice(2) : [];
        }
        const config = structuredClone(DEFAULT_CONFIG_CORE);

        if (typeof process !== 'undefined' && process.env) {
            process.env.WS_PORT && (config.webSocket.port = parseInt(process.env.WS_PORT));
            process.env.WS_HOST && (config.webSocket.host = process.env.WS_HOST);
            process.env.PORT && (config.ui.port = parseInt(process.env.PORT));
        }

        const args = [...argv];
        const argHandlers = new Map([
            ['--ollama', (i) => {
                config.lm.enabled = true;
                if (args[i + 1] && !args[i + 1].startsWith('--')) {
                    config.lm.modelName = args[++i];
                }
                return i;
            }],
            ['--provider', (i) => { config.lm.provider = args[++i]; config.lm.enabled = true; return i; }],
            ['--model', (i) => { config.lm.modelName = args[++i]; config.lm.enabled = true; return i; }],
            ['--modelName', (i) => { config.lm.modelName = args[++i]; config.lm.enabled = true; return i; }],
            ['--base-url', (i) => { config.lm.baseUrl = args[++i]; return i; }],
            ['--temperature', (i) => { config.lm.temperature = parseFloat(args[++i]); return i; }],
            ['--api-key', (i) => { config.lm.apiKey = args[++i]; return i; }],
            ['--ws-port', (i) => { config.webSocket.port = parseInt(args[++i]); return i; }],
            ['--host', (i) => { config.webSocket.host = args[++i]; return i; }],
            ['--port', (i) => { config.ui.port = parseInt(args[++i]); return i; }],
            ['--graph-ui', (i) => { config.ui.layout = 'graph'; return i; }],
            ['--layout', (i) => { config.ui.layout = args[++i]; return i; }],
            ['--prod', (i) => { config.ui.dev = false; return i; }],
            ['--dev', (i) => { config.ui.dev = true; return i; }],
            ['--demo', (i) => { config.demo = true; return i; }],
            ['--embedding', (i) => {
                config.subsystems ??= {};
                config.subsystems.embeddingLayer ??= {};
                config.subsystems.embeddingLayer.enabled = true;
                return i;
            }],
            ['--embedding-model', (i) => {
                config.subsystems ??= {};
                config.subsystems.embeddingLayer ??= {};
                config.subsystems.embeddingLayer.enabled = true;
                config.subsystems.embeddingLayer.model = args[++i];
                return i;
            }],
        ]);

        let i = 0;
        while (i < args.length) {
            const handler = argHandlers.get(args[i]);
            if (handler) { i = handler(i); }
            i++;
        }

        return config;
    }
}

export class ConfigValidator {
    static validate(config) {
        try {
            validateConfigWithDefaults(config);
            return [];
        } catch (error) {
            return [error.message];
        }
    }

    static mergeWithDefaults(userConfig) {
        try {
            return validateConfigWithDefaults(userConfig ?? {});
        } catch {
            return deepMerge(DEFAULT_CONFIG, userConfig);
        }
    }
}