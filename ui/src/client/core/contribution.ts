/**
 * The base descriptor every registrable thing extends (E1). All the domain-
 * specific descriptor interfaces (SurfaceDescriptor, OverlayDescriptor,
 * BlockDescriptor, PanelDef, RendererDef, GraphLayerDef, ConversationLayoutDescriptor,
 * LensDescriptor, ComposerModeDescriptor) share these common fields. This is the
 * SSOT for "what every contribution carries" — no more copying id/label/icon
 * across nine interfaces.
 *
 * Domain-specific interfaces extend this and add their own fields.
 */

export interface Contribution {
  /** Stable flat id: the test-API namespace, registry key, and by default the element suffix. */
  readonly id: string;
  /** Human title for palettes, stories and docs. */
  readonly label?: string;
  /** Icon name for tabs, toolbar, palette (matches `s-icon` names). */
  readonly icon?: string;
  /** Contact-sheet / palette grouping. */
  readonly group?: string;
}

/** A contribution that declares a custom-element tag. */
export interface TaggedContribution extends Contribution {
  /** Explicit custom-element tag when the element predates this contract. */
  readonly tag?: string;
}

/** A contribution that binds to store data. */
export interface BoundContribution extends Contribution {
  /** The data the contribution renders: watched on change and snapshotted by its reflective API. */
  readonly bindings?: Readonly<Record<string, unknown>>;
}

/** A contribution with an accessibility contract. */
export interface AccessibleContribution extends Contribution {
  /** The accessibility contract (role, name, keyboard path). */
  readonly a11y?: {
    /** ARIA role of the root (default `region`). */
    readonly role?: string;
    /** Accessible name (default the descriptor label). */
    readonly label?: string;
    /** Whether the contribution is reachable by keyboard; opting out needs a reason. */
    readonly keyboard?: boolean;
    /** Why keyboard access is not provided, when `keyboard` is false. */
    readonly keyboardReason?: string;
  };
}

/** A contribution gated by a capability. */
export interface GatedContribution extends Contribution {
  /** Capability required to offer or open this contribution; unmet => hidden/refused. */
  readonly capability?: string;
}