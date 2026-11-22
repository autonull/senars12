import '../../styles/theme.css';
import { addAgentMessage, addUserMessage, connect } from '../../kernel/index';

// App surfaces (self-contained content panes).
import '../ask/ask-app-v2';
import '../notebook/notebook-app';
import '../console/console-app';
import '../goals/goals-app';
import '../explore/explore-app';
import '../hud/hud-app';

// Graph content + chrome surfaces.
import '../../components/renderers/graph-surface';
import '../../core/view-host';
import '../../components/views/index';
import '../../spacegraph/spacegraph-viewport';
import '../../components/cognitive-metrics';
import '../../components/telemetry-panel';
import '../../components/node-detail-drawer';
import '../../components/timeline-scrubber';
import '../../components/graph-minimap';
import '../../components/graph-legend';

import '../../components/s-app-shell';
import './studio-app';

connect();

// Example conversation, so chat/notebook panes are populated without typing.
addUserMessage('<bird --> animal>.', 'believe');
addAgentMessage('Admitted (bird-->animal). f1.00 c0.90', 'believe');
addUserMessage('<robin --> bird>.', 'believe');
addAgentMessage('Admitted (robin-->bird). f1.00 c0.90', 'believe');
addUserMessage('<robin --> animal>?', 'question');
addAgentMessage('(robin-->animal) — deduced via deduction. f1.00 c0.81', 'question');
