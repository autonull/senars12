import {Logger} from '../util/Logger.js';
import {EventBus} from './EventBus.js';
import {createEventPayload} from './introspectionEvents.js';
import {validateWithSchema} from './object.js';
import {emitComponentEvent} from './eventUtils.js';

export class BaseComponent {
    constructor(config = {}, name = 'BaseComponent', eventBus = null, validationSchema = null) {
        this._defaultConfig = config;
        this._config = {...config};
        this._name = name;
        this._logger = Logger;  // Logger is a singleton instance
        this._eventBus = eventBus || new EventBus();
        this._metrics = new Map();
        this._validationSchema = validationSchema;
        this._initialized = false;
        this._started = false;
        this._disposed = false;
        this._startTime = null;

        // Validate configuration if schema provided
        this._validationSchema && this._validateConfig(config);

        // Initialize common metrics
        this._initializeMetrics();
    }

    // Getters
    get name() {
        return this._name;
    }

    get config() {
        return {...this._config};
    }

    get defaultConfig() {
        return {...this._defaultConfig};
    }

    get logger() {
        return this._logger;
    }

    get eventBus() {
        return this._eventBus;
    }

    get metrics() {
        return this._metrics;
    }

    get isInitialized() {
        return this._initialized;
    }

    get isStarted() {
        return this._started;
    }

    get isDisposed() {
        return this._disposed;
    }

    get isRunning() {
        return this._started && !this._disposed;
    }

    get uptime() {
        return this._startTime ? Date.now() - this._startTime : 0;
    }

    // Configuration methods (from ConfigurableComponent)
    configure(cfg) {
        this._config = {...this._config, ...this._validate(cfg)};
        return this;
    }

    getConfigValue(key, defaultVal) {
        return this._config[key] ?? defaultVal;
    }

    setConfigValue(key, val) {
        const newConfig = {...this._config, [key]: val};
        this._config = this._validate(newConfig);
        return this;
    }

    resetConfig() {
        this._config = {...this._defaultConfig};
        return this;
    }

    hasConfig(key) {
        return key in this._config;
    }

    validateConfig(config = this._config) {
        return this._validationSchema ? validateWithSchema(config, this._validationSchema) : config;
    }

    _validate(config) {
        return this.validateConfig(config);
    }

    // Lifecycle operation executor
    async _executeLifecycleOperation(operation, checkCondition, action, metricName = null) {
        if (checkCondition) {
            const error = this._checkLifecycleCondition(operation);
            if (error) {
                this.logWarn(error);
                return operation !== 'start';
            }
        }

        try {
            if (operation === 'start') {this._startTime = Date.now();}

            await action();

            // Update state after successful operation
            this._updateComponentState(operation);

            // Emit the appropriate event
            this._emitLifecycleEvent(operation);

            // Log and update metrics
            this._logger.info(`${this._name} ${this._getOperationSuffix(operation)}`);
            metricName && this.incrementMetric(metricName);
            return true;
        } catch (error) {
            this._logger.error(`Failed to ${operation} component`, error);
            return false;
        }
    }

    /**
     * Check lifecycle operation conditions
     * @private
     */
    _checkLifecycleCondition(operation) {
        const validations = {
            start: () => !this._initialized && `Cannot start uninitialized component ${this._name}`,
            stop: () => !this._started && `Component ${this._name} not started`,
            initialize: () => this._initialized && `Component ${this._name} already initialized`,
            dispose: () => this._disposed && `Component ${this._name} already disposed`
        };

        return validations[operation]?.() || null;
    }

    /**
     * Update component state based on operation
     * @private
     */
    _updateComponentState(operation) {
        const stateUpdates = {
            initialize: () => this._initialized = true,
            start: () => this._started = true,
            stop: () => this._started = false,
            dispose: () => this._disposed = true
        };
        stateUpdates[operation]?.();
    }

    /**
     * Get operation suffix for logging
     * @private
     */
    _getOperationSuffix(operation) {
        const suffixes = {
            initialize: 'd',
            start: 'ed',
            stop: 'ped'
        };
        return `${operation}${suffixes[operation] || 'd'}`;
    }

    _emitLifecycleEvent(operation) {
        this._eventBus.emit(`${this._name}.${operation}d`, {
            timestamp: Date.now(),
            component: this._name,
            ...(operation !== 'initialize' && operation !== 'dispose' && {uptime: this.uptime})
        });
    }

    // Lifecycle methods
    async initialize() {
        return await this._executeLifecycleOperation(
            'initialize', true, () => this._initialize(), 'initializeCount'
        );
    }

    async start() {
        return await this._executeLifecycleOperation(
            'start', true, () => this._start(), 'startCount'
        );
    }

    async stop() {
        return await this._executeLifecycleOperation(
            'stop', true, () => this._stop(), 'stopCount'
        );
    }

    async dispose() {
        if (this._disposed) {return this.logWarn('Component already disposed') ?? true;}

        try {
            this._started && await this.stop();

            await this._executeLifecycleOperation(
                'dispose',
                false, // no condition check needed for dispose
                () => this._dispose()
            );
            return true;
        } catch (error) {
            this._logger.error('Failed to dispose component', error);
            return false;
        }
    }

    // Default lifecycle implementations (can be overridden)
    async _initialize() {
    }

    async _start() {
    }

    async _stop() {
    }

    async _dispose() {
    }

    _initializeMetrics() {
        for (const k of ['initializeCount', 'startCount', 'stopCount', 'errorCount', 'uptime']) {
            this._metrics.set(k, 0);
        }
        this._metrics.set('lastActivity', Date.now());
    }

    // Metric operations
    updateMetric(key, value) {
        this._metrics.set(key, value);
        this._metrics.set('lastActivity', Date.now());
    }

    incrementMetric(key, increment = 1) {
        const currentValue = this._metrics.get(key) || 0;
        this._metrics.set(key, currentValue + increment);
        this._metrics.set('lastActivity', Date.now());
    }

    getMetric(key) {
        return this._metrics.get(key);
    }

    getMetrics() {
        return {
            ...Object.fromEntries(this._metrics),
            uptime: this.uptime,
            isRunning: this.isRunning
        };
    }

    // Logging methods
    logInfo(message, metadata) {
        this._logger.info(message, metadata);
        this._metrics.set('lastActivity', Date.now());
    }

    logWarn(message, metadata) {
        this._logger.warn(message, metadata);
        this._metrics.set('lastActivity', Date.now());
    }

    logError(message, metadata) {
        this._logger.error(message, metadata);
        this.incrementMetric('errorCount');
    }

    logDebug(message, metadata) {
        this._logger.debug(message, metadata);
        this._metrics.set('lastActivity', Date.now());
    }

    // Event emission
    async emitEvent(event, dataOrFn, options = {}) {
        if (!this._eventBus.hasSubscribers(event)) {
            return;
        }

        const data = typeof dataOrFn === 'function' ? dataOrFn() : dataOrFn;
        await emitComponentEvent(
            this._eventBus,
            event,
            data,
            this._name,
            this._startTime ? Date.now() - this._startTime : 0
        );
    }

    _emitIntrospectionEvent(eventName, payloadOrFn) {
        if (!this._config.introspection?.enabled) {return;}
        const payload = typeof payloadOrFn === 'function' ? payloadOrFn() : payloadOrFn;
        this._eventBus.emit(eventName, createEventPayload(this._name, payload));
    }

    // Event handling
    onEvent(event, handler) {
        this._eventBus.on(event, handler);
    }

    offEvent(event, handler) {
        this._eventBus.off(event, handler);
    }
}