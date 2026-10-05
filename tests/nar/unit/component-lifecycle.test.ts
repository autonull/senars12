import { createLogger } from '@senars/util';
import { describe, expect, it } from 'vitest';
import { BaseComponent } from '@senars/core';
import { EventBus } from '@senars/util/events';

class TestComponent extends BaseComponent {
  public initializeCount = 0;
  public startCount = 0;
  public stopCount = 0;
  public disposeCount = 0;

  override async initialize(): Promise<void> {
    await super.initialize();
    this.initializeCount++;
  }

  override async start(): Promise<void> {
    await super.start();
    this.startCount++;
  }

  override async stop(): Promise<void> {
    await super.stop();
    this.stopCount++;
  }

  override async dispose(): Promise<void> {
    await super.dispose();
    this.disposeCount++;
  }
}

describe('BaseComponent', () => {
  it('should start in created state', () => {
    const component = new TestComponent();
    expect(component.state).toBe('created');
  });

  it('should transition through valid states', async () => {
    const component = new TestComponent();

    await component.initialize();
    expect(component.state).toBe('initialized');

    await component.start();
    expect(component.state).toBe('started');

    await component.stop();
    expect(component.state).toBe('stopped');
  });

  it('should track lifecycle method calls', async () => {
    const component = new TestComponent();

    await component.initialize();
    expect(component.initializeCount).toBe(1);

    await component.start();
    expect(component.startCount).toBe(1);

    await component.stop();
    expect(component.stopCount).toBe(1);

    await component.dispose();
    expect(component.disposeCount).toBe(1);
  });

  it('should provide logger and eventBus', () => {
    const logger = createLogger({ scope: 'Test' });
    const eventBus = new EventBus();

    const component = new TestComponent({ logger, eventBus });

    expect(component.logger).toBe(logger);
    expect(component.eventBus).toBe(eventBus);
  });

  it('should have undefined context if not provided', () => {
    const component = new TestComponent();
    expect(component.logger).toBeUndefined();
    expect(component.eventBus).toBeUndefined();
  });

  it('should expose state getter', () => {
    const component = new TestComponent();
    expect(component.state).toBe(component.state);
  });

  it('should allow dispose from any state', async () => {
    const component = new TestComponent();

    await component.initialize();
    await component.dispose();
    expect(component.state).toBe('disposed');
  });

  it('should treat stop on a never-started component as a no-op', async () => {
    const component = new TestComponent();

    await component.initialize();
    await component.stop();
    expect(component.state).toBe('initialized');
  });

  it('should treat a second stop as a no-op', async () => {
    const component = new TestComponent();

    await component.initialize();
    await component.start();
    await component.stop();
    await component.stop();
    expect(component.state).toBe('stopped');
  });

  it('should dispose a component that was never started', async () => {
    const component = new TestComponent();

    await component.initialize();
    await component.dispose();
    expect(component.state).toBe('disposed');
    expect(component.stopCount).toBe(0);
  });

  it('should handle double dispose gracefully', async () => {
    const component = new TestComponent();

    await component.initialize();
    await component.dispose();
    await component.dispose();
    expect(component.state).toBe('disposed');
  });
});
