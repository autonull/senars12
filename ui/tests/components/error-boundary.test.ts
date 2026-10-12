import { afterEach, describe, expect, it, vi } from 'vitest';
import '../../src/client/components/error-boundary.js';
import {
  BudgetExhaustedError,
  CommandError,
  ConfigError,
  ConnectionError,
  EngineError,
  GateRejectedError,
  GraphRenderError,
  LayoutError,
  NetworkError,
  ProjectionError,
  StorageError,
  UnknownError,
  createError,
  type UiError,
} from '../../src/client/core/error-taxonomy.js';
import { eventBus } from '../../src/client/core/events.js';

const SAMPLES: UiError[] = [
  new ConnectionError(),
  new ConfigError(),
  new EngineError(),
  new BudgetExhaustedError('tokens'),
  new GateRejectedError('gate'),
  new ProjectionError(),
  new GraphRenderError(),
  new LayoutError(),
  new CommandError(),
  new StorageError(),
  new NetworkError(),
  new UnknownError(),
];

afterEach(() => {
  document.body.innerHTML = '';
  eventBus.clear();
});

describe('error taxonomy', () => {
  it('every error class owns a title and recovery actions, and createError preserves the title', () => {
    for (const error of SAMPLES) {
      expect(error.title.length).toBeGreaterThan(0);
      expect(error.getRecoveryActions().length).toBeGreaterThan(0);
      const rebuilt = createError(error.toJSON() as { code?: string; message: string });
      expect(rebuilt.title).toBe(error.title);
    }
  });

  it('gives each error class a distinct title', () => {
    const titles = SAMPLES.map((error) => error.title);
    expect(new Set(titles).size).toBe(titles.length);
  });
});

describe('error boundary', () => {
  it('surfaces an eventBus error with its title, code and recovery actions', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const boundary = document.createElement('error-boundary') as HTMLElement & {
      updateComplete: Promise<unknown>;
    };
    document.body.appendChild(boundary);
    await boundary.updateComplete;

    eventBus.emit('app-error', { message: 'lost', error: new ConnectionError('lost').toJSON() });
    await boundary.updateComplete;

    const text = boundary.shadowRoot?.textContent ?? '';
    expect(text).toContain('Connection Lost');
    expect(text).toContain('CONNECTION_ERROR');
    expect(text).toContain('Retry');
    spy.mockRestore();
  });
});
