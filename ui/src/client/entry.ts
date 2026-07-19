import { Announcer } from './core/announcer.js';
import { $activeLens, $connectionState, hydrateFromUrl } from './core/store.js';
import { connect } from './core/ws-client.js';

// Expose test API synchronously at startup for Playwright tests
// This must run synchronously at module evaluation time to prevent treeshaking
(window as unknown as { __testApi?: Record<string, unknown> }).__testApi = {
  store: {
    getState: (path: string) => {
      // This will be replaced by the actual store implementation when store loads
      return undefined;
    },
  },
  connection: { getState: () => undefined },
};

// Phase 0: Design system & primitives
import './styles/theme.css';
import './components/primitives/index.js';

// Phase 1: Feature components
import './components/app-layout.js';
import './components/graph-toolbar.js';
import './components/connection-banner.js';
import './components/error-boundary.js';
import './components/graph-viewport.js';
import './components/lens-selector.js';
import './components/input-hud.js';
import './components/config-hud.js';
import './components/telemetry-panel.js';
import './components/contradiction-badge.js';

// Phase 2: Graph interaction components
import './components/lens-controller.js';
import './components/node-detail-drawer.js';
import './components/graph-minimap.js';

// Phase 4: Chat & Config enhancements
import './components/chat-history-panel.js';
import './components/config-profiles.js';
import './components/lens-designer.js';

// Phase 5: Observability
import './components/cognitive-metrics.js';

// Accessibility: live region announcements
import { Announcer } from './core/announcer.js';
import { $activeLens, $connectionState, hydrateFromUrl } from './core/store.js';
import { connect } from './core/ws-client.js';

const announcer = Announcer.getInstance();
$connectionState.subscribe((state) => {
  if (state === 'connected') announcer.announce('Connected to SeNARS');
  else if (state === 'disconnected') announcer.announce('Disconnected from SeNARS', 'assertive');
  else if (state === 'reconnecting') announcer.announce('Reconnecting to SeNARS', 'assertive');
});
$activeLens.subscribe((lens) => {
  announcer.announce(`Switched to ${lens} lens`);
});

hydrateFromUrl();
connect();
