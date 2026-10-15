import '../../styles/theme.css';
import { addAgentMessage, addUserMessage, connect, mountWorkspaceProjection } from '../../kernel/index.js';

// App surfaces (self-contained full panes).
import '../ask/ask-app-v2.js';
import '../notebook/notebook-app.js';
import '../console/console-app.js';
import '../goals/goals-app.js';
import '../explore/explore-app.js';
import '../hud/hud-app.js';

// Graph chrome + panels + views.
import '../../components/renderers/graph-surface.js';
import '../../core/view-host.js';
import '../../components/views/index.js';
import '../../spacegraph/spacegraph-viewport.js';
import '../../components/graph-minimap.js';
import '../../components/graph-legend.js';
import '../../components/graph-toolbar.js';
import '../../components/lens-controller.js';
import '../../components/cognitive-metrics.js';
import '../../components/telemetry-panel.js';
import '../../components/chat-history-panel.js';
import '../../components/node-detail-drawer.js';
import '../../components/timeline-scrubber.js';
import '../../components/config-hud.js';
import '../../components/lens-designer.js';
import '../../components/overlays/toc.js';
import '../../components/overlays/events.js';
import '../../components/overlays/nodes.js';
import '../../components/overlays/related.js';
import '../../components/overlays/explain.js';

import './lab-app.js';

connect();
mountWorkspaceProjection();

// Example conversation, so chat/notebook panes are populated without typing.
addUserMessage('<bird --> animal>.', 'believe');
addAgentMessage('Admitted (bird-->animal). f1.00 c0.90', 'believe');
addUserMessage('<robin --> bird>.', 'believe');
addAgentMessage('Admitted (robin-->bird). f1.00 c0.90', 'believe');
addUserMessage('<robin --> animal>?', 'question');
addAgentMessage('(robin-->animal) — deduced via deduction. f1.00 c0.81', 'question');
