/**
 * One registration HOC, N domain wrappers (E3). `defineContribution` binds a
 * descriptor to a class, registers it in the provided registry, and defines the
 * custom element. Domain-specific `defineX` functions are thin wrappers that
 * pass the right registry and tag logic.
 */

import type { TemplateResult } from 'lit';
import { customElement } from 'lit/decorators.js';

import type { Contribution, TaggedContribution } from './contribution.js';
import { createRegistry, type Registry } from './registry.js';

/** A class that can receive a descriptor. The descriptor is attached after decoration. */
export interface DescribedClass<T = unknown> extends CustomElementConstructor {
  descriptor?: Contribution;
}

/** Options for `defineContribution`. */
export interface DefineContributionOptions<T extends Contribution = Contribution> {
  /** The registry to register into. */
  registry: Registry<string, T>;
  /** How to compute the custom-element tag from the descriptor. */
  tagOf: (descriptor: T) => string;
  /** Whether to define the custom element (default true). */
  defineElement?: boolean;
}

/**
 * Bind `descriptor` to `ctor`, register it, and define its custom element.
 * Returns the constructor for chaining.
 */
export function defineContribution<T extends Contribution, C extends DescribedClass = DescribedClass>(
  descriptor: T,
  ctor: C,
  options: DefineContributionOptions<T>
): C {
  // Bind descriptor to class
  ctor.descriptor = descriptor;

  // Register in domain registry
  options.registry.register(descriptor);

  // Define custom element if requested
  if (options.defineElement !== false) {
    const tag = options.tagOf(descriptor);
    if (typeof customElements !== 'undefined' && !customElements.get(tag)) {
      customElements.define(tag, ctor);
    }
  }

  return ctor;
}

/**
 * A domain-specific `defineX` creator. Given a registry, a tag function, and
 * the base class, returns a `defineX` function that validates the descriptor
 * shape and registers the component.
 */
export function createDefineContribution<T extends Contribution, C extends DescribedClass>(
  registry: Registry<string, T>,
  tagOf: (descriptor: T) => string,
  _BaseClass: new () => C
) {
  return function define(
    descriptor: T,
    ctor: C
  ): C {
    defineContribution(descriptor, ctor, { registry, tagOf });
    return ctor;
  };
}

/**
 * Convenience: create a `defineX` for tagged contributions (most common case).
 * Uses `descriptor.tag ?? \`s-${descriptor.id}\`` as tag.
 */
export function createDefineTagged<T extends TaggedContribution>(
  registry: Registry<string, T>,
  _BaseClass: new () => unknown
) {
  return function define<C extends DescribedClass>(
    descriptor: T,
    ctor: C
  ): C {
    defineContribution(descriptor, ctor, { registry, tagOf: (d) => d.tag ?? `s-${d.id}` });
    return ctor;
  };
}