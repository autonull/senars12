/**
 * Design primitives catalog — design tokens as contributions.
 *
 * Replaces scattered design token definitions with a single catalog.
 * The settings UI, the theming system, the docs and the gallery
 * derive from one source, and a new design primitive is one entry.
 */

import type { Contribution } from '../framework/contribution.js';

/** Design primitive kind. */
export type DesignPrimitiveKind = 'color' | 'spacing' | 'typography' | 'border' | 'shadow' | 'motion' | 'z-index' | 'breakpoint';

/** Design primitive descriptor — extends Contribution with design-specific fields. */
export interface DesignPrimitiveDescriptor extends Contribution<Record<string, unknown>> {
  readonly kind: DesignPrimitiveKind;
  /** CSS custom property name (e.g., '--colors-semantic-bg-base'). */
  readonly cssProperty: string;
  /** Default value. */
  readonly defaultValue: string;
  /** Whether this primitive is semantic (maps to a semantic role) or raw. */
  readonly semantic?: boolean;
  /** Semantic role (if semantic). */
  readonly semanticRole?: string;
  /** Category for grouping in UI. */
  readonly category?: string;
}

/** Registry of design primitives. */
const designPrimitiveRegistry = new Map<string, DesignPrimitiveDescriptor>();

/** Register a design primitive. */
export function registerDesignPrimitive(descriptor: DesignPrimitiveDescriptor): void {
  if (designPrimitiveRegistry.has(descriptor.id)) {
    throw new Error(`Design primitive with id "${descriptor.id}" already registered`);
  }
  designPrimitiveRegistry.set(descriptor.id, descriptor);
}

/** Get a design primitive by id. */
export function designPrimitiveFor(id: string): DesignPrimitiveDescriptor | undefined {
  return designPrimitiveRegistry.get(id);
}

/** All registered design primitives. */
export function getDesignPrimitives(): readonly DesignPrimitiveDescriptor[] {
  return [...designPrimitiveRegistry.values()];
}

/** All design primitive ids. */
export function designPrimitiveIds(): readonly string[] {
  return [...designPrimitiveRegistry.keys()];
}

/** Design primitives by kind. */
export function designPrimitivesByKind(kind: DesignPrimitiveKind): readonly DesignPrimitiveDescriptor[] {
  return getDesignPrimitives().filter((p) => p.kind === kind);
}

/** Design primitives by category. */
export function designPrimitivesByCategory(category: string): readonly DesignPrimitiveDescriptor[] {
  return getDesignPrimitives().filter((p) => p.category === category);
}

/** All categories. */
export function designPrimitiveCategories(): readonly string[] {
  const categories = new Set<string>();
  for (const primitive of getDesignPrimitives()) {
    if (primitive.category) categories.add(primitive.category);
  }
  return [...categories];
}

/** Reset design primitive registry (for testing). */
export function resetDesignPrimitives(): void {
  designPrimitiveRegistry.clear();
}

/** Build CSS custom properties from design primitives. */
export function buildCSSProperties(): Record<string, string> {
  const props: Record<string, string> = {};
  for (const primitive of getDesignPrimitives()) {
    props[primitive.cssProperty] = primitive.defaultValue;
  }
  return props;
}

/** Validate design primitives. */
export function validateDesignPrimitives(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const seenProperties = new Map<string, string>();

  for (const primitive of getDesignPrimitives()) {
    if (!primitive.cssProperty.startsWith('--')) {
      errors.push(`Design primitive ${primitive.id}: cssProperty must start with '--'`);
    }
    if (seenProperties.has(primitive.cssProperty)) {
      errors.push(`Duplicate CSS property ${primitive.cssProperty}: ${primitive.id} and ${seenProperties.get(primitive.cssProperty)}`);
    }
    seenProperties.set(primitive.cssProperty, primitive.id);
  }
  return { valid: errors.length === 0, errors };
}

