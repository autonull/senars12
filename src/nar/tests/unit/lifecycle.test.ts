import {describe, it, expect, beforeEach, afterEach} from '@jest/globals';
import { BaseComponent } from '../../lifecycle/BaseComponent.js';
import { Container } from '../../lifecycle/Container.js';
import { createLogger } from '../../logger/index.js';
import { MetricsCollector } from '../../metrics/index.js';
import { EventBus } from '../../types/index.js';

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
    expect(component.state).toBe('created');

    await component.initialize();
    expect(component.state).toBe('initialized');

    await component.start();
    expect(component.state).toBe('started');

    await component.stop();
    expect(component.state).toBe('stopped');

    await component.dispose();
    expect(component.state).toBe('disposed');
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

  it('should provide logger, metrics, and eventBus', () => {
    const logger = createLogger({ scope: 'Test' });
    const metrics = new MetricsCollector();
    const eventBus = new EventBus();

    const component = new TestComponent({ logger, metrics, eventBus });

    expect(component.logger).toBe(logger);
    expect(component.metrics).toBe(metrics);
    expect(component.eventBus).toBe(eventBus);
  });

  it('should create default context if not provided', () => {
    const component = new TestComponent();
    expect(component.logger).toBeDefined();
    expect(component.metrics).toBeDefined();
    expect(component.eventBus).toBeDefined();
  });

  it('should prevent invalid state transitions', async () => {
    const component = new TestComponent();

    await expect(component.start()).rejects.toThrow('Cannot start component in state: created');
  });

  it('should allow dispose from any state', async () => {
    const component = new TestComponent();

    await component.initialize();
    await component.dispose();
    expect(component.state).toBe('disposed');
  });

  it('should handle double dispose gracefully', async () => {
    const component = new TestComponent();

    await component.initialize();
    await component.dispose();
    await component.dispose();
    expect(component.state).toBe('disposed');
  });

  it('should provide isRunning and isInitialized helpers', async () => {
    const component = new TestComponent();

    expect(component.isRunning()).toBe(false);
    expect(component.isInitialized()).toBe(false);

    await component.initialize();
    expect(component.isRunning()).toBe(false);
    expect(component.isInitialized()).toBe(true);

    await component.start();
    expect(component.isRunning()).toBe(true);
    expect(component.isInitialized()).toBe(true);

    await component.stop();
    expect(component.isRunning()).toBe(false);
    expect(component.isInitialized()).toBe(false);
  });
});

describe('Container', () => {
  it('should register and resolve components', async () => {
    const container = new Container();
    let componentInstance: TestComponent | undefined;

    container.register({
      name: 'test',
      type: 'component',
      factory: () => {
        componentInstance = new TestComponent();
        return componentInstance;
      }
    });

    await container.initialize('test');
    const component = container.get<TestComponent>('test');

    expect(component).toBe(componentInstance);
    expect(component.state).toBe('initialized');
  });

  it('should register and resolve values', async () => {
    const container = new Container();

    container.register({
      name: 'config',
      type: 'value',
      value: { foo: 'bar' }
    });

    const config = container.get<{ foo: string }>('config');
    expect(config.foo).toBe('bar');
  });

  it('should handle component dependencies', async () => {
    const container = new Container();
    const initOrder: string[] = [];

    container.register({
      name: 'dep1',
      type: 'component',
      factory: () => new TestComponent()
    });

    container.register({
      name: 'dep2',
      type: 'component',
      dependencies: ['dep1'],
      factory: () => new TestComponent()
    });

    await container.initialize('dep2');

    expect(container.isInitialized('dep1')).toBe(true);
    expect(container.isInitialized('dep2')).toBe(true);
  });

  it('should start components in dependency order', async () => {
    const container = new Container();

    container.register({
      name: 'a',
      type: 'component',
      factory: () => new TestComponent()
    });

    container.register({
      name: 'b',
      type: 'component',
      dependencies: ['a'],
      factory: () => new TestComponent()
    });

    await container.start('b');

    expect(container.get<TestComponent>('a').state).toBe('started');
    expect(container.get<TestComponent>('b').state).toBe('started');
  });

  it('should stop only the specified component', async () => {
    const container = new Container();

    container.register({
      name: 'a',
      type: 'component',
      factory: () => new TestComponent()
    });

    container.register({
      name: 'b',
      type: 'component',
      dependencies: ['a'],
      factory: () => new TestComponent()
    });

    await container.start('b');
    await container.stop('b');

    expect(container.get<TestComponent>('b').state).toBe('stopped');
    expect(container.get<TestComponent>('a').state).toBe('started');
  });

  it('should dispose all components', async () => {
    const container = new Container();

    container.register({
      name: 'test',
      type: 'component',
      factory: () => new TestComponent()
    });

    await container.initialize('test');
    await container.disposeAll();

    expect(container.has('test')).toBe(false);
  });

  it('should prevent duplicate registration', () => {
    const container = new Container();

    container.register({
      name: 'test',
      type: 'component',
      factory: () => new TestComponent()
    });

    expect(() => {
      container.register({
        name: 'test',
        type: 'component',
        factory: () => new TestComponent()
      });
    }).toThrow('already registered');
  });

  it('should throw on missing component', () => {
    const container = new Container();

    expect(() => container.get('missing')).toThrow('not found');
  });
});
