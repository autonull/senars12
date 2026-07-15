import type { EventLog } from '../eventlog/EventLog.js';
import type { ConfigView } from '../config/Config.js';
import type { CognitiveEvent } from '../events/EventTypes.js';
import type { Backend, BackendManifest } from './Backend.js';

export abstract class EventBackend implements Backend {
  abstract readonly id: string;
  abstract readonly manifest: BackendManifest;

  protected log!: EventLog;
  protected config!: ConfigView;

  async initialize(log: EventLog, config: ConfigView): Promise<void> {
    this.log = log;
    this.config = config;
    this.#startSubscription();
  }

  async shutdown(): Promise<void> {
    // subclasses override for engine cleanup
  }

  #startSubscription(): void {
    (async () => {
      for await (const event of this.log.subscribe({ types: [...this.manifest.handles] })) {
        await this.process(event);
      }
    })();
  }

  protected abstract process(event: CognitiveEvent): Promise<void>;
}
