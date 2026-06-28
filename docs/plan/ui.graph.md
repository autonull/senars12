# SeNARS Graph Visualizer Specifications

## Purpose

- Visualize the hybrid neuro-symbolic reasoning process in real-time
- Demonstrate neural-symbolic integration for education and analysis
- Enable understanding of concept formation, task processing, and knowledge evolution
- Serve as foundation for advanced analysis and debugging tools

## Usability

- Entry-point: `npm run web:graph:dev` at `/graph` endpoint
- Intuitive UI with progressive disclosure (simple by default, detailed on demand)
- Consistent with existing SeNARS UI patterns and controls
- Responsive design with accessibility support

## Dependencies

### Frontend Dependencies

- **React 18+**: UI framework
- **react-force-graph**: Force-directed graph rendering with 2D canvas
- **D3.js**: Graph visualization and layout algorithms
- **dagre**: Hierarchical layout algorithms
- **react-use**: React hooks utilities
- **@emotion/styled** or **styled-components**: CSS-in-JS styling
- **react-icons**: Icon components
- **uuid**: Unique identifier generation
- **immer**: Immutable state updates
- **zustand**: Lightweight state management
- **websocket**: WebSocket communication client
- **react-virtual**: Virtual scrolling for large datasets

### Backend Dependencies

- **ws**: WebSocket server implementation
- **express**: Web server framework
- **cors**: Cross-origin resource sharing middleware
- **compression**: HTTP response compression

## WebSocket Protocol Integration

### Protocol Overview

The graph visualizer leverages the existing SeNARS WebSocket infrastructure that broadcasts real-time NAR events. The
system automatically broadcasts all events from the `NAR_EVENTS` constant via `WebSocketMonitor.listenToNAR()`.

### Real NAR Events Available (from constants.js)

The system broadcasts these real-time events automatically:

- `task.input` - When tasks are input to the system
- `task.processed` - When tasks are processed
- `concept.created` - When new concepts are created in memory
- `system.started`/`stopped` - When reasoning starts/stops
- `reasoning.step` - During reasoning cycles
- `belief.added`, `question.answered` - Beliefs/questions handling
- Many more NAR_EVENTS

### Message Format (Automatically Generated)

```
{
  type: "event",           // Fixed: all NAR events come as 'event' type
  eventType: string,       // The actual event name ('task.input', 'concept.created', etc.)
  data: object,            // Event-specific data payload from NAR
  timestamp: number,       // When the event occurred
  metadata: object         // Additional event metadata
}
```

## Real-Time NAR Event Integration (No Server Changes Required)

### NAR-to-WebSocket Integration (Ready Out-of-the-Box)

The graph visualization leverages the existing SeNARS architecture with built-in event broadcasting. No server-side code
changes are needed.

#### Ready-to-Use Integration Pattern

The system already provides this integration through existing components:

```javascript
// In YOUR application code:
import {NAR} from 'src/nar/NAR.js';
import {WebSocketMonitor} from 'src/server/WebSocketMonitor.js';

// 1. Create a NAR instance and WebSocket monitor
const nar = new NAR({lm: {enabled: false}});
await nar.initialize();
const monitor = new WebSocketMonitor({port: 8081});
await monitor.start();

// 2. Connect them with the existing method:
nar.connectToWebSocketMonitor(monitor);
nar.start(); // Start NAR to generate real events

// NOW all NAR events are automatically broadcast in real-time!
```

#### Client-Side Event Processing

Your application receives real NAR events and transforms them to graph visualization:

