import { Announcer } from './core/announcer';
import { $activeLens, $config, $connectionState, hydrateFromUrl } from './core/store';
import { connect } from './core/ws-client';
import { initAttentionRuntime } from './framework/attention-runtime';

// Phase 0: Design system & primitives
import './styles/theme.css';
import './components/primitives/index';
import './components/s-search-panel';
import './components/split-panel';

// Phase 1: Feature components
import './components/app-layout';
import './components/graph-toolbar';
import './components/connection-banner';
import './components/error-boundary';
import './components/graph-viewport';
import './components/input-hud';
import './components/config-hud';
import './components/telemetry-panel';
import './components/contradiction-badge';
import './components/aspect-panel';

// Phase 1: Instrument components
import './components/instrument/cycle-controls';
import './components/instrument/trace-viewer';
import './components/instrument/gate-inspector';

// Phase 2: Graph interaction components
import './components/lens-controller';
import './components/node-detail-drawer';
import './components/graph-minimap';

// Phase 4: Chat & Config enhancements
import './components/chat-history-panel';
import './components/config-profiles';
import './components/lens-designer';

// Phase 5: Observability
import './components/cognitive-metrics';

// Phase 4: Unified view system
import './core/view-host';
import './components/views/index';

// Phase 0.3: Workspace renderers
import './components/renderers/graph';
import './components/renderers/notebook';
import './components/renderers/graph3d';

// Phase 0.2: Live workspace projection
import { mountWorkspaceProjection } from './core/workspace-bindings';

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
