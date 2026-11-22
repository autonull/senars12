import { Announcer } from '../core/announcer';
import { $activeLens, $connectionState, exposeTestApi, hydrateFromUrl } from '../core/store';
import { connect } from '../core/ws-client';

// Phase 0: Design system & primitives
import '../styles/theme.css';
import '../components/primitives/index';

// Phase 1: Feature components (shared)
import '../components/connection-banner';
import '../components/error-boundary';
import '../components/input-hud';
import '../components/contradiction-badge';
import '../components/telemetry-panel';

// SpaceGraph-specific components
import './spacegraph-viewport';

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
