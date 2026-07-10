import { BaseComponent as CoreBaseComponent } from '@senars/core';
import type { ComponentContext as CoreComponentContext } from '@senars/core';
import { type Logger, createLogger } from '../logger';
import { MetricsCollector } from '../metrics';
import { EventBus as NarEventBus } from '../types/events.js';

export type { ComponentState } from '@senars/core';
export type { CoreComponentContext as ComponentContext };

export abstract class BaseComponent extends CoreBaseComponent {
  private readonly _logger: Logger;
  private readonly _metrics: MetricsCollector;
  private readonly _eventBus: NarEventBus;

  override get logger(): Logger {
    return this._logger;
  }

  override get metrics(): MetricsCollector {
    return this._metrics;
  }

  override get eventBus(): NarEventBus {
    return this._eventBus;
  }

  constructor(context?: Partial<CoreComponentContext>) {
    const logger: Logger = (context?.logger as Logger) ?? createLogger({ scope: 'Component' });
    const metrics: MetricsCollector =
      (context?.metrics as unknown as MetricsCollector) ?? new MetricsCollector();
    const eventBus: NarEventBus =
      (context?.eventBus as unknown as NarEventBus) ?? new NarEventBus();

    super({ logger, metrics, eventBus } as CoreComponentContext);

    this._logger = logger;
    this._metrics = metrics;
    this._eventBus = eventBus;
  }
}
