import '../../styles/theme.css';
import { addAgentMessage, addUserMessage, connect, mountWorkspaceProjection } from '../../kernel/index';

// App surfaces (self-contained full panes).
import '../ask/ask-app-v2';
import '../notebook/notebook-app';
import '../console/console-app';
import '../goals/goals-app';
import '../explore/explore-app';
import '../hud/hud-app';

// Graph chrome + panels + views.
import '../../components/renderers/graph-surface';
import '../../core/view-host';
import '../../components/views/index';
import '../../spacegraph/spacegraph-viewport';
import '../../components/graph-minimap';
import '../../components/graph-legend';
import '../../components/graph-toolbar';
import '../../components/lens-controller';
import '../../components/cognitive-metrics';
import '../../components/telemetry-panel';
import '../../components/chat-history-panel';
import '../../components/node-detail-drawer';
import '../../components/timeline-scrubber';
import '../../components/config-hud';
import '../../components/lens-designer';
import '../../components/overlays/toc';
import '../../components/overlays/events';
import '../../components/overlays/nodes';
import '../../components/overlays/related';
import '../../components/overlays/explain';

import './lab-app';

connect();
mountWorkspaceProjection();

// Example conversation, so chat/notebook panes are populated without typing.
addUserMessage('<bird --> animal>.', 'believe');
addAgentMessage('Admitted (bird-->animal). f1.00 c0.90', 'believe');
addUserMessage('<robin --> bird>.', 'believe');
addAgentMessage('Admitted (robin-->bird). f1.00 c0.90', 'believe');
addUserMessage('<robin --> animal>?', 'question');
addAgentMessage('(robin-->animal) — deduced via deduction. f1.00 c0.81', 'question');
