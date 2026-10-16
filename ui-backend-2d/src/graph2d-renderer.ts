/**
 * Minimal contract-based 2D renderer (SpaceGraph-flavoured skeleton).
 * Demonstrates the full WorkspaceRenderer contract for the ecosystem package.
 */

import type {
  Cell,
  Patch,
  RendererContext,
  RendererSnapshot,
  SemanticBlock,
  IntentRef,
  SemanticLink,
  WorkspaceOp,
  WorkspaceRendererCaps,
  WorkspaceRenderer,
} from '@senars/ui-contract/core';
import type { FocusRef } from '@senars/ui-contract/framework';
import type { Channel } from '@senars/ui-contract/modulation';

export interface Graph2DRendererOptions {
  readonly id?: string;
  readonly label?: string;
}

export class Graph2DRenderer implements WorkspaceRenderer {
  readonly id: string;
  readonly label: string;

  private blocks: readonly SemanticBlock[] = [];
  private links: readonly SemanticLink[] = [];
  private patches: Patch[] = [];
  private selection: readonly string[] = [];
  private focusId: string | null = null;
  private readonly interactions: readonly string[] = [
    'compose',
    'stream',
    'artifacts',
    'inspect',
    'select-context',
    'embed',
  ];
  private readonly nodeChannels: Set<Channel>;
  private readonly edgeChannels: Set<Channel>;

  constructor(options: Graph2DRendererOptions = {}) {
    this.id = options.id ?? 'graph-2d';
    this.label = options.label ?? 'Graph 2D';
    this.nodeChannels = new Set<Channel>();
    this.edgeChannels = new Set<Channel>();
  }

  capabilities(): WorkspaceRendererCaps {
    return {
      interactions: this.interactions as unknown as WorkspaceRendererCaps['interactions'],
      blockKinds: 'all',
      parity: 'full',
      channels: { node: this.nodeChannels, edge: this.edgeChannels },
    } as WorkspaceRendererCaps;
  }

  mount(host: HTMLElement, _ctx: RendererContext): void {
    host.dataset.renderer = this.id;
  }

  present(blocks: readonly SemanticBlock[], links: readonly SemanticLink[]): void {
    this.blocks = blocks;
    this.links = links;
  }

  apply(ops: readonly WorkspaceOp[]): void {
    // Minimal: structural ops are coalesced; real renderer re-projects.
    void ops;
  }

  applyPatch(patch: Patch): void {
    this.patches.push(patch);
    if (patch.upsert) {
      const ids = new Set(this.blocks.map((b) => b.id));
      const next = [...this.blocks];
      for (const item of patch.upsert) {
        if (!ids.has(item.id)) {
          // Placeholder: a real backend maps ItemPatch → SemanticBlock.
          ids.add(item.id);
        }
      }
      this.blocks = next;
    }
    if (patch.remove) {
      const gone = new Set(patch.remove);
      this.blocks = this.blocks.filter((b) => !gone.has(b.id));
    }
  }

  focus(address: FocusRef): void {
    this.focusId = JSON.stringify(address);
  }

  select(ids: readonly string[]): void {
    this.selection = ids;
  }

  affordances(_anchor?: string): readonly IntentRef[] {
    return [];
  }

  invoke(intentId: string, args?: unknown): boolean {
    void intentId; void args;
    return false;
  }

  embed(cell: Cell, host: HTMLElement): void {
    host.dataset.embeddedCell = cell.focus?.kind ?? 'unknown';
  }

  snapshot(): RendererSnapshot {
    return {
      renderer: this.id,
      focus: this.focusId ?? undefined,
      selection: [...this.selection],
    };
  }

  restore(snap: RendererSnapshot): void {
    this.selection = snap.selection;
    if (snap.focus) {
      this.focusId = snap.focus;
    }
  }

  dispose(): void {
    // no-op
  }

  /** Test/introspection helpers. */
  getBlocks(): readonly SemanticBlock[] {
    return this.blocks;
  }
  getLinks(): readonly SemanticLink[] {
    return this.links;
  }
  getPatches(): readonly Patch[] {
    return this.patches;
  }
  getSelection(): readonly string[] {
    return this.selection;
  }
}
