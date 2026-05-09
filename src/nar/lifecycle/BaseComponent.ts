import {createLogger, Logger} from '../logger';
import {MetricsCollector} from '../metrics';
import {EventBus} from '../types';

export type ComponentState = 'created' | 'initialized' | 'started' | 'stopped' | 'disposed';

export interface ComponentContext {
    readonly logger: Logger;
    readonly metrics: MetricsCollector;
    readonly eventBus: EventBus;
}

const VALID_TRANSITIONS: Record<ComponentState, ComponentState[]> = {
    created: ['initialized', 'disposed'],
    initialized: ['started', 'disposed'],
    started: ['stopped', 'disposed'],
    stopped: ['started', 'disposed'],
    disposed: []
};

export abstract class BaseComponent {
    constructor(context?: Partial<ComponentContext>) {
        this._logger = context?.logger ?? createLogger({scope: this.constructor.name});
        this._metrics = context?.metrics ?? new MetricsCollector();
        this._eventBus = context?.eventBus ?? new EventBus();
    }

    private _state: ComponentState = 'created';

    get state(): ComponentState {
        return this._state;
    }

    private readonly _logger: Logger;

    get logger(): Logger {
        return this._logger;
    }

    private readonly _metrics: MetricsCollector;

    get metrics(): MetricsCollector {
        return this._metrics;
    }

    private readonly _eventBus: EventBus;

    get eventBus(): EventBus {
        return this._eventBus;
    }

    async initialize(): Promise<void> {
        if (this._state !== 'created') {
            throw new Error(`Cannot initialize component in state: ${this._state}`);
        }
        this.setState('initialized');
    }

    async start(): Promise<void> {
        if (this._state !== 'initialized') {
            throw new Error(`Cannot start component in state: ${this._state}`);
        }
        this.setState('started');
    }

    async stop(): Promise<void> {
        if (this._state !== 'started') {
            throw new Error(`Cannot stop component in state: ${this._state}`);
        }
        this.setState('stopped');
    }

    async dispose(): Promise<void> {
        if (this._state === 'disposed') {
            return;
        }
        if (this._state === 'started') {
            await this.stop();
        }
        this.setState('disposed');
    }

    isRunning(): boolean {
        return this._state === 'started';
    }

    isInitialized(): boolean {
        return this._state === 'initialized' || this._state === 'started';
    }

    protected setState(state: ComponentState): void {
        const validTransitions = VALID_TRANSITIONS[this._state];
        if (!validTransitions.includes(state)) {
            throw new Error(
                `Invalid state transition from ${this._state} to ${state}. Valid transitions: ${validTransitions.join(', ')}`
            );
        }
        this._state = state;
    }
}
