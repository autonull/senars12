/**
 * ExtensionRegistry.js - Lazy-loaded extension management with dependency resolution
 * Enables dynamic extension loading and clean separation of concerns
 */

import {Logger} from '@senars/core';

export class ExtensionRegistry {
    constructor(context) {
        this.context = context;
        this.extensions = new Map();
        this.loaded = new Set();
        this.loading = new Map(); // Track in-progress loads
    }

    /**
     * Register an extension factory
     * @param {string} name - Extension name
     * @param {Function} factory - Async factory function (context) => Promise<extension>
     * @param {string[]} dependencies - List of extension names this depends on
     * @param {Object} options - Extension options
     */
    register(name, factory, dependencies = [], options = {}) {
        if (this.extensions.has(name)) {
            Logger.warn(`Extension already registered: ${name}`);
        }

        this.extensions.set(name, {
            name,
            factory,
            dependencies,
            options,
            instance: null,
            loaded: false,
            error: null
        });

        return this;
    }

    /**
     * Check if an extension is registered
     */
    isRegistered(name) {
        return this.extensions.has(name);
    }

    /**
     * Check if an extension is loaded
     */
    isLoaded(name) {
        return this.loaded.has(name);
    }

    /**
     * Get an extension instance (loads if needed)
     */
    async get(name) {
        if (!this.extensions.has(name)) {
            throw new Error(`Extension not registered: ${name}`);
        }

        if (this.loaded.has(name)) {
            return this.extensions.get(name).instance;
        }

        return this.load(name);
    }

    /**
     * Load an extension and its dependencies
     */
    async load(name) {
        const ext = this.extensions.get(name);
        if (!ext) {
            throw new Error(`Extension not registered: ${name}`);
        }

        if (ext.loaded) {
            return ext.instance;
        }

        // Check for circular dependency / already loading
        if (this.loading.get(name)) {
            return this.loading.get(name);
        }

        // Create loading promise
        const loadPromise = this._doLoad(ext);
        this.loading.set(name, loadPromise);

        try {
            const instance = await loadPromise;
            this.loading.delete(name);
            return instance;
        } catch (error) {
            this.loading.delete(name);
            ext.error = error;
            throw error;
        }
    }

    /**
     * Internal load implementation
     */
    async _doLoad(ext) {
        // Load dependencies first (in parallel where possible)
        if (ext.dependencies.length > 0) {
            const depPromises = ext.dependencies.map(dep => this.load(dep));
            await Promise.all(depPromises);
        }

        // Check if already loaded (could have been loaded as dependency)
        if (ext.loaded) {
            return ext.instance;
        }

        // Call factory
        Logger.info(`Loading extension: ${ext.name}`);
        const instance = await ext.factory(this.context);

        // Store instance
        ext.instance = instance;
        ext.loaded = true;
        this.loaded.add(ext.name);

        // Call lifecycle hook if present
        if (instance.onLoad) {
            await instance.onLoad(this.context);
        }

        // Auto-register if extension has register method
        if (instance.register) {
            instance.register();
        }

        Logger.info(`Extension loaded: ${ext.name}`);
        return instance;
    }

    /**
     * Load multiple extensions
     */
    async loadAll(names) {
        const results = await Promise.allSettled(names.map(name => this.load(name)));

        const failures = results.filter(r => r.status === 'rejected');
        if (failures.length > 0) {
            Logger.error(`Failed to load ${failures.length} extension(s):`,
                failures.map(f => f.reason?.message || f.reason));
        }

        return results;
    }

    /**
     * Load extensions based on a condition/predicate
     */
    async loadWhere(predicate) {
        const toLoad = [];
        for (const [name, ext] of this.extensions.entries()) {
            if (!ext.loaded && predicate(ext)) {
                toLoad.push(name);
            }
        }
        return this.loadAll(toLoad);
    }

    /**
     * Unload an extension
     */
    async unload(name) {
        const ext = this.extensions.get(name);
        if (!ext || !ext.loaded) {
            return false;
        }

        // Check if other loaded extensions depend on this
        const dependents = [];
        for (const [depName, depExt] of this.extensions.entries()) {
            if (depExt.loaded && depExt.dependencies.includes(name)) {
                dependents.push(depName);
            }
        }

        if (dependents.length > 0) {
            throw new Error(`Cannot unload ${name}: ${dependents.join(', ')} depend on it`);
        }

        // Call lifecycle hook
        if (ext.instance.onUnload) {
            await ext.instance.onUnload(this.context);
        }

        ext.instance = null;
        ext.loaded = false;
        this.loaded.delete(name);

        Logger.info(`Extension unloaded: ${name}`);
        return true;
    }

