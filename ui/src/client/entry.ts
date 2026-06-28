import { $connectionState, exposeTestApi } from './core/store.js';
import { connect } from './core/ws-client.js';
import { CONNECTION_COLORS } from './constants.js';

import './components/app-layout.js';
import './components/graph-viewport.js';
import './components/lens-selector.js';
import './components/input-hud.js';
import './components/config-hud.js';
import './components/telemetry-panel.js';
import './components/contradiction-badge.js';

exposeTestApi();
connect();