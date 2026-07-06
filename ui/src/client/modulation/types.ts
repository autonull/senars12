export const CHANNELS = [
  'color',
  'opacity',
  'size',
  'label',
  'stroke.dash',
  'stroke.width',
  'z',
  'flow.enable',
  'line-style',
  'width',
  'edge-color',
] as const;

export type Channel = (typeof CHANNELS)[number];

export type ChannelValue = string | number | boolean;

export type Delta = Map<string, Partial<Record<Channel, ChannelValue>>>;

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
  | { op: 'channel'; channel: Channel; child: Modulation }
  | { op: 'when'; predicate: (item: Item, view: View) => boolean; child: Modulation }
  | { op: 'union'; children: Modulation[] }
  | { op: 'memo'; id: string; child: Modulation };
