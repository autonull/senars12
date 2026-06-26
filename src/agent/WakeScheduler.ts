import {EventEmitter} from 'node:events';
import {createLogger, type Logger} from '../nar/logger/index.js';

export interface WakeSchedulerConfig {
    baseIntervalMs: number;
    minIntervalMs: number;
    maxIntervalMs: number;
    driveUrgencyFactor: number;
}

export class WakeScheduler extends EventEmitter {
    private readonly config: Required<WakeSchedulerConfig>;
    private readonly logger: Logger;
    private timer?: ReturnType<typeof setTimeout>;
    private running = false;
    private currentInterval: number;

    constructor(config: Partial<WakeSchedulerConfig> = {}, logger?: Logger) {
        super();
        this.config = {
            baseIntervalMs: config.baseIntervalMs ?? 60_000,
            minIntervalMs: config.minIntervalMs ?? 10_000,
            maxIntervalMs: config.maxIntervalMs ?? 300_000,
            driveUrgencyFactor: config.driveUrgencyFactor ?? 0.5,
        };
        this.logger = logger ?? createLogger({scope: 'wake-scheduler'});
        this.currentInterval = this.config.baseIntervalMs;
    }

    start(): void {
        if (this.running) return;
        this.running = true;
        this.scheduleNext();
        this.logger.info('WakeScheduler started', {intervalMs: this.currentInterval});
    }

    stop(): void {
        this.running = false;
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = undefined;
        }
        this.logger.info('WakeScheduler stopped');
    }

    scheduleWake(intervalMs?: number): void {
        if (this.timer) {
            clearTimeout(this.timer);
        }

        const interval = intervalMs ?? this.currentInterval;
        this.currentInterval = Math.max(this.config.minIntervalMs, Math.min(this.config.maxIntervalMs, interval));

        this.timer = setTimeout(() => {
            if (this.running) {
                this.emit('wake');
                this.scheduleNext();
            }
        }, this.currentInterval);

        this.timer.unref?.();
    }

    private scheduleNext(): void {
        this.scheduleWake(this.currentInterval);
    }

    setUrgency(urgency: number): void {
        const factor = 1 - urgency * this.config.driveUrgencyFactor;
        this.currentInterval = Math.max(this.config.minIntervalMs, Math.min(this.config.maxIntervalMs, this.config.baseIntervalMs * factor));
        if (this.running) {
            this.scheduleWake(this.currentInterval);
        }
    }

    getInterval(): number {
        return this.currentInterval;
    }

    isRunning(): boolean {
        return this.running;
    }
}

export function createWakeScheduler(config?: Partial<WakeSchedulerConfig>, logger?: Logger): WakeScheduler {
    return new WakeScheduler(config, logger);
}