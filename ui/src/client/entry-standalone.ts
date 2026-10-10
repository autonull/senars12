/**
 * Standalone entry point — engine-free build.
 * Runs without NARS backend: LM provider + segmentation + semantic links + Notebook/Graph.
 * Only `language`/`tools`/`memory` capabilities active; no dead affordances.
 */

import { Announcer } from './core/announcer.js';
import { $activeRenderer, $connectionState, hydrateFromUrl } from './core/store.js';
import { $capabilities, setCapability, capabilityGate } from './core/capabilities.js';

// Phase 0: Design system & primitives
import './styles/theme.css';
import './components/primitives/index.js';

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

// Phase 0.3: Workspace renderers (Notebook only for standalone; Graph needs engine)
import './components/renderers/notebook.js';

// Phase 0.2: Live workspace projection
import { mountWorkspaceProjection } from './core/workspace-bindings.js';

// Overlays (capability-gated)
import './components/overlays/index.js';

// Configure standalone capabilities: language + tools + memory only
// reasoning and uiControl require the NARS backend
const STANDALONE_CAPABILITIES: Array<Parameters<typeof setCapability>[0]> = ['language', 'tools', 'memory'];
for (const cap of STANDALONE_CAPABILITIES) {
  setCapability(cap, true);
}
// Ensure reasoning and uiControl are disabled
setCapability('reasoning', false);
setCapability('uiControl', false);

// Default to notebook renderer for language-only composition
$activeRenderer.set('notebook');

// Standalone connection state — not connecting, not disconnected, just local
$connectionState.set('standalone');

// Accessibility: live region announcements
const announcer = Announcer.getInstance();

// In standalone mode, we don't connect to a backend
// The connection banner will show "Standalone" instead of connection status

hydrateFromUrl();
mountWorkspaceProjection();

// Export a marker so other modules can detect standalone mode
if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).__SENARS_STANDALONE__ = true;
}