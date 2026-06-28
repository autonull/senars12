import { connect } from './core/ws-client.js';
import { $connectionState, exposeTestApi } from './core/store.js';

import './components/app-layout.js';
import './components/belief-graph.js';
import './components/chat-console.js';
import './components/cognitive-hud.js';
import './components/config-drawer.js';
import './components/telemetry-panel.js';
import './components/working-memory.js';

exposeTestApi();

const bar = document.getElementById('status-bar');
const label = document.getElementById('status-label');

const colors: Record<string, string> = {
  connected: 'background: #00f3ff; box-shadow: 0 0 8px rgba(0,243,255,0.6)',
  connecting: 'background: #ffb000; box-shadow: 0 0 8px rgba(255,176,0,0.4)',
  reconnecting: 'background: #ffb000; box-shadow: 0 0 8px rgba(255,176,0,0.4)',
  disconnected: 'background: #475569; box-shadow: none',
};

$connectionState.subscribe((state: string) => {
  if (bar) bar.setAttribute('style', `position:fixed;top:0;left:0;right:0;height:2px;z-index:100;transition:background 0.3s;${colors[state] ?? colors.disconnected}`);
  if (label) label.textContent = state;
});

connect();