```javascript
// Example transformation from REAL NAR events to graph nodes:
class GraphVisualizer {
  constructor() {
    // Connect to WebSocket stream
    this.ws = new WebSocket(`ws://localhost:8081`);

    this.ws.onmessage = (event) => {
      const message = JSON.parse(event.data);

      // Process real NAR events that are ALREADY being broadcast
      if (message.type === 'event') {
        switch(message.eventType) {
          case 'task.input':
            // Transform REAL task from NAR into graph node
            this.addNode({
              id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
              term: message.data.task.term.toString(),
              type: message.data.task.type.toLowerCase(), // 'belief', 'goal', 'question'
              priority: message.data.task.budget.priority,
              createdAt: message.timestamp
            });
            break;

          case 'concept.created':
            // Transform REAL concept from NAR into graph node
            this.addNode({
              id: `concept-${message.data.concept.term.toString()}`,
              term: message.data.concept.term.toString(),
              type: 'concept',
              priority: message.data.concept.priority,
              createdAt: message.timestamp
            });
            break;
        }
      }
    };
  }
}
```

#### Zero Server Development Required

- **No new server code** - All NAR event broadcasting already implemented
- **No new WebSocket endpoints** - Already provided by existing infrastructure
- **Complete working setup** - Can be built TODAY with real NAR events

## UI/UX Design Principles

### User Interface Guidelines

- **Consistent Navigation**: Use existing SeNARS UI patterns and controls
- **Progressive Disclosure**: Show essential information by default, more details on demand
- **Intuitive Controls**: Use familiar patterns (zoom, pan, selection) with clear affordances
- **Responsive Design**: Work well on different screen sizes and devices
- **Accessibility**: Support keyboard navigation, screen readers, and color-blind accessibility

### Visual Encoding Strategy

- **Node Types**: Color-coded by SeNARS type (blue: concept, green: task, orange: belief, red: goal, purple: question)
- **Node Size**: Proportional to priority/frequency values
- **Edge Types**: Different styles for relationship types (solid: direct, dashed: similarity, dotted: inference)
- **Animations**: Subtle animations to show reasoning process

### Interaction Design

- **Selection**: Click to select nodes/edges with visual feedback
- **Hover Details**: Show term content and metrics on hover
- **Search**: Find specific terms or concepts in the graph
- **Filtering**: Toggle visibility of different node/edge types
- **Zoom/pan**: Intuitive navigation with mouse wheel and drag controls

## Modularity and Component Reusability

### Shared Components Architecture

The graph visualizer should extend existing architecture patterns:

```
ui/
├── components/
│   ├── Graph/                          # New graph-specific components
│   │   ├── GraphCore/                  # Reusable core components
│   │   │   ├── GraphCanvas.js          # Core rendering
│   │   │   ├── Node.js                 # Node rendering
│   │   │   ├── Edge.js                 # Edge rendering
│   │   │   └── GraphControls.js        # Standard controls
│   │   ├── GraphVisualizer/            # Full UI
│   │   │   ├── GraphView.js            # Top-level view
│   │   │   └── GraphSidebar.js         # Sidebar controls
│   │   └── GraphFilters/               # Filtering components
│   │       ├── NodeTypeFilter.js       # Type filtering
│   │       └── PriorityFilter.js       # Priority filtering
└── utils/
    └── graph/
        ├── layout.js                   # Layout algorithms
        └── transformers.js             # Data transformation utilities