    /**
     * Get list of all registered extensions
     */
    list() {
        const result = [];
        for (const [name, ext] of this.extensions.entries()) {
            result.push({
                name,
                loaded: ext.loaded,
                dependencies: ext.dependencies,
                error: ext.error?.message
            });
        }
        return result;
    }

    /**
     * Get extension info
     */
    info(name) {
        const ext = this.extensions.get(name);
        if (!ext) {
            return null;
        }

        return {
            name: ext.name,
            loaded: ext.loaded,
            dependencies: ext.dependencies,
            options: ext.options,
            hasInstance: !!ext.instance,
            error: ext.error?.message,
            instanceType: ext.instance?.constructor?.name
        };
    }

    /**
     * Get statistics
     */
    getStats() {
        let loaded = 0;
        let failed = 0;
        let pending = 0;

        for (const ext of this.extensions.values()) {
            if (ext.loaded) {
                loaded++;
            } else if (ext.error) {
                failed++;
            } else {
                pending++;
            }
        }

        return {
            total: this.extensions.size,
            loaded,
            failed,
            pending,
            loading: this.loading.size
        };
    }

    /**
     * Clear all extensions
     */
    async clear() {
        const names = Array.from(this.loaded);
        for (const name of names) {
            await this.unload(name);
        }
        this.extensions.clear();
        this.loaded.clear();
    }
}

/**
 * Helper to create extension factories from common patterns
 */
export const ExtensionFactory = {
    /**
     * Create a simple extension that just registers operations
     */
    ops(operations, options = {}) {
        return async (context) => ({
            register() {
                for (const [name, fn] of Object.entries(operations)) {
                    context.ground?.register(name, fn, options);
                }
            }
        });
    },

    /**
     * Create an extension that wraps a module
     */
    module(importPath, setupFn) {
        return async (context) => {
            const module = await import(importPath);
            return setupFn ? setupFn(module, context) : module;
        };
    },

    /**
     * Create a conditional extension (only loads if condition is met)
     */
    conditional(condition, factory) {
        return async (context) => {
            const condResult = typeof condition === 'function'
                ? await condition(context)
                : condition;

            if (!condResult) {
                return {
                    register() {
                    }
                }; // No-op extension
            }

            return factory(context);
        };
    },

    /**
     * Create a lazy extension (factory not called until first use)
     */
    lazy(factory) {
        let instance = null;
        return {
            async register() {
                if (!instance) {
                    instance = await factory(this);
                }
                if (instance.register) {
                    instance.register();
                }
            },
            getInstance() {
                return instance;
            }
        };
    }
};

/**
 * Pre-configured extension registrations for MeTTa
 */
export function registerMeTTaExtensions(registry) {
    // Neural Bridge (P3-C)
    registry.register('neural-bridge',
        async (context) => {
            const {NeuralBridge} = await import('../extensions/NeuralBridge.js');
            return {register: () => NeuralBridge.register(context.ground)};
        },
        [], // No dependencies
        {optional: true}
    );

    // SMT Bridge (P3-B)
    registry.register('smt-bridge',
        async (context) => {
            const {SMTBridge} = await import('../extensions/SMTOps.js');
            const bridge = new SMTBridge();
            return {
                bridge,
                register() {
                    SMTBridge.register(context.ground);
                }
            };
        },
        [],
        {optional: true}
    );

    // Visual Debugger (P4-A)
    registry.register('visual-debugger',
        async (context) => {
            const {visualDebugger} = await import('../extensions/VisualDebugger.js');
            return {
                debugger: visualDebugger,
                register() {
                    if (context.config?.get('debugging')) {
                        visualDebugger.setEnabled(true);
                    }
                },
                enable() {
                    visualDebugger.setEnabled(true);
                },
                disable() {
                    visualDebugger.setEnabled(false);
                }
            };
        },
        [],
        {optional: true}
    );

    // Persistent Space (P2-B) - just registers the class
    registry.register('persistent-space',
        async () => {
            const {PersistentSpace} = await import('../extensions/PersistentSpace.js');
            return {PersistentSpace};
        },
        [],
        {optional: true}
    );

    return registry;
}
