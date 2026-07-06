import { deepMerge, safeGet } from '../util/object.js';
import { Logger } from '../util/Logger.js';
import { ConfigurationError } from '../errors/index.js';

export class ConfigManager {
    #defaults;
    #config;
    #schema;
    #listeners = new Set();
    #keyListeners = new Map();
    #frozen = false;
    #autoValidate;
    #entries = new Map();
    #overrides = new Map();
    #validators = new Map();
    #history = [];
    #recordHistory = false;

    constructor(defaults = {}, { schema = null, autoValidate = false, freeze = false, recordHistory = false } = {}) {
        this.#defaults = Object.freeze({ ...defaults });
        this.#config = { ...defaults };
        this.#schema = schema;
        this.#autoValidate = autoValidate;
        this.#recordHistory = recordHistory;
        if (freeze) {this.freeze();}
    }

    get config() { return { ...this.#config }; }
    get defaults() { return { ...this.#defaults }; }
    get isFrozen() { return this.#frozen; }

    get(path, fallback) {
        if (!path) {return { ...this.#config };}
        for (const override of this.#overrides.values()) {
            if (path in override) {return override[path];}
        }
        const entry = this.#entries.get(path);
        if (entry) {return entry.value;}
        return safeGet(this.#config, path, fallback ?? this.#defaults[path]);
    }

    set(path, value, { validate = true, persist = false, override: overrideName = null } = {}) {
        if (this.#frozen) {throw new ConfigurationError('Config is frozen', { key: path });}
        const validator = this.#validators.get(path);
        if (validate && validator && !validator(value)) {throw new ConfigurationError(`Invalid value for ${path}`, { key: path, value });}

        if (overrideName) {
            if (!this.#overrides.has(overrideName)) {this.#overrides.set(overrideName, {});}
            this.#overrides.get(overrideName)[path] = value;
        } else {
            const entry = this.#entries.get(path);
            if (entry) {
                const oldValue = entry.value;
                entry.value = value;
                entry.modified = true;
                entry.modifiedAt = Date.now();
                this.#notifyKeyListeners(path, oldValue, value);
            }
            const keys = path.split('.');
            const target = keys.slice(0, -1).reduce((cur, key) => { cur[key] ??= {}; return cur[key]; }, this.#config);
            target[keys.at(-1)] = value;
        }

        if (persist || this.#recordHistory) {this.#history.push({ key: path, value, timestamp: Date.now() });}
        if (validate && this.#autoValidate) {this.#validate();}
        this.#notify(path, value);
        return this;
    }

    define(key, defaultValue, validator = null, description = '') {
        if (this.#frozen) {throw new ConfigurationError(`Cannot define config after freeze: ${key}`);}
        if (validator && !validator(defaultValue)) {throw new ConfigurationError(`Invalid default value for ${key}`, { key });}
        this.#entries.set(key, { value: defaultValue, validator, description, modified: false, modifiedAt: null });
        this.#validators.set(key, validator);
        this.#config[key] = defaultValue;
        return this;
    }

    batch(updates, options = {}) {
        Object.entries(updates).forEach(([key, value]) => this.set(key, value, options));
        return this;
    }

    update(updates, { deep = true, validate = true } = {}) {
        if (this.#frozen) {throw new ConfigurationError('Config is frozen');}
        this.#config = deep ? deepMerge({ ...this.#config }, updates) : { ...this.#config, ...updates };
        if (validate && this.#autoValidate) {this.#validate();}
        return this;
    }

    reset(path = null) {
        if (path) {
            const entry = this.#entries.get(path);
            if (entry) { entry.value = this.#defaults[path] ?? entry.value; entry.modified = false; entry.modifiedAt = null; }
            this.#config[path] = structuredClone(this.#defaults[path]);
            this.#overrides.delete(path);
        } else {
            for (const [key, entry] of this.#entries) { entry.value = this.#defaults[key]; entry.modified = false; entry.modifiedAt = null; }
            this.#config = { ...this.#defaults };
            this.#overrides.clear();
        }
        return this;
    }

    freeze() { this.#frozen = true; return this; }

    onChange(fn) { this.#listeners.add(fn); return () => this.#listeners.delete(fn); }
    onChangeKey(key, callback) {
        if (!this.#keyListeners.has(key)) {this.#keyListeners.set(key, []);}
        this.#keyListeners.get(key).push(callback);
        return () => this.offChangeKey(key, callback);
    }
    offChangeKey(key, callback) {
        const listeners = this.#keyListeners.get(key);
        if (listeners) { const idx = listeners.indexOf(callback); if (idx !== -1) {listeners.splice(idx, 1);} }
    }

    #notify(key, value) { this.#listeners.forEach(fn => { try { fn(key, value, this.config); } catch { /* skip */ } }); }
    #notifyKeyListeners(key, oldValue, newValue) {
        const listeners = this.#keyListeners.get(key);
        if (listeners) { for (const cb of listeners) { try { cb(newValue, oldValue, key); } catch (err) { Logger.error(`Config listener error for ${key}:`, err); } } }
    }

    #validate() {
        if (!this.#schema) {return true;}
        try { return this.#schema(this.#config); }
        catch (error) { Logger.warn('Config validation failed', { error: error.message }); return false; }
    }

    getAll() {
        if (this.#entries.size > 0) {return Object.fromEntries([...this.#entries.entries()].map(([k, e]) => [k, e.value]));}
        return { ...this.#defaults, ...this.#config };
    }

    setAll(config) { for (const [key, value] of Object.entries(config)) {this.set(key, value);} return this; }

    getDiff() {
        return Object.fromEntries(Object.entries(this.#config).filter(([k, v]) => this.#defaults[k] !== v));
    }

    getMeta(key) {
        const entry = this.#entries.get(key);
        if (!entry) {return null;}
        return { value: entry.value, modified: entry.modified, modifiedAt: entry.modifiedAt, hasValidator: !!entry.validator, description: entry.description, listenerCount: this.#keyListeners.get(key)?.length ?? 0 };
    }

    getStats() {
        const modifiedCount = [...this.#entries.values()].filter(e => e.modified).length;
        return { totalKeys: this.#entries.size, modifiedKeys: modifiedCount, listenerCount: this.#keyListeners.size };
    }

    getHistory() { return [...this.#history]; }

    serialize() {
        const data = Object.fromEntries([...this.#entries.entries()].map(([k, e]) => [k, { value: e.value, modified: e.modified }]));
        return JSON.stringify(data, null, 2);
    }

    deserialize(json) {
        const data = JSON.parse(json);
        for (const [key, { value }] of Object.entries(data)) { if (this.#entries.has(key)) {this.set(key, value);} }
        return this;
    }

    toJSON() {
        return this.#entries.size > 0
            ? { defaults: { ...this.#defaults }, current: this.getAll(), overrides: Object.fromEntries(this.#overrides), diff: this.getDiff() }
            : { ...this.#config };
    }

    clone() {
        const cloned = new ConfigManager(this.#defaults, { schema: this.#schema, autoValidate: this.#autoValidate, recordHistory: this.#recordHistory });
        cloned.batch(this.#config);
        return cloned;
    }
}

export const Validators = {
    boolean: v => typeof v === 'boolean',
    positive: v => typeof v === 'number' && v > 0,
    nonNegative: v => typeof v === 'number' && v >= 0,
    string: v => typeof v === 'string',
    array: v => Array.isArray(v),
    range: (min, max) => v => typeof v === 'number' && v >= min && v <= max,
    oneOf: values => v => values.includes(v)
};

export function createConfigManager(defaults = {}, options = {}) {
    return new ConfigManager(defaults, options);
}
