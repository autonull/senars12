import { $connectionState, exposeTestApi } from './core/store.js';
import { connect } from './core/ws-client.js';
import { initOnboarding } from './core/onboarding.js';
import { CONNECTION_COLORS } from './constants.js';

import './components/app-layout.js';
import './components/belief-graph.js';
import './components/chat-console.js';
import './components/config-drawer.js';
import './components/telemetry-panel.js';
import './components/working-memory.js';
import './components/lens-selector.js';
import './components/concept-thread.js';
import './components/contradiction-badge.js';

exposeTestApi();
connect();
initOnboarding();

$connectionState.subscribe((state) => {
  const color = CONNECTION_COLORS[state] ?? CONNECTION_COLORS.disconnected;
  const el = document.getElementById('status-bar');
  if (el) el.style.cssText = `position:fixed;top:0;left:0;right:0;height:2px;z-index:100;transition:background .3s;background:${color}`;
});
