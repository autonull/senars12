/**
 * Ambient layer — a weighted sample of low-attention foci rendered as glyphs
 * in the graph background (§13, §16 Step 4). Uses the attention field's
 * `sampleMany(budget)` to pick foci proportionally to their residual weight.
 */

import { css, html, nothing, TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { BaseComponent } from '../core/base-component.js';
import { $workspaceGraph } from '../core/store.js';
import { type SemanticBlock } from '../core/workspace-graph.js';
import {
  sampleAmbientMany,
  type AttentionItem,
  attendFocus,
  type FocusRef,
  focus,
  MIND_FOCUS,
} from '../framework/index.js';
import './primitives/icon.js';

const AMBIENT_BUDGET = 20;
const AMBIENT_REFRESH_MS = 5000;

@customElement('s-ambient-layer')
export class SAmbientLayer extends BaseComponent {
  static override styles = css`
    :host {
      position: absolute;
      inset: 0;
      pointer-events: none;
      z-index: 0;
      overflow: hidden;
    }
    .glyph {
      position: absolute;
      color: var(--colors-semantic-text-muted);
      opacity: 0.3;
      white-space: nowrap;
      user-select: none;
      transform: translate(-50%, -50%);
      pointer-events: none;
      transition: opacity var(--transitions-fast);
    }
    .glyph:hover {
      opacity: 0.6;
    }
    .glyph s-icon {
      display: block;
    }
  `;

  @property({ type: Number }) budget = AMBIENT_BUDGET;
  @property({ type: Number }) refreshMs = AMBIENT_REFRESH_MS;

  @state() private samples: AttentionItem[] = [];
  private refreshTimer: number | null = null;

  override connectedCallback(): void {
    super.connectedCallback();
    this.watch($workspaceGraph);
    this.refresh();
    this.refreshTimer = window.setInterval(() => this.refresh(), this.refreshMs);
  }

  override disconnectedCallback(): void {
    if (this.refreshTimer !== null) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
    super.disconnectedCallback();
  }

  private refresh(): void {
    const items = sampleAmbientMany(this.budget);
    if (!items.length) {
      this.samples = [];
      return;
    }
    // Attend each sampled focus at ambient weight so they stay in the field
    for (const item of items) {
      attendFocus(item.focus, 'ambient', item.priority * 0.5);
    }
    this.samples = items;
  }

  /** Extract the workspace block ID from a FocusRef, if it has one. */
  private blockIdFromFocus(focus: FocusRef): string | undefined {
    switch (focus.kind) {
      case 'derivation':
      case 'proposal':
      case 'judgment':
      case 'turn':
      case 'event':
      case 'cycle':
      case 'space':
        return focus.id;
      case 'step':
        return focus.derivationId;
      case 'trace':
        return focus.correlationId;
      case 'concept':
      case 'task':
      case 'goal':
        // Term-backed — not a single block ID
        return undefined;
      case 'time':
      case 'drive':
      case 'mind':
        return undefined;
      default:
        return undefined;
    }
  }

  private iconForBlock(block: SemanticBlock): string {
    switch (block.kind) {
      case 'turn': return 'play';
      case 'claim': return 'circle';
      case 'goal': return 'chart';
      case 'question': return 'help';
      case 'answer': return 'check';
      case 'derivation': return 'tool';
      case 'derivation-record': return 'minus';
      case 'gate-decision': return 'lightning';
      case 'config-change': return 'settings';
      case 'command': return 'play';
      case 'error': return 'warningTriangle';
      case 'budget': return 'history';
      default: return 'circle';
    }
  }

  private renderGlyph(item: AttentionItem, graph: ReturnType<typeof $workspaceGraph.get>): TemplateResult | typeof nothing {
    const blockId = this.blockIdFromFocus(item.focus);
    if (!blockId) return nothing;

    const block = graph.blocks.get(blockId);
    if (!block) return nothing;

    // Deterministic pseudo-random position from block ID hash
    const hash = this.hashString(blockId);
    const x = 10 + (hash % 90);
    const y = 10 + ((hash >> 8) % 90);

    const iconName = this.iconForBlock(block);
    return html`
      <span
        class="glyph"
        style="left: ${x}%; top: ${y}%"
        title="${block.title ?? block.id} [${item.priority.toFixed(2)}]"
      >
        <s-icon name=${iconName} size="12"></s-icon>
      </span>
    `;
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  }

  protected override render(): TemplateResult {
    const graph = $workspaceGraph.get();
    return html`
      ${this.samples.map((item) => this.renderGlyph(item, graph))}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    's-ambient-layer': SAmbientLayer;
  }
}