import type { TemplateResult } from 'lit';
import { html } from 'lit';
import { BaseComponent } from './base-component.js';
import { registerSurface, surfaceTag, type SurfaceDescriptor, type SurfaceSource } from './surface-registry.js';
import { mountTestApi } from './store.js';

export type {
  SurfaceBinding,
  SurfaceDescriptor,
  SurfaceSource,
} from './surface-registry.js';

/**
 * The reflective surface contract. A product surface declares a descriptor and
 * implements only `renderBody`; this module owns the rest — custom-element
 * registration (`defineSurface`), declarative store bindings, the
 * loading/empty/error/ready slots, and a test API derived from the same
 * descriptor. One descriptor, so Playwright, the gallery, Storybook and docs
 * read the same contract instead of each surface hand-wiring six files.
 */

/** The honest lifecycle of a data-backed surface. */
export type SurfaceState = 'loading' | 'empty' | 'error' | 'ready';

export type SurfaceTestApi = Record<string, unknown>;

/**
 * The base of every product surface. Subclasses declare their descriptor via
 * `defineSurface`, render their ready body in `renderBody`, and report their
 * lifecycle through `surfaceState`; store bindings, the empty/loading/error
 * slots and the reflective API all derive from the descriptor.
 */
export abstract class SurfaceComponent extends BaseComponent {
  static descriptor?: SurfaceDescriptor;

  /** Surface-specific test hooks, merged over the derived `{ descriptor, state, snapshot }`. */
  protected surfaceApi(): SurfaceTestApi | undefined {
    return undefined;
  }

  /** The slot to render; a surface overrides this to reflect its source. */
  protected surfaceState(): SurfaceState {
    return 'ready';
  }

  protected renderLoading(): TemplateResult {
    return html``;
  }

  protected renderEmpty(): TemplateResult {
    return html``;
  }

  protected renderError(): TemplateResult {
    return html``;
  }

  /** The ready body — the only render method a surface implements. */
  protected abstract renderBody(): TemplateResult;

  override render(): TemplateResult {
    switch (this.surfaceState()) {
      case 'loading':
        return this.renderLoading();
      case 'empty':
        return this.renderEmpty();
      case 'error':
        return this.renderError();
      default:
        return this.renderBody();
    }
  }

  override connectedCallback(): void {
    super.connectedCallback();
    const descriptor = (this.constructor as typeof SurfaceComponent).descriptor;
    if (!descriptor) return;
    const { bindings } = descriptor;
    for (const binding of Object.values(bindings ?? {})) this.watch(binding);
    mountTestApi(descriptor.id, {
      descriptor: { id: descriptor.id, title: descriptor.title },
      state: () => this.surfaceState(),
      ...(bindings ? { snapshot: () => snapshot(bindings) } : {}),
      ...(this.surfaceApi() ?? {}),
    });
  }
}

function snapshot(bindings: Readonly<Record<string, SurfaceSource>>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(bindings).map(([key, source]) => [key, source.get()]));
}

export type SurfaceClass<T extends SurfaceComponent = SurfaceComponent> = (new () => T) & {
  descriptor?: SurfaceDescriptor;
};

/**
 * Bind a descriptor to a surface class and define its custom element once.
 * Registration, store bindings and the reflective API all derive from the
 * descriptor, so a new surface is a descriptor + `renderBody`.
 */
export function defineSurface<T extends SurfaceComponent>(
  descriptor: SurfaceDescriptor,
  ctor: SurfaceClass<T>
): SurfaceClass<T> {
  ctor.descriptor = descriptor;
  registerSurface(descriptor);
  const tag = surfaceTag(descriptor);
  if (typeof customElements !== 'undefined' && !customElements.get(tag)) {
    customElements.define(tag, ctor);
  }
  return ctor;
}