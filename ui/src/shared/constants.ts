/** Hex color codes for each cognitive lens. */
export const LENS_COLORS_HEX: Record<string, string> = {
    belief: '#00f3ff',
    goal: '#ff00aa',
    contradiction: '#ffaa00',
};

/** Human-readable labels for each cognitive lens. */
export const LENS_LABELS: Record<string, string> = {
    belief: 'Beliefs',
    goal: 'Goals',
    contradiction: 'Conflicts',
};

/** Color coding for WebSocket connection states. */
export const CONNECTION_COLORS: Record<string, string> = {
    connected: '#00cc88',
    connecting: '#00aaff',
    reconnecting: '#ffaa00',
    disconnected: '#ff4444',
};

/** Short descriptions for each cognitive lens shown in the UI. */
export const LENS_DESCRIPTIONS: Record<string, string> = {
    belief: 'What the system knows',
    goal: 'What the system wants',
    contradiction: 'Where beliefs conflict',
};
