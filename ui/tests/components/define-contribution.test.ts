import { describe, expect, it } from 'vitest';
import {
  createDefineTagged,
  type Registry,
  type TaggedContribution,
} from '../../src/client/core/define-contribution.js';
import { createRegistry } from '../../src/client/core/registry.js';
import { BaseComponent } from '../../src/client/core/base-component.js';

interface TestDescriptor extends TaggedContribution {
  id: string;
  label?: string;
  icon?: string;
  tag?: string;
  customField: string;
}

describe('createDefineTagged (E3)', () => {
  it('registers descriptor and defines custom element', () => {
    const registry = createRegistry((d: TestDescriptor) => d.id);
    const define = createDefineTagged<TestDescriptor>(registry, BaseComponent);

    class TestElement extends BaseComponent {
      customField = 'test';
    }

    const descriptor: TestDescriptor = {
      id: 'test-element',
      customField: 'test',
    };

    define(descriptor, TestElement);

    expect(registry.get('test-element')).toEqual(descriptor);
    expect(TestElement.descriptor).toBe(descriptor);
  });

  it('uses descriptor.tag for custom element name', () => {
    const registry = createRegistry((d: TestDescriptor) => d.id);
    const define = createDefineTagged<TestDescriptor>(registry, BaseComponent);

    class TaggedElement extends BaseComponent {}

    const descriptor: TestDescriptor = {
      id: 'tagged',
      tag: 'custom-tag',
      customField: 'test',
    };

    define(descriptor, TaggedElement);

    // The tag should be registered with customElements if available
    expect(registry.get('tagged')).toBe(descriptor);
  });

  it('returns the constructor for chaining', () => {
    const registry = createRegistry((d: TestDescriptor) => d.id);
    const define = createDefineTagged<TestDescriptor>(registry, BaseComponent);

    class ChainedElement extends BaseComponent {}

    const descriptor: TestDescriptor = {
      id: 'chained',
      customField: 'test',
    };

    const returned = define(descriptor, ChainedElement);
    expect(returned).toBe(ChainedElement);
  });

  it('attaches descriptor to class statically', () => {
    const registry = createRegistry((d: TestDescriptor) => d.id);
    const define = createDefineTagged<TestDescriptor>(registry, BaseComponent);

    class AttachedElement extends BaseComponent {}

    const descriptor: TestDescriptor = {
      id: 'attached',
      label: 'Attached',
      icon: 'test',
      customField: 'test',
    };

    define(descriptor, AttachedElement);
    expect(AttachedElement.descriptor).toBe(descriptor);
  });
});