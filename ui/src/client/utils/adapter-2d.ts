import type { Core } from 'cytoscape';
import type { Channel, ChannelValue, Delta } from '../modulation/types.js';
import { TOKEN_COLORS } from './token-colors.js';

export const SUPPORT_2D: Set<Channel> = new Set([
  'color', 'opacity', 'size', 'label', 'stroke.dash', 'stroke.width', 'z',
  'line-style', 'width', 'edge-color',
]);

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

function channelToStyles(id: string, channels: Partial<Record<Channel, ChannelValue>>): StyleChanges {
  const styles: StyleChanges = {};
  for (const [ch, value] of Object.entries(channels)) {
    switch (ch as Channel) {
      case 'color':
        styles['background-color'] = value as string;
        break;
      case 'opacity':
        styles.opacity = value as number;
        break;
      case 'size': {
        const s = value as number;
        styles.width = s;
        styles.height = s;
        break;
      }
      case 'label':
        styles.label = value as string;
        break;
      case 'stroke.dash':
        styles['border-style'] = 'dashed';
        break;
      case 'stroke.width':
        styles['border-width'] = value as number;
        styles['border-color'] = TOKEN_COLORS.borderDefault;
        break;
      case 'z':
        styles['z-index'] = Math.round(value as number);
        break;
    }
  }
  return styles;
}

function edgeChannelToStyles(id: string, channels: Partial<Record<Channel, ChannelValue>>): EdgeStyleChanges {
  const styles: EdgeStyleChanges = {};
  for (const [ch, value] of Object.entries(channels)) {
    switch (ch as Channel) {
      case 'width':
        styles.width = value as number;
        break;
      case 'edge-color':
      case 'color':
        styles['line-color'] = value as string;
        styles['target-arrow-color'] = value as string;
        break;
      case 'line-style':
        styles['line-style'] = value as string;
        break;
      case 'opacity':
        styles.opacity = value as number;
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
      const styles = isEdge ? edgeChannelToStyles(id, channels) : channelToStyles(id, channels);
      el.style(styles as Record<string, unknown>);
    }
  });
}

export function clearNodeStyles(cy: Core): void {
  cy.batch(() => {
    for (const node of cy.nodes()) {
      node.style({
        'background-color': TOKEN_COLORS.accentCyan,
        opacity: 0.15,
        width: 30,
        height: 30,
        'border-style': 'none',
        'border-width': 0,
      });
    }
  });
}
