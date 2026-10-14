/**
 * App shell — the universal container for a SeNARS app.
 *
 * Mounts surfaces by placement, provides connection management,
 * and exposes the test API for e2e.
 */

import { css, html, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { connect, disconnect, mountWorkspaceProjection } from '../kernel/index.js';
import { BaseComponent } from '../core/base-component.js';
import { appFor, type AppDescriptor, type ConnectionConfig, APP_SHELL_TAG } from '../framework/app.js';
import { type Placement, type SurfaceDescriptor, surfaceTag } from '../framework/surface.js';

/** The workspace projection binds global atoms; mount it once per page, not per shell. */
let workspaceProjectionMounted = false;

@customElement(APP_SHELL_TAG)
export class AppShell extends BaseComponent {
  static override styles = css`
    :host {
      display: block;
      height: 100vh;
      background: var(--colors-semantic-bg-base);
      color: var(--colors-semantic-text-primary);
    }
    .viewport {
      width: 100%;
      height: 100%;
      position: relative;
    }
    .panels {
      position: absolute;
      inset: 0;
      pointer-events: none;
      z-index: 10;
    }
    .panel-dock {
      pointer-events: auto;
    }
    .panel-dock.left {
      left: 0;
      top: 0;
      bottom: 0;
      display: flex;
      flex-direction: column;
    }
    .panel-dock.right {
      right: 0;
      top: 0;
      bottom: 0;
      display: flex;
      flex-direction: column;
    }
    .panel-dock.bottom {
      bottom: 0;
      left: 0;
      right: 0;
      display: flex;
      flex-direction: row;
    }
    .overlays {
      position: fixed;
      inset: 0;
      z-index: 100;
      pointer-events: none;
    }
    .overlay {
      pointer-events: auto;
    }
    .inline {
      display: contents;
    }
    slot[name='viewport'] {
      display: block;
      width: 100%;
      height: 100%;
    }
    ::slotted([slot='viewport']) {
      display: block;
      width: 100%;
      height: 100%;
    }
    ::slotted([slot='panel']) {
      display: block;
    }
    ::slotted([slot='overlay']) {
      display: block;
      position: fixed;
      inset: 0;
      z-index: 100;
    }
  `;

  @property({ attribute: 'app-id' }) appId = '';
  @property({ attribute: 'auto-connect' }) autoConnect = true;

  @state() private connectionState: 'disconnected' | 'connecting' | 'connected' = 'disconnected';
  @state() private mounted = false;

  private app: AppDescriptor | undefined;

  override connectedCallback(): void {
    super.connectedCallback();
    if (!workspaceProjectionMounted) {
      workspaceProjectionMounted = true;
      mountWorkspaceProjection();
    }
    this.resolveAppWithRetry();
  }

  override disconnectedCallback(): void {
    this.disconnectApp();
    super.disconnectedCallback();
  }

  private resolveAppWithRetry(attempt = 0): void {
    if (!this.appId) {
      console.warn('[AppShell] No app-id provided');
      return;
    }
    this.app = appFor(this.appId);
    if (!this.app) {
      if (attempt < 50) {
        // Retry every 50ms for up to 2.5 seconds
        setTimeout(() => this.resolveAppWithRetry(attempt + 1), 50);
      } else {
        console.error(`[AppShell] App not found after retries: ${this.appId}`);
      }
      return;
    }
    this.mountSurfaces();
    if (this.autoConnect) {
      this.connectApp();
    }
  }

  private mountSurfaces(): void {
    if (!this.app) return;

    for (const surface of this.getAllSurfaces()) {
      const tag = surfaceTag(surface);
      const element = document.createElement(tag);
      element.setAttribute('slot', surface.placement ?? 'viewport');
      this.appendChild(element);
    }

    this.mounted = true;
  }

  private getAllSurfaces(): SurfaceDescriptor[] {
    if (!this.app) return [];
    const all: SurfaceDescriptor[] = [];
    for (const placement of ['viewport', 'panel', 'overlay', 'inline'] as const) {
      const surfaces = this.app.surfaces[placement];
      if (surfaces) all.push(...surfaces);
    }
    return all;
  }

  private async connectApp(): Promise<void> {
    if (!this.app) return;

    this.connectionState = 'connecting';

    try {
      await connect();
      this.connectionState = 'connected';
    } catch (error) {
      console.error('[AppShell] Connection failed:', error);
      this.connectionState = 'disconnected';
    }
  }

  private async disconnectApp(): Promise<void> {
    if (this.connectionState === 'connected') {
      await disconnect();
      this.connectionState = 'disconnected';
    }
  }

  protected override render(): TemplateResult {
    return html`
      <div class="viewport">
        <slot name="viewport"></slot>
      </div>
      <div class="panels">
        <slot name="panel"></slot>
        <div class="panel-dock left"></div>
        <div class="panel-dock right"></div>
        <div class="panel-dock bottom"></div>
      </div>
      <div class="overlays">
        <slot name="overlay"></slot>
      </div>
      <slot name="inline" class="inline"></slot>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    's-app-shell': AppShell;
  }
}