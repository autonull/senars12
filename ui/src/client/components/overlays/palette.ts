/**
 * The command palette (§3.5, Phase 0.5): ⌘K over the workspace. It lists
 * `activeCommands()` — derived from the renderer/overlay registries — with fuzzy
 * filtering and arrow-key/Enter execution, and runs through the same overlay
 * host as every other overlay. Reset on each open via the `overlay-open` event
 * the host dispatches.
 */

import { css, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { activeCommands, type Command } from '../../core/commands.js';
import { matchCommands } from '../../core/command-match.js';
import { eventBus } from '../../core/events.js';
import { registerOverlay } from '../../core/overlay-registry.js';
import { $activeRenderer } from '../../core/store.js';
import { surfaceTag } from '../../core/surface-registry.js';
import { defineSurface, SurfaceComponent } from '../../core/surface.js';

interface Row {
  readonly command: Command;
  readonly index: number;
}

@customElement('s-palette')
export class PaletteView extends SurfaceComponent {
  static override styles = css`
    :host { position: fixed; top: 12vh; left: 50%; transform: translateX(-50%); width: min(620px, 92vw); z-index: 1; }
    :host([hidden]) { display: none; }
    .palette { display: flex; flex-direction: column; max-height: 66vh; background: var(--colors-semantic-bg-panel-solid); border: 1px solid var(--colors-semantic-border-subtle); border-radius: var(--borderRadius-component-panel); box-shadow: var(--shadows-panel); overflow: hidden; }
    input { border: none; outline: none; padding: var(--spacing-scale-3); background: transparent; color: var(--colors-semantic-text-primary); font-family: var(--typography-fontFamilies-ui); font-size: var(--typography-scale-base); border-bottom: 1px solid var(--colors-semantic-border-subtle); }
    ul { list-style: none; margin: 0; padding: var(--spacing-scale-1); overflow: auto; }
    .group { padding: var(--spacing-scale-2) var(--spacing-scale-2) var(--spacing-scale-1); text-transform: uppercase; letter-spacing: 0.06em; font-size: var(--typography-scale-xs); color: var(--colors-semantic-text-muted); }
    .command { display: block; width: 100%; text-align: left; border: none; border-radius: 4px; padding: var(--spacing-scale-2); background: transparent; color: var(--colors-semantic-text-primary); cursor: pointer; font-family: var(--typography-fontFamilies-ui); font-size: var(--typography-scale-sm); }
    .command[aria-selected='true'] { background: var(--colors-semantic-bg-subtle); outline: 1px solid var(--colors-semantic-accent-cyan); }
    .empty { padding: var(--spacing-scale-4); text-align: center; color: var(--colors-semantic-text-muted); font-size: var(--typography-scale-sm); }
    footer { padding: var(--spacing-scale-1) var(--spacing-scale-3); border-top: 1px solid var(--colors-semantic-border-subtle); color: var(--colors-semantic-text-muted); font-family: var(--typography-fontFamilies-data); font-size: var(--typography-scale-xs); }
  `;

  @state() private query = '';
  @state() private active = 0;

  override connectedCallback(): void {
    super.connectedCallback();
    this.watch($activeRenderer);
    this.addEventListener('overlay-open', this.reset);
  }

  override disconnectedCallback(): void {
    this.removeEventListener('overlay-open', this.reset);
    super.disconnectedCallback();
  }

  protected override renderBody() {
    const shown = matchCommands(activeCommands(), this.query);
    const groups = new Map<string, Row[]>();
    shown.forEach((command, index) => {
      const rows = groups.get(command.group) ?? [];
      rows.push({ command, index });
      groups.set(command.group, rows);
    });
    return html`
      <div class="palette" role="dialog" aria-label="Command palette">
        <input
          type="text"
          role="combobox"
          aria-expanded="true"
          aria-controls="palette-list"
          placeholder="Type a command…"
          .value=${this.query}
          @input=${this.onInput}
          @keydown=${this.onKeyDown}
        />
        ${
          shown.length > 0
            ? html`<ul id="palette-list" role="listbox" aria-label="Commands">
                ${[...groups].map(
                  ([group, rows]) => html`
                    <li class="group" role="presentation">${group}</li>
                    ${rows.map((row) => this.commandRow(row))}
                  `
                )}
              </ul>`
            : html`<p class="empty">No matching commands</p>`
        }
        <footer>↑↓ navigate · ↵ run · esc close</footer>
      </div>
    `;
  }

  private commandRow({ command, index }: Row) {
    return html`
      <li role="presentation">
        <button
          class="command"
          role="option"
          data-id=${command.id}
          data-index=${index}
          aria-selected=${index === this.active}
          @mousemove=${() => (this.active = index)}
          @click=${() => this.run(command)}
        >${command.title}</button>
      </li>
    `;
  }

  private onInput(event: Event) {
    this.query = (event.target as HTMLInputElement).value;
    this.active = 0;
  }

  private onKeyDown(event: KeyboardEvent) {
    const shown = matchCommands(activeCommands(), this.query);
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.active = Math.min(this.active + 1, shown.length - 1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.active = Math.max(this.active - 1, 0);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const command = shown[this.active];
      if (command) this.run(command);
    }
  }

  private run(command: Command) {
    eventBus.emit('overlay:close', { id: 'palette' });
    command.run();
  }

  private readonly reset = () => {
    this.query = '';
    this.active = 0;
    void this.updateComplete.then(() =>
      this.shadowRoot?.querySelector<HTMLInputElement>('input')?.focus()
    );
  };
}

const PALETTE_SURFACE = { id: 'palette', title: 'Command palette', group: 'overlay' } as const;

defineSurface(PALETTE_SURFACE, PaletteView);
registerOverlay({
  id: PALETTE_SURFACE.id,
  title: PALETTE_SURFACE.title,
  tag: surfaceTag(PALETTE_SURFACE),
  hiddenInPalette: true,
});

declare global {
  interface HTMLElementTagNameMap {
    's-palette': PaletteView;
  }
}
