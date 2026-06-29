import { ConfigurationError } from '../types';
import { BaseComponent } from './BaseComponent.js';

export interface ComponentDefinition {
  name: string;
  type: 'component';
  dependencies?: string[];
  factory: (container: Container) => BaseComponent | Promise<BaseComponent>;
}

export interface ValueDefinition {
  name: string;
  type: 'value';
  value: unknown;
}

export type Definition = ComponentDefinition | ValueDefinition;

export class Container {
  private definitions: Map<string, Definition> = new Map();
  private instances: Map<string, BaseComponent | unknown> = new Map();
  private initialized: Set<string> = new Set();

  register(_definition: ComponentDefinition | ValueDefinition): void {
    if (this.definitions.has(_definition.name)) {
      throw new ConfigurationError(
        `Component or value '${_definition.name}' is already registered`,
        { name: _definition.name }
      );
    }
    this.definitions.set(_definition.name, _definition);
  }

  get<T>(name: string): T {
    if (this.instances.has(name)) {
      return this.instances.get(name) as T;
    }

    const definition = this.definitions.get(name);
    if (!definition) {
      throw new ConfigurationError(`Component or value '${name}' not found`, { name });
    }

    if (definition.type === 'value') {
      this.instances.set(name, definition.value);
      return definition.value as T;
    }

    throw new ConfigurationError(`Component '${name}' must be initialized before use`, { name });
  }

  async initialize(name: string): Promise<void> {
    if (this.initialized.has(name)) {
      return;
    }

    const definition = this.definitions.get(name);
    if (!definition) {
      throw new ConfigurationError(`Component '${name}' not found`, { name });
    }

    if (definition.type === 'value') {
      this.initialized.add(name);
      return;
    }

    if (definition.dependencies) {
      for (const dep of definition.dependencies) {
        await this.initialize(dep);
      }
    }

    const instance = await definition.factory(this);
    this.instances.set(name, instance);

    if (instance instanceof BaseComponent) {
      await instance.initialize();
    }

    this.initialized.add(name);
  }

  async start(name: string): Promise<void> {
    const definition = this.definitions.get(name);
    if (definition && definition.type === 'component' && definition.dependencies) {
      for (const dep of definition.dependencies) {
        await this.start(dep);
      }
    }

    await this.initialize(name);
    const instance = this.get(name);
    if (instance instanceof BaseComponent) {
      await instance.start();
    }
  }

  async stop(name: string): Promise<void> {
    const instance = this.get(name);
    if (instance instanceof BaseComponent) {
      await instance.stop();
    }
  }

  async dispose(name: string): Promise<void> {
    const instance = this.get(name);
    if (instance instanceof BaseComponent) {
      await instance.dispose();
    }
    this.instances.delete(name);
    this.initialized.delete(name);
  }

  async initializeAll(): Promise<void> {
    const names = Array.from(this.definitions.keys());
    for (const name of names) {
      await this.initialize(name);
    }
  }

  async startAll(): Promise<void> {
    const names = Array.from(this.definitions.keys());
    for (const name of names) {
      await this.start(name);
    }
  }

  async stopAll(): Promise<void> {
    const names = Array.from(this.definitions.keys());
    for (const name of names.reverse()) {
      await this.stop(name);
    }
  }

  async disposeAll(): Promise<void> {
    const names = Array.from(this.definitions.keys());
    for (const name of names.reverse()) {
      await this.dispose(name);
    }
    this.definitions.clear();
    this.instances.clear();
    this.initialized.clear();
  }

  has(name: string): boolean {
    return this.definitions.has(name);
  }

  isInitialized(name: string): boolean {
    return this.initialized.has(name);
  }
}
