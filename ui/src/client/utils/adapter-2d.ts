import type { Core } from 'cytoscape';
import type { Channel, ChannelValue, Delta } from '../modulation/types.js';
import { RENDERER_CAPABILITIES } from './renderer-capabilities.js';
import { theme } from './theme.js';
import { TOKENS } from '../styles/tokens.generated.js';

const truthHueMin = Number(TOKENS.dark['colors.truth.hue-min']);
const truthHueMax = Number(TOKENS.dark['colors.truth.hue-max']);
const truthSaturation = TOKENS.dark['colors.truth.saturation'];
const truthLightness = TOKENS.dark['colors.truth.lightness'];

const confidenceOpacityMin = Number(TOKENS.dark['colors.confidence.opacity-min']);
const confidenceOpacityMax = Number(TOKENS.dark['colors.confidence.opacity-max']);

const prioritySizeMin = Number(TOKENS.dark['colors.priority.size-min']);
const prioritySizeMax = Number(TOKENS.dark['colors.priority.size-max']);

const truthToColor = (f: number): string =>
  `hsl(${Math.round(f * (truthHueMax - truthHueMin) + truthHueMin)}, ${truthSaturation}, ${truthLightness})`;
const priorityToSize = (p: number): number =>
  Math.round(p * (prioritySizeMax - prioritySizeMin) + prioritySizeMin);
const confidenceToOpacity = (c: number): number =>
  confidenceOpacityMin + (confidenceOpacityMax - confidenceOpacityMin) * c;

export const SUPPORT_2D = RENDERER_CAPABILITIES['2d'].node;
export const SUPPORT_2D_EDGES = RENDERER_CAPABILITIES['2d'].edge;

interface StyleChanges {
  'background-color'?: string;
  opacity?: number;
  width?: number;
  height?: number;
  label?: string;
  'border-style'?: string;
  'border-width'?: number;
  'border-color'?: string;
  'z-index'?: number;
  'line-style'?: string;
}

interface EdgeStyleChanges {
  width?: number;
  'line-color'?: string;
  'line-style'?: string;
  opacity?: number;
  'target-arrow-color'?: string;
}

function channelToStyles(channels: Partial<Record<Channel, ChannelValue>>): StyleChanges {
  const styles: StyleChanges = {};
  for (const [ch, value] of Object.entries(channels)) {
    if (!SUPPORT_2D.has(ch as Channel)) continue;
    switch (ch as Channel) {
      case 'color':
        if (typeof value === 'string') styles['background-color'] = value;
        break;
      case 'opacity':
        if (typeof value === 'number') styles.opacity = value;
        break;
      case 'size': {
        if (typeof value !== 'number') break;
        styles.width = value;
        styles.height = value;
        break;
      }
      case 'label':
        if (typeof value === 'string') styles.label = value;
        break;
      case 'stroke.dash':
        styles['border-style'] = 'dashed';
        break;
      case 'stroke.width':
        if (typeof value !== 'number') break;
        styles['border-width'] = value;
        styles['border-color'] = theme.colors.borderDefault;
        break;
      case 'z':
        if (typeof value === 'number') styles['z-index'] = Math.round(value);
        break;
    }
  }
  return styles;
}

function edgeChannelToStyles(channels: Partial<Record<Channel, ChannelValue>>): EdgeStyleChanges {
  const styles: EdgeStyleChanges = {};
  for (const [ch, value] of Object.entries(channels)) {
    if (!SUPPORT_2D_EDGES.has(ch as Channel)) continue;
    switch (ch as Channel) {
      case 'width':
        if (typeof value === 'number') styles.width = value;
        break;
      case 'edge-color':
      case 'color':
        if (typeof value === 'string') {
          styles['line-color'] = value;
          styles['target-arrow-color'] = value;
        }
        break;
      case 'line-style':
        if (typeof value === 'string') styles['line-style'] = value;
        break;
      case 'opacity':
        if (typeof value === 'number') styles.opacity = value;
        break;
    }
  }
  return styles;
}

export function applyDelta(cy: Core, delta: Delta): void {
  cy.batch(() => {
    for (const [id, channels] of delta) {
      const el = cy.getElementById(id);
      if (!el.length) continue;
      const isEdge = el.isEdge();
      const styles = isEdge ? edgeChannelToStyles(channels) : channelToStyles(channels);
      el.style(styles as Record<string, unknown>);
    }
  });
}

export function clearNodeStyles(cy: Core): void {
  cy.batch(() => {
    for (const node of cy.nodes()) {
      if (node.hasClass('workspace')) continue;
      
      const data = node.data();
      const priority = data.priority ?? 0.5;
      const confidence = data.confidence ?? 0.9;
      const truth = data.truth as { frequency?: number; confidence?: number } | undefined;
      const frequency = truth?.frequency ?? 0.5;
      const isContradiction = data.isContradiction === true;
      
      const baseColor = isContradiction ? theme.colors.error : truthToColor(frequency);
      const baseSize = priorityToSize(priority);
      const baseOpacity = confidenceToOpacity(confidence);
      
      node.style({
        'background-color': baseColor,
        opacity: baseOpacity,
        width: baseSize,
        height: baseSize,
        'border-width': isContradiction ? 3 : 0,
        'border-color': isContradiction ? theme.colors.error : 'transparent',
      });
    }
  });
}
