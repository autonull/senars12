import '../../styles/theme.css';
import { addAgentMessage, addUserMessage, connect } from '../../kernel/index.js';

// App surfaces (self-contained content panes).
import '../ask/ask-app-v2.js';
import '../notebook/notebook-app.js';
import '../console/console-app.js';
import '../goals/goals-app.js';
import '../explore/explore-app.js';
import '../hud/hud-app.js';

// Graph content + chrome surfaces.
import '../../components/renderers/graph-surface.js';
import '../../components/cognitive-metrics.js';
import '../../components/telemetry-panel.js';
import '../../components/node-detail-drawer.js';
import '../../components/timeline-scrubber.js';
import '../../components/graph-minimap.js';
import '../../components/graph-legend.js';

import '../../components/s-app-shell.js';
import './studio-app.js';

connect();

// Example conversation, so chat/notebook panes are populated without typing.
addUserMessage('<bird --> animal>.', 'believe');
addAgentMessage('Admitted (bird-->animal). f1.00 c0.90', 'believe');
addUserMessage('<robin --> bird>.', 'believe');
addAgentMessage('Admitted (robin-->bird). f1.00 c0.90', 'believe');
addUserMessage('<robin --> animal>?', 'question');
addAgentMessage('(robin-->animal) — deduced via deduction. f1.00 c0.81', 'question');
