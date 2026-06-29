/**
 * Read a CSS custom property value from the document root.
 * Used by canvas-based components that cannot use CSS variables directly.
 */
export function cssToken(name: string, fallback = ''): string {
    if (typeof document === 'undefined') return fallback;
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

/**
 * Shared token color values for canvas/Cytoscape rendering.
 * Mirrors design-tokens.json color primitives.
 */
export const TOKEN_COLORS = {
    accentCyan: '#00f3ff',
    accentAmber: '#ffaa00',
    accentMagenta: '#ff00aa',
    textPrimary: '#e8e8e8',
    textSecondary: '#a0a0a0',
    textMuted: '#6a6a6a',
    borderDefault: '#2a2a2a',
    borderDim: '#1a1a1a',
    success: '#00cc88',
    error: '#ff4444',
    warning: '#ffaa00',
    info: '#00aaff',
    focusRing: '#00f3ff',
    void: '#000000',
} as const;
