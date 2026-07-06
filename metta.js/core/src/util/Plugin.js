import {Logger} from './Logger.js';

export class Plugin {
    constructor(id, config = {}) {
        if (new.target === Plugin) {
            throw new TypeError('Cannot instantiate Plugin directly. Please extend the Plugin class.');
        }

        this.id = id;
        this.config = config;
        this.initialized = false;
        this.started = false;
        this.disposed = false;
    }

    async initialize(context) {
        if (this.initialized) {
            Logger.warn(`Plugin ${this.id} already initialized`);
            return true;
        }

        try {
            this.context = context;
            await this._initialize();
            this.initialized = true;
            return true;
        } catch (error) {
            Logger.error(`Failed to initialize plugin ${this.id}:`, error);
            return false;
        }
    }

    async start() {
        if (!this.initialized) {
            throw new Error(`Plugin ${this.id} must be initialized before starting`);
        }

        if (this.started) {
            Logger.warn(`Plugin ${this.id} already started`);
            return true;
        }

        try {
            await this._start();
            this.started = true;
            return true;
        } catch (error) {
            Logger.error(`Failed to start plugin ${this.id}:`, error);
            return false;
        }
    }

    async stop() {
        if (!this.started) {
            Logger.warn(`Plugin ${this.id} is not running`);
            return true;
        }

        try {
            await this._stop();
            this.started = false;
            return true;
        } catch (error) {
            Logger.error(`Failed to stop plugin ${this.id}:`, error);
            return false;
        }
    }

    async dispose() {
        if (this.disposed) {
            Logger.warn(`Plugin ${this.id} already disposed`);
            return true;
        }

        try {
            this.started && await this.stop();
            await this._dispose();
            this.disposed = true;
            return true;
        } catch (error) {
            Logger.error(`Failed to dispose plugin ${this.id}:`, error);
            return false;
        }
    }

    async _initialize() {
    }

    async _start() {
    }

    async _stop() {
    }

    async _dispose() {
    }

    getStatus() {
        return {
            id: this.id,
            initialized: this.initialized,
            started: this.started,
            disposed: this.disposed,
            config: this.config,
        };
    }

    emitEvent(event, data, options = {}) {
        this.context?.eventBus?.emit(event, {
            timestamp: Date.now(),
            source: this.id,
            ...data
        }, {
            ...options,
            source: this.id
        });
    }

    onEvent(event, handler) {
        this.context?.eventBus?.on(event, handler);
    }

    offEvent(event, handler) {
        this.context?.eventBus?.off(event, handler);
    }

    isReady() {
        return this.initialized && this.started && !this.disposed;
    }
}

export class PluginManager {
    constructor(context = {}) {
        this.context = context;
        this.plugins = new Map();
        this.initialized = false;
    }

    registerPlugin(plugin) {
        if (!(plugin instanceof Plugin)) {
            Logger.error('Plugin must be an instance of Plugin class');
            return false;
        }

        if (this.plugins.has(plugin.id)) {
            Logger.warn(`Plugin with id ${plugin.id} already registered`);
            return false;
        }

        this.plugins.set(plugin.id, plugin);
        return true;
    }

    unregisterPlugin(pluginId) {
        if (!this.plugins.has(pluginId)) {
            Logger.warn(`No plugin found with id ${pluginId}`);
            return false;
        }

        const plugin = this.plugins.get(pluginId);
        plugin.started && plugin.stop();
        !plugin.disposed && plugin.dispose();
        return this.plugins.delete(pluginId);
    }

    getPlugin(pluginId) {
        return this.plugins.get(pluginId) ?? null;
    }

    async initializeAll() {
        this.initialized = await this.#runForAll('initialize', {...this.context, pluginManager: this});
        return this.initialized;
    }

    async startAll() {
        if (!this.initialized) {
            await this.initializeAll();
        }
        return this.#runForAll('start');
    }

    async stopAll() {
        return this.#runForAll('stop');
    }

    async disposeAll() {
        await this.#runForAll('dispose');
        this.plugins.clear();
        return true;
    }

    async #runForAll(method, extraContext = {}) {
        let allSuccessful = true;
        await Promise.all([...this.plugins].map(async ([id, plugin]) => {
            try {
                const result = await plugin[method](method === 'initialize' ? {...extraContext} : undefined);
                if (!result) {
                    allSuccessful = false;
                }
            } catch (error) {
                Logger.error(`Failed to ${method} plugin ${id}:`, error);
                allSuccessful = false;
            }
        }));
        return allSuccessful;
    }

    getAllPlugins() {
        return Array.from(this.plugins.values());
    }

    getPluginsByStatus(status) {
        return Array.from(this.plugins.values()).filter(plugin => {
            switch (status) {
                case 'initialized':
                    return plugin.initialized;
                case 'started':
                    return plugin.started;
                case 'disposed':
                    return plugin.disposed;
                case 'ready':
                    return plugin.isReady?.() ?? false;
                default:
                    return true;
            }
        });
    }
}