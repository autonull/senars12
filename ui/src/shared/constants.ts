/** Hex color codes for each cognitive lens. */
export const LENS_COLORS_HEX: Record<string, string> = {
  belief: '#00f3ff',
  goal: '#ff0055',
  contradiction: '#ff00ff',
};

/** Human-readable labels for each cognitive lens. */
export const LENS_LABELS: Record<string, string> = {
  belief: 'Beliefs',
  goal: 'Goals',
  contradiction: 'Conflicts',
};

/** Color coding for WebSocket connection states. */
export const CONNECTION_COLORS: Record<string, string> = {
  connected: '#00f3ff',
  connecting: '#ffb000',
  reconnecting: '#ffb000',
  disconnected: '#475569',
};

/** Short descriptions for each cognitive lens shown in the UI. */
export const LENS_DESCRIPTIONS: Record<string, string> = {
  belief: 'What the system knows',
  goal: 'What the system wants',
  contradiction: 'Where beliefs conflict',
};