import { Announcer } from '../core/announcer.js';
import { $activeLens, $connectionState, exposeTestApi, hydrateFromUrl } from '../core/store.js';
import { connect } from '../core/ws-client.js';

// Phase 0: Design system & primitives
import '../styles/theme.css';
import '../components/primitives/index.js';

// Phase 1: Feature components (shared)
import '../components/connection-banner.js';
import '../components/error-boundary.js';
import '../components/input-hud.js';
import '../components/lens-selector.js';
import '../components/contradiction-badge.js';
import '../components/telemetry-panel.js';

// SpaceGraph-specific components
import './spacegraph-viewport.js';

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

exposeTestApi();
hydrateFromUrl();
connect();