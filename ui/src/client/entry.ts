import { $connectionState, exposeTestApi } from './core/store.js';
import { connect } from './core/ws-client.js';
import { initOnboarding } from './core/onboarding.js';

import './components/app-layout.js';
import './components/belief-graph.js';
import './components/chat-console.js';
import './components/cognitive-hud.js';
import './components/config-drawer.js';
import './components/telemetry-panel.js';
import './components/working-memory.js';
import './components/lens-selector.js';
import './components/concept-thread.js';
import './components/contradiction-badge.js';

exposeTestApi();
connect();
initOnboarding();

const STATUS_BAR_CSS: Record<string, string> = {
  connected: '#00f3ff; --sg:0 0 8px rgba(0,243,255,0.6)',
  connecting: '#ffb000; --sg:0 0 8px rgba(255,176,0,0.4)',
  reconnecting: '#ffb000; --sg:0 0 8px rgba(255,176,0,0.4)',
  disconnected: '#475569; --sg:none',
};

$connectionState.subscribe((state) => {
  const s = STATUS_BAR_CSS[state] ?? STATUS_BAR_CSS.disconnected;
  const bar = document.getElementById('status-bar') as HTMLElement | null;
  const label = document.getElementById('status-label') as HTMLElement | null;
  if (bar) bar.style.cssText = `position:fixed;top:0;left:0;right:0;height:2px;z-index:100;transition:background .3s;background:${s}`;
  if (label) label.textContent = state;
});
