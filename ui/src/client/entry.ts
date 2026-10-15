import { Announcer } from './core/announcer.js';
import { $activeLens, $config, $connectionState, hydrateFromUrl } from './core/store.js';
import { connect } from './core/ws-client.js';
import { initAttentionRuntime } from './framework/attention-runtime.js';

// Phase 0: Design system & primitives
import './styles/theme.css';
import './components/primitives/index.js';
import './components/s-search-panel.js';
import './components/split-panel.js';

// Phase 1: Feature components
import './components/app-layout.js';
import './components/graph-toolbar.js';
import './components/connection-banner.js';
import './components/error-boundary.js';
import './components/graph-viewport.js';
import './components/input-hud.js';
import './components/config-hud.js';
import './components/telemetry-panel.js';
import './components/contradiction-badge.js';
import './components/aspect-panel.js';

// Phase 1: Instrument components
import './components/instrument/cycle-controls.js';
import './components/instrument/trace-viewer.js';
import './components/instrument/gate-inspector.js';

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

// Phase 4: Unified view system
import './core/view-host.js';
import './components/views/index.js';

// Phase 0.3: Workspace renderers
import './components/renderers/graph.js';
import './components/renderers/notebook.js';
import './components/renderers/graph3d.js';

// Phase 0.2: Live workspace projection
import { mountWorkspaceProjection } from './core/workspace-bindings.js';

// Accessibility: live region announcements
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
mountWorkspaceProjection();
initAttentionRuntime($config.get(), (newConfig) => {
  // Config changes are handled by the store's subscription
});
connect();