```

## Development Paths (Decomposed & Prioritized)

### PATH 1A: Basic Graph Visualization (Essential MVP)

**Goal**: Minimal viable graph visualization with core functionality

#### Essential Components

- **Basic Graph Canvas**
    - Simple force-directed visualization (using `react-force-graph`)
    - Node representation for concepts and tasks
    - Basic zoom and pan controls
- **Core Data Pipeline**
    - Connect to existing WebSocket service
    - Receive and display concept/task nodes from NAR
    - Basic relationship edges (task → concept associations)

#### MVP Features List

- [ ] Basic graph canvas with zoom/pan functionality
- [ ] Simple node rendering (concepts and tasks)
- [ ] Basic color coding (blue for concepts, green for tasks)
- [ ] Connect to WebSocket service and receive NAR data
- [ ] Render basic task → concept relationships
- [ ] Development server with `npm run web:graph:dev`

### PATH 1B: Essential Controls (Essential MVP)

**Goal**: Basic system controls for demonstration and development

#### Essential Components

- **System Controls** (reuse existing patterns)
    - Pause/Resume/Step buttons
    - NAR status display (running, clock time)
    - Basic error/status reporting

#### MVP Features List

- [ ] Pause/Resume/Step controls (reusing existing patterns)
- [ ] Basic NAR status display (clock, running state)
- [ ] Basic layout with controls panel

### PATH 2A: Enhanced Node Types (Optional - Deferred)

**Goal**: Support for additional SeNARS node types (Beliefs, Goals, Questions)

#### Enhanced Components

- **Extended Node Types**
    - Belief nodes (orange) with frequency/confidence display
    - Goal nodes (red) with desire/confidence display
    - Question nodes (purple) with priority display

#### Features List

- [ ] Support for belief nodes with visual indicators for frequency/confidence
- [ ] Support for goal nodes with visual indicators for desire/confidence
- [ ] Support for question nodes with priority indicators

### PATH 2B: Enhanced Relationships (Optional - Deferred)

**Goal**: Visualize additional relationship types beyond basic task→concept

#### Enhanced Components

- **Advanced Relationships**
    - Concept → concept embedding relationships
    - Concept → concept subterm relationships
    - Task → task inference relationships

#### Features List

- [ ] Concept embedding relationship visualization
- [ ] Concept subterm relationship visualization
- [ ] Task inference relationship visualization

### PATH 3A: Basic Interaction (Optional - Deferred)

**Goal**: Enable basic user interaction with the graph

#### Interaction Components

- **Node Selection**
    - Click to select nodes
    - Visual indication of selection
- **Hover Information**
    - Show node details on hover
    - Tooltips with term content

#### Features List

- [ ] Node selection functionality
- [ ] Visual selection highlighting
- [ ] Hover tooltips with node information

### PATH 3B: Layout Options (Optional - Deferred)

**Goal**: Multiple graph layout algorithms

#### Layout Components

- **Multiple Layouts**
    - Hierarchical layout option
    - Circular layout option

#### Features List

- [ ] Hierarchical layout algorithm
- [ ] Circular layout algorithm
- [ ] Layout switching UI controls

### PATH 4A: Enhanced Styling (Optional - Deferred)

**Goal**: Enhanced visual encodings and styling

#### Styling Components

- **Advanced Visual Encoding**
    - Node size based on priority/frequency
    - Border thickness for confidence
    - Edge thickness for relationship strength
- **Visual Enhancements**
    - Directional arrows on edges
    - Edge labels

#### Features List

- [ ] Node sizing based on priority/frequency
- [ ] Border thickness based on confidence
- [ ] Edge thickness based on relationship strength
- [ ] Directional arrows on edges
- [ ] Edge labels for relationship types

### PATH 4B: Filtering & Search (Optional - Deferred)

**Goal**: Enable filtering and searching of graph elements

#### Filtering Components

- **Node/Edge Filtering**
    - Filter by type (concepts, tasks, beliefs, goals, questions)
    - Filter by priority range
- **Search Functionality**
    - Search by term content
    - Highlight search results

#### Features List

- [ ] Node type filtering controls
- [ ] Priority/range filtering
- [ ] Term content search
- [ ] Search result highlighting

### PATH 5A: Advanced Interactions (Optional - Deferred)

**Goal**: Advanced user interaction patterns

#### Advanced Interaction Components

- **Complex Selection**
    - Multi-node selection
    - Range selection
    - Related node highlighting
- **Advanced Context Menus**
    - Node-specific actions
    - Relationship-specific actions
    - Export options

#### Features List

- [ ] Multi-node selection
- [ ] Range selection tools
- [ ] Related node highlighting
- [ ] Advanced context menus with actions
- [ ] Node inspection panel

### PATH 5B: Performance Optimization (Optional - Deferred)

**Goal**: Optimize performance for larger graphs (Defer until needed)

#### Performance Components

- **Optimization Strategies**
    - Virtual rendering for large graphs (only render visible nodes)
    - Data update throttling (limit frequency of updates)

#### Features List (Consider deferring until performance issues appear)

- [ ] Virtual rendering for large graphs (only render visible nodes) - *Consider deferring until performance issues
  appear*
- [ ] Data update throttling (limit frequency of updates) - *Consider deferring until needed*

### PATH 6A: Analysis Tools (Optional - Deferred)

**Goal**: Analytical capabilities for the graph data

#### Analysis Components

- **Graph Analysis**
    - Node centrality metrics
    - Relationship strength analysis
    - Pattern detection
- **Export Capabilities**
    - Export graph as image/PDF
    - Export analysis results

#### Features List

- [ ] Node centrality analysis
- [ ] Relationship strength analysis
- [ ] Pattern detection algorithms
- [ ] Image/PDF export functionality
- [ ] Analysis result export

### PATH 6B: Timeline Visualization (Optional - Deferred)

**Goal**: Temporal visualization of reasoning evolution

#### Timeline Components

- **Temporal View**
    - Reasoning timeline
    - State evolution visualization

#### Features List

- [ ] Basic reasoning timeline view
- [ ] State evolution visualization
- [ ] Historical graph reconstruction

### Development Priorities & Pathways

#### PATH 1A & 1B: Core Foundation (Required for MVP)

- **PATH 1A**: Basic Graph Visualization - Simple graph canvas with concept/task nodes and basic relationships
- **PATH 1B**: Essential Controls - System controls and basic UI framework
- **Success Criteria**: Graph displays real-time NAR data with basic controls

#### PATH 2A & 2B: Enhanced Visualization (Recommended)

- **PATH 2A**: Enhanced Node Types - Support for beliefs, goals, questions
- **PATH 2B**: Enhanced Relationships - Concept-concept relationships, inference chains
- **Success Criteria**: Visualizes all major SeNARS entity types and relationship categories

#### PATH 3A & 3B: User Interaction (Valuable additions)

- **PATH 3A**: Basic Interaction - Node selection, tooltips, context menus
- **PATH 3B**: Layout Options - Multiple layout algorithms (hierarchical, circular, etc.)
- **Success Criteria**: Users can interact with and manipulate the graph view

#### PATH 4A & 4B: Enhanced Usability (Usability improvements)

- **PATH 4A**: Enhanced Styling - Visual encoding based on priority, confidence, etc.
- **PATH 4B**: Filtering & Search - Ability to filter and search graph elements
- **Success Criteria**: Users can find and focus on specific elements of interest

#### PATH 5A, 6A, 6B: Advanced Analysis (Power user features)

- **PATH 5A**: Advanced Interactions - Multi-selection, complex operations
- **PATH 6A**: Analysis Tools - Centrality metrics, pattern detection
- **PATH 6B**: Timeline Visualization - Evolution of reasoning over time
- **Success Criteria**: Users can perform detailed analysis of SeNARS behavior

#### PATH 5B: Performance (Optional - defer if not needed)

- **PATH 5B**: Performance Optimization - Only if performance issues arise
- **Success Criteria**: Performance is adequate for target use cases

## System Enhancement Impact

### Value to SeNARS Ecosystem

The graph visualizer implementation provides increasing value as pathways are implemented:

#### Core Value (PATH 1A & 1B)

- **Immediate Visualization**: Basic visualization of reasoning processes for debugging and education
- **Educational Tool**: Makes SeNARS concepts accessible to new users
- **Development Aid**: Simple visualization for developers to understand system behavior

#### Enhanced Value (PATH 2A, 2B, 3A, 3B)

- **Comprehensive Visualization**: Full representation of all SeNARS entity types and relationships
- **Interactive Exploration**: Users can engage with and understand complex reasoning chains
- **Insight Discovery**: Visual patterns reveal system behaviors not apparent in text logs

#### Advanced Value (PATH 4A, 4B, 5A, 6A, 6B)

- **Advanced Analysis**: Sophisticated tools for pattern recognition and performance analysis
- **Research Capabilities**: Timeline and analytical tools for studying reasoning evolution
- **Power User Features**: Filtering, search, and complex interactions for in-depth analysis

### Architecture Benefits

- **Event System Enhancement**: Graph-specific events improve system observability
- **Data Transformation**: Improved data flow and transformation pipelines across pathways
- **Component Reusability**: Enhanced component architecture benefits broader system
- **API Consistency**: Extended WebSocket APIs support additional integrations

## Implementation Approach

### Progressive Enhancement Strategy

- **Start Small**: Begin with essential PATH 1A & 1B for immediate value
- **Add Value Incrementally**: Each pathway provides tangible benefits
- **Performance-Driven Optimization**: Only optimize (PATH 5B) when bottlenecks appear
- **User-Need Driven Features**: Implement pathways based on actual user requirements

### Resource Optimization

- **Parallel Development**: Multiple team members can work on independent pathways
- **Modular Architecture**: Each pathway can be developed and tested independently
- **Reusable Components**: Architecture designed to benefit other system components
- **Minimal Overhead**: Core functionality has minimal resource requirements

## Deployment & Integration

### Development Setup

- Command: `npm run web:graph:dev` (follows existing pattern from vite.config.js)
- Serves the graph visualizer at `/graph` (maintains existing routing patterns)
- Hot reloading enabled (consistent with existing development setup)
- Development tools available (extends existing development infrastructure)

### Integration Approach

- **Extend `ui/src/components/GraphUI.js`** rather than creating duplicate functionality
- **Enhance `ui/src/components/TaskRelationshipGraph.js`** with additional capabilities
- **Integrate with `ui/src/stores/uiStore.js`** for unified state management
- **Build on `ui/src/services/WebSocketService.js`** for communication
- **Use existing theme system** from theme utilities
- **Follow existing panel patterns** from BasePanel.js and related components
- **Reuse existing visualization utilities** and component architecture

### NAR Integration

- **Extend existing WebSocketMonitor.js** rather than creating separate monitoring
- **Use existing NAR event system** (NAR_EVENTS from constants.js) with additional graph events
- **Integrate with existing WebSocket infrastructure** for real-time data streaming
- **Use existing control message patterns** for system control (pause, step, reset)
- **Transform existing NAR objects** to graph structures using existing data structures
- **Subscribe to existing NAR events** with additional graph-specific listeners

## Implementation Assessment

### Implementability Strengths

- **Well-structured pathways** that allow incremental development
- **Clear architectural integration** with existing SeNARS components
- **Good separation of concerns** between client and server components
- **Progressive enhancement approach** that delivers value early
- **Realistic dependencies** that align with existing tech stack
- **Clear MVP scope** in PATH 1A & 1B to deliver core functionality

### Implementation Concerns & Risk Mitigation

#### Critical Concerns (Address First)

1. **NAR Event Availability**: Verify that the required NAR events (`concept.created`, `task.processed`, etc.) are
   actually emitted by the NAR system:
    - **Risk**: GraphObserver may not receive necessary data if events aren't available
    - **Mitigation**: Verify event availability before implementation; implement fallback data mechanisms

2. **WebSocket Message Throughput**: Real-time streaming of graph data could overwhelm clients:
    - **Risk**: Performance degradation with active NAR systems
    - **Mitigation**: Implement conservative defaults and throttling from the start

3. **Data Transformation Complexity**: Converting NAR internal structures to graph structures may be complex:
    - **Risk**: Difficult to extract relationship information from NAR data
    - **Mitigation**: Start with simple transformations and validate with real data early

#### Implementation Recommendations

1. **Proof of Concept First**: Create a minimal working version with actual NAR data to validate assumptions before full
   development

2. **Event Verification Phase**: Spend initial time verifying NAR event availability and data structure formats

3. **Performance Monitoring**: Build in performance metrics from PATH 1A to detect issues early

4. **Incremental Integration**: Test each pathway with real NAR data as it's developed

5. **Fallback Mechanisms**: Implement graceful degradation when events aren't available or performance thresholds are
   exceeded

### Development Sequence for Risk Mitigation

1. **Phase 1**: Verify NAR event availability and data formats (before coding begins)
2. **Phase 2**: Implement PATH 1A & 1B with simple data transformations and conservative defaults
3. **Phase 3**: Test with real NAR sessions to validate performance and data availability
4. **Phase 4**: Add additional pathways based on validated requirements and performance