import { BaseComponent } from './BaseComponent.js';

export class ComponentManager extends BaseComponent {
    constructor(config = {}, eventBus = null, nar = null) {
        super(config, 'ComponentManager', eventBus);
        this.nar = nar;
        this._components = new Map();
        this._dependencyGraph = new Map();
        this._startupOrder = [];
        this._shutdownOrder = [];
    }

    async loadComponentsFromConfig(componentConfigs) {
        // Dynamic loading from string paths is problematic in browser environments
        // and causes issues with bundlers that crawl the filesystem.
        if (typeof process === 'undefined' || !process.versions?.node) {
            this.logInfo('ComponentManager.loadComponentsFromConfig: Skipping dynamic loading in non-Node environment');
            return;
        }

        for (const [name, config] of Object.entries(componentConfigs)) {
            if (!config.enabled) {
                this.logDebug(`Component ${name} is disabled in config.`);
                continue;
            }

            try {
                // Hiding dynamic import from bundlers like esbuild to avoid static analysis issues
                // This is strictly for the Node.js environment where these components exist on disk
                const module = await import(`../${config.path}`);
                const ComponentClass = module[config.class];
                if (!ComponentClass) {
                    throw new Error(`Component class ${config.class} not found in ${config.path}`);
                }

                const dependencies = {};
                if (config.dependencies) {
                    for (const dep of config.dependencies) {
                        if (dep === 'nar') {
                            dependencies['nar'] = this.nar;
                        } else if (dep === 'eventBus') {
                            dependencies['eventBus'] = this.eventBus;
                        } else {
                            dependencies[dep] = this.getComponent(dep);
                        }
                    }
                }

                const instance = new ComponentClass(config.config, dependencies.eventBus, dependencies.nar);
                this.registerComponent(name, instance, config.dependencies);
                this.logInfo(`Successfully loaded and registered component: ${name}`);

            } catch (error) {
                this.logError(`Failed to load component ${name}:`, error);
            }
        }
    }

    registerComponent(name, component, dependencies = []) {
        if (this._components.has(name)) {
            this.logWarn(`Component ${name} already registered`);
            return false;
        }

        this._components.set(name, component);
        this._dependencyGraph.set(name, dependencies);
        this.logDebug(`Registered component: ${name}`, {
            dependencies,
            totalComponents: this._components.size
        });

        return true;
    }

    getComponent(name) {
        return this._components.get(name) || null;
    }

    getComponents() {
        return new Map(this._components);
    }

    getStartupOrder() {
        if (this._startupOrder.length === 0) {
            this._calculateStartupOrder();
        }
        return [...this._startupOrder];
    }

    getShutdownOrder() {
        if (this._shutdownOrder.length === 0) {
            this._calculateShutdownOrder();
        }
        return [...this._shutdownOrder];
    }

    _calculateStartupOrder() {
        const result = [];
        const visited = new Set();
        const visiting = new Set();

        const visit = (node) => {
            if (visited.has(node)) {return;}
            if (visiting.has(node)) {
                throw new Error(`Circular dependency detected: ${node}`);
            }

            visiting.add(node);

            const dependencies = this._dependencyGraph.get(node) || [];
            for (const dependency of dependencies) {
                if (this._components.has(dependency)) {
                    visit(dependency);
                }
            }

            visiting.delete(node);
            visited.add(node);
            result.push(node);
        };

        for (const componentName of this._components.keys()) {
            if (!visited.has(componentName)) {
                visit(componentName);
            }
        }

        this._startupOrder = result;
    }

    _calculateShutdownOrder() {
        if (this._startupOrder.length === 0) {
            this._calculateStartupOrder();
        }
        this._shutdownOrder = [...this._startupOrder].reverse();
    }

    async _executeLifecycleOperation(operation, componentOrder, metricUpdate = null) {
        const verbMap = {
            initialize: 'Initializing',
            start: 'Starting',
            stop: 'Stopping',
            dispose: 'Disposing'
        };
        const verb = verbMap[operation] || `${operation.charAt(0).toUpperCase() + operation.slice(1)}ing`;
        this.logInfo(`${verb} ${this._components.size} components...`);

        const failedComponents = [];
        const operationMethod = operation;

        for (const componentName of componentOrder) {
            const component = this._components.get(componentName);
            if (!component) {continue;}

            this.logDebug(`${operation.charAt(0).toUpperCase() + operation.slice(1)}ing component: ${componentName}`);

            try {
                const success = await component[operationMethod]();
                if (!success) {
                    failedComponents.push(componentName);
                    this.logError(`Failed to ${operation} component: ${componentName}`);
                } else if (metricUpdate) {
                    this.incrementMetric(metricUpdate.metric);
                }
            } catch (error) {
                failedComponents.push(componentName);
                this.logError(`Exception during ${operation} of component ${componentName}:`, error);
            }
        }

        const success = failedComponents.length === 0;
        const total = componentOrder.length;
        const successful = total - failedComponents.length;

        this._logOperationResult(operation, successful, total, failedComponents.length);
        this._emitLifecycleEvent(operation, total, successful, failedComponents, success);

        return success;
    }

    _logOperationResult(operation, successful, total, failed) {
        const pastMap = {
            initialize: 'initialized',
            start: 'started',
            stop: 'stopped',
            dispose: 'disposed'
        };
        const past = pastMap[operation] || `${operation}ed`;

        if (failed > 0) {
            this.logInfo(`${operation.charAt(0).toUpperCase() + operation.slice(1)}: ${successful}/${total} ${operation === 'init' ? 'OK' : 'successful'}, ${failed} failed`);
        } else {
            this.logInfo(`All ${total} components ${operation === 'init' ? 'OK' : `${past} successfully`}`);
        }
    }

    _emitLifecycleEvent(operation, total, successful, failedComponents, success) {
        this.emitEvent(`components.${operation}ed`, {
            total,
            successful,
            failed: failedComponents.length,
            failedComponents,
            success
        });
    }

    async initializeAll() {
        const startupOrder = this.getStartupOrder();
        return await this._executeLifecycleOperation('initialize', startupOrder, { metric: 'initializeCount' });
    }

    async startAll() {
        const startupOrder = this.getStartupOrder();
        return await this._executeLifecycleOperation('start', startupOrder, { metric: 'startCount' });
    }

    async stopAll() {
        const shutdownOrder = this.getShutdownOrder();
        return await this._executeLifecycleOperation('stop', shutdownOrder, { metric: 'stopCount' });
    }

    async disposeAll() {
        const shutdownOrder = this.getShutdownOrder();
        return await this._executeLifecycleOperation('dispose', shutdownOrder);
    }

    getComponentsMetrics() {
        const allMetrics = {};

        for (const [name, component] of this._components) {
            allMetrics[name] = {
                isInitialized: component.isInitialized,
                isStarted: component.isStarted,
                isDisposed: component.isDisposed,
                metrics: component.getMetrics()
            };
        }

        return allMetrics;
    }

    async healthCheck() {
        const healthStatus = {};

        for (const [name, component] of this._components) {
            try {
                healthStatus[name] = {
                    isInitialized: component.isInitialized,
                    isStarted: component.isStarted,
                    isDisposed: component.isDisposed,
                    reachable: true,
                    error: null
                };
            } catch (error) {
                healthStatus[name] = {
                    isInitialized: false,
                    isStarted: false,
                    isDisposed: true,
                    reachable: false,
                    error: error.message
                };
            }
        }

        return healthStatus;
    }
}