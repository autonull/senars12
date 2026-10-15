/**
 * Modulation types — the neutral contract for visual channels (§5).
 *
 * Channels are now open via `registerChannel` (channel-registry.ts). The
 * `Channel` type is a string so the core set remains typed while
 * allowing extension. `CHANNELS` tuple is kept for exhaustiveness in
 * internal switch statements but is no longer the source of truth.
 */

import { channelIds, registerCoreChannels, CORE_CHANNELS } from './channel-registry.js';

/** A modulation channel identifier — open registry, core channels are known. */
export type Channel = string;

/** The core channel IDs as a const tuple for exhaustiveness checking. */
export const CHANNELS = ['color', 'opacity', 'size', 'label', 'stroke.dash', 'stroke.width', 'z', 'flow.enable', 'line-style', 'width', 'edge-color'] as const;

/** Narrow a string to a Channel (core channels only — use for exhaustiveness). */
export const asChannel = (id: string): Channel => id;

/** Whether a string is a registered channel. */
export const isChannel = (id: string): boolean => channelIds().includes(id);

/** Ensure core channels are registered on first import. */
registerCoreChannels();

export type ChannelValue = string | number | boolean;

export type Delta = Map<string, Partial<Record<string, ChannelValue>>>;

export interface Item {
  id: string;
  priority: number;
  confidence: number;
  nodeType: string;
  isContradiction?: boolean;
  truth?: { frequency: number; confidence: number };
  occurrenceTime?: number;
  goalRelevance?: number;
  // Edge-specific fields (optional, only present for edge Items)
  source?: string;
  target?: string;
  edgeType?: string;
  weight?: number;
  directed?: boolean;
}

export interface ViewFlags {
  reducedMotion: boolean;
  highContrast: boolean;
  prefersColorScheme: 'light' | 'dark';
}

export interface View {
  flags: ViewFlags;
  timeline: { t: number; range?: [number, number] };
}

export interface Lens {
  id: string;
  label: string;
  description: string;
  modulation: Modulation;
}

export type Modulation =
  | { op: 'const'; value: ChannelValue }
  | { op: 'field'; field: keyof Item; map?: (v: unknown) => ChannelValue }
  | { op: 'channel'; channel: string; child: Modulation }
  | { op: 'when'; predicate: (item: Item, view: View) => boolean; child: Modulation }
  | { op: 'union'; children: Modulation[] }
  | { op: 'memo'; id: string; child: Modulation };