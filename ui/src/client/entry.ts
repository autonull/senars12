import { $connectionState, exposeTestApi } from './core/store.js';
import { connect } from './core/ws-client.js';

import './components/app-layout.js';
import './components/belief-graph.js';
import './components/chat-console.js';
import './components/cognitive-hud.js';
import './components/config-drawer.js';
import './components/telemetry-panel.js';
import './components/working-memory.js';

exposeTestApi();
connect();

const STYLES: Record<string, string> = {
  connected: '--status-bg: #00f3ff; --status-glow: 0 0 8px rgba(0,243,255,0.6)',
  connecting: '--status-bg: #ffb000; --status-glow: 0 0 8px rgba(255,176,0,0.4)',
  reconnecting: '--status-bg: #ffb000; --status-glow: 0 0 8px rgba(255,176,0,0.4)',
  disconnected: '--status-bg: #475569; --status-glow: none',
};

$connectionState.subscribe((state) => {
  const bar = document.getElementById('status-bar') as HTMLElement | null;
  const label = document.getElementById('status-label') as HTMLElement | null;
  if (bar) bar.style.cssText = `position:fixed;top:0;left:0;right:0;height:2px;z-index:100;transition:background 0.3s;${STYLES[state] ?? STYLES.disconnected}`;
  if (label) label.textContent = state;
});