// Register built-in design primitives
const BUILTIN_DESIGN_PRIMITIVES: DesignPrimitiveDescriptor[] = [
  // Colors - Semantic
  {
    id: 'color.bg.base',
    label: 'Background Base',
    kind: 'color',
    cssProperty: '--colors-semantic-bg-base',
    defaultValue: '#0b1020',
    semantic: true,
    semanticRole: 'bg-base',
    category: 'background',
    facets: {},
  },
  {
    id: 'color.bg.panel',
    label: 'Background Panel',
    kind: 'color',
    cssProperty: '--colors-semantic-bg-panel-solid',
    defaultValue: '#111827',
    semantic: true,
    semanticRole: 'bg-panel',
    category: 'background',
    facets: {},
  },
  {
    id: 'color.bg.subtle',
    label: 'Background Subtle',
    kind: 'color',
    cssProperty: '--colors-semantic-bg-subtle',
    defaultValue: '#1a1a2e',
    semantic: true,
    semanticRole: 'bg-subtle',
    category: 'background',
    facets: {},
  },
  {
    id: 'color.bg.overlay',
    label: 'Background Overlay',
    kind: 'color',
    cssProperty: '--colors-semantic-bg-overlay',
    defaultValue: 'rgba(11, 16, 32, 0.9)',
    semantic: true,
    semanticRole: 'bg-overlay',
    category: 'background',
    facets: {},
  },
  {
    id: 'color.text.primary',
    label: 'Text Primary',
    kind: 'color',
    cssProperty: '--colors-semantic-text-primary',
    defaultValue: '#e8e8e8',
    semantic: true,
    semanticRole: 'text-primary',
    category: 'text',
    facets: {},
  },
  {
    id: 'color.text.secondary',
    label: 'Text Secondary',
    kind: 'color',
    cssProperty: '--colors-semantic-text-secondary',
    defaultValue: '#b0b0b0',
    semantic: true,
    semanticRole: 'text-secondary',
    category: 'text',
    facets: {},
  },
  {
    id: 'color.text.muted',
    label: 'Text Muted',
    kind: 'color',
    cssProperty: '--colors-semantic-text-muted',
    defaultValue: '#888888',
    semantic: true,
    semanticRole: 'text-muted',
    category: 'text',
    facets: {},
  },
  {
    id: 'color.border.subtle',
    label: 'Border Subtle',
    kind: 'color',
    cssProperty: '--colors-semantic-border-subtle',
    defaultValue: '#2a2a2a',
    semantic: true,
    semanticRole: 'border-subtle',
    category: 'border',
    facets: {},
  },
  {
    id: 'color.accent.primary',
    label: 'Accent Primary',
    kind: 'color',
    cssProperty: '--colors-semantic-accent-primary',
    defaultValue: '#6ea8fe',
    semantic: true,
    semanticRole: 'accent-primary',
    category: 'accent',
    facets: {},
  },
  {
    id: 'color.accent.cyan',
    label: 'Accent Cyan',
    kind: 'color',
    cssProperty: '--colors-semantic-accent-cyan',
    defaultValue: '#00d4ff',
    semantic: true,
    semanticRole: 'accent-cyan',
    category: 'accent',
    facets: {},
  },
  {
    id: 'color.accent.violet',
    label: 'Accent Violet',
    kind: 'color',
    cssProperty: '--colors-semantic-accent-violet',
    defaultValue: '#b87aff',
    semantic: true,
    semanticRole: 'accent-violet',
    category: 'accent',
    facets: {},
  },
  {
    id: 'color.success',
    label: 'Success Green',
    kind: 'color',
    cssProperty: '--colors-semantic-success',
    defaultValue: '#46c07a',
    semantic: true,
    semanticRole: 'success',
    category: 'status',
    facets: {},
  },
  {
    id: 'color.error',
    label: 'Error Red',
    kind: 'color',
    cssProperty: '--colors-semantic-error',
    defaultValue: '#e5534b',
    semantic: true,
    semanticRole: 'error',
    category: 'status',
    facets: {},
  },
  {
    id: 'color.warning',
    label: 'Warning Amber',
    kind: 'color',
    cssProperty: '--colors-semantic-warning',
    defaultValue: '#f5a623',
    semantic: true,
    semanticRole: 'warning',
    category: 'status',
    facets: {},
  },

  // Spacing
  {
    id: 'spacing.scale-1',
    label: 'Spacing 1 (4px)',
    kind: 'spacing',
    cssProperty: '--spacing-scale-1',
    defaultValue: '4px',
    category: 'spacing',
    facets: {},
  },
  {
    id: 'spacing.scale-2',
    label: 'Spacing 2 (8px)',
    kind: 'spacing',
    cssProperty: '--spacing-scale-2',
    defaultValue: '8px',
    category: 'spacing',
    facets: {},
  },
  {
    id: 'spacing.scale-3',
    label: 'Spacing 3 (16px)',
    kind: 'spacing',
    cssProperty: '--spacing-scale-3',
    defaultValue: '16px',
    category: 'spacing',
    facets: {},
  },
  {
    id: 'spacing.scale-4',
    label: 'Spacing 4 (24px)',
    kind: 'spacing',
    cssProperty: '--spacing-scale-4',
    defaultValue: '24px',
    category: 'spacing',
    facets: {},
  },

  // Typography
  {
    id: 'typography.font.ui',
    label: 'UI Font Family',
    kind: 'typography',
    cssProperty: '--typography-fontFamilies-ui',
    defaultValue: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    category: 'font-family',
    facets: {},
  },
  {
    id: 'typography.font.data',
    label: 'Data Font Family',
    kind: 'typography',
    cssProperty: '--typography-fontFamilies-data',
    defaultValue: '"JetBrains Mono", "Fira Code", monospace',
    category: 'font-family',
    facets: {},
  },
  {
    id: 'typography.scale.xs',
    label: 'Font Size XS (12px)',
    kind: 'typography',
    cssProperty: '--typography-scale-xs',
    defaultValue: '12px',
    category: 'font-size',
    facets: {},
  },
  {
    id: 'typography.scale.sm',
    label: 'Font Size SM (13px)',
    kind: 'typography',
    cssProperty: '--typography-scale-sm',
    defaultValue: '13px',
    category: 'font-size',
    facets: {},
  },
  {
    id: 'typography.scale.base',
    label: 'Font Size Base (14px)',
    kind: 'typography',
    cssProperty: '--typography-scale-base',
    defaultValue: '14px',
    category: 'font-size',
    facets: {},
  },
  {
    id: 'typography.scale.lg',
    label: 'Font Size LG (16px)',
    kind: 'typography',
    cssProperty: '--typography-scale-lg',
    defaultValue: '16px',
    category: 'font-size',
    facets: {},
  },
  {
    id: 'typography.fontWeights.normal',
    label: 'Font Weight Normal (400)',
    kind: 'typography',
    cssProperty: '--typography-fontWeights-normal',
    defaultValue: '400',
    category: 'font-weight',
    facets: {},
  },
  {
    id: 'typography.fontWeights.medium',
    label: 'Font Weight Medium (500)',
    kind: 'typography',
    cssProperty: '--typography-fontWeights-medium',
    defaultValue: '500',
    category: 'font-weight',
    facets: {},
  },
  {
    id: 'typography.fontWeights.semibold',
    label: 'Font Weight Semibold (600)',
    kind: 'typography',
    cssProperty: '--typography-fontWeights-semibold',
    defaultValue: '600',
    category: 'font-weight',
    facets: {},
  },
  {
    id: 'typography.fontWeights.bold',
    label: 'Font Weight Bold (700)',
    kind: 'typography',
    cssProperty: '--typography-fontWeights-bold',
    defaultValue: '700',
    category: 'font-weight',
    facets: {},
  },

  // Border radius
  {
    id: 'border.radius.sm',
    label: 'Border Radius SM (4px)',
    kind: 'border',
    cssProperty: '--border-radius-sm',
    defaultValue: '4px',
    category: 'border-radius',
    facets: {},
  },
  {
    id: 'border.radius.md',
    label: 'Border Radius MD (6px)',
    kind: 'border',
    cssProperty: '--border-radius-md',
    defaultValue: '6px',
    category: 'border-radius',
    facets: {},
  },
  {
    id: 'border.radius.lg',
    label: 'Border Radius LG (8px)',
    kind: 'border',
    cssProperty: '--border-radius-lg',
    defaultValue: '8px',
    category: 'border-radius',
    facets: {},
  },
  {
    id: 'border.radius.full',
    label: 'Border Radius Full (9999px)',
    kind: 'border',
    cssProperty: '--border-radius-full',
    defaultValue: '9999px',
    category: 'border-radius',
    facets: {},
  },

  // Shadows
  {
    id: 'shadow.sm',
    label: 'Shadow SM',
    kind: 'shadow',
    cssProperty: '--shadow-sm',
    defaultValue: '0 1px 2px rgba(0, 0, 0, 0.05)',
    category: 'shadow',
    facets: {},
  },
  {
    id: 'shadow.md',
    label: 'Shadow MD',
    kind: 'shadow',
    cssProperty: '--shadow-md',
    defaultValue: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)',
    category: 'shadow',
    facets: {},
  },
  {
    id: 'shadow.lg',
    label: 'Shadow LG',
    kind: 'shadow',
    cssProperty: '--shadow-lg',
    defaultValue: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)',
    category: 'shadow',
    facets: {},
  },

  // Motion
  {
    id: 'motion.duration.fast',
    label: 'Duration Fast (150ms)',
    kind: 'motion',
    cssProperty: '--motion-duration-fast',
    defaultValue: '150ms',
    category: 'duration',
    facets: {},
  },
  {
    id: 'motion.duration.normal',
    label: 'Duration Normal (250ms)',
    kind: 'motion',
    cssProperty: '--motion-duration-normal',
    defaultValue: '250ms',
    category: 'duration',
    facets: {},
  },
  {
    id: 'motion.duration.slow',
    label: 'Duration Slow (350ms)',
    kind: 'motion',
    cssProperty: '--motion-duration-slow',
    defaultValue: '350ms',
    category: 'duration',
    facets: {},
  },
  {
    id: 'motion.easing.default',
    label: 'Easing Default',
    kind: 'motion',
    cssProperty: '--motion-easing-default',
    defaultValue: 'cubic-bezier(0.4, 0, 0.2, 1)',
    category: 'easing',
    facets: {},
  },

  // Z-index
  {
    id: 'zindex.dropdown',
    label: 'Z-Index Dropdown (100)',
    kind: 'z-index',
    cssProperty: '--zindex-dropdown',
    defaultValue: '100',
    category: 'z-index',
    facets: {},
  },
  {
    id: 'zindex.modal',
    label: 'Z-Index Modal (200)',
    kind: 'z-index',
    cssProperty: '--zindex-modal',
    defaultValue: '200',
    category: 'z-index',
    facets: {},
  },
  {
    id: 'zindex.tooltip',
    label: 'Z-Index Tooltip (300)',
    kind: 'z-index',
    cssProperty: '--zindex-tooltip',
    defaultValue: '300',
    category: 'z-index',
    facets: {},
  },
  {
    id: 'zindex.toast',
    label: 'Z-Index Toast (400)',
    kind: 'z-index',
    cssProperty: '--zindex-toast',
    defaultValue: '400',
    category: 'z-index',
    facets: {},
  },

  // Breakpoints
  {
    id: 'breakpoint.sm',
    label: 'Breakpoint SM (640px)',
    kind: 'breakpoint',
    cssProperty: '--breakpoint-sm',
    defaultValue: '640px',
    category: 'breakpoint',
    facets: {},
  },
  {
    id: 'breakpoint.md',
    label: 'Breakpoint MD (768px)',
    kind: 'breakpoint',
    cssProperty: '--breakpoint-md',
    defaultValue: '768px',
    category: 'breakpoint',
    facets: {},
  },
  {
    id: 'breakpoint.lg',
    label: 'Breakpoint LG (1024px)',
    kind: 'breakpoint',
    cssProperty: '--breakpoint-lg',
    defaultValue: '1024px',
    category: 'breakpoint',
    facets: {},
  },
  {
    id: 'breakpoint.xl',
    label: 'Breakpoint XL (1280px)',
    kind: 'breakpoint',
    cssProperty: '--breakpoint-xl',
    defaultValue: '1280px',
    category: 'breakpoint',
    facets: {},
  },
];

// Register built-in primitives
for (const primitive of BUILTIN_DESIGN_PRIMITIVES) {
  registerDesignPrimitive(primitive);
}