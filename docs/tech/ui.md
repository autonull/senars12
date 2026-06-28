# SeNARS UI Integration Documentation

This document describes the integration between the different UI components (Web UI and TUI) and the core SeNARS system.

## Overview

SeNARS provides multiple user interfaces to interact with the NARS reasoning engine:

1. **Web UI** (`ui/`): A full-featured web-based interface built with React and Vite
2. **TUI** (`tui/`): A lightweight terminal-based interface built with Node.js and blessed

Both interfaces connect to the same backend agent service, ensuring consistent behavior across platforms.

## Architecture

```
+-------------------+    +-------------------+
|    Web UI         |    |     TUI           |
|  (React/Vite)     |    |  (Node.js/blessed)|
+-------------------+    +-------------------+
           |                       |
           |    Shared Protocol    |
           +-----------------------+
                        |
           +------------------------+
           | Agent Service (WS)   |
           | (agent/server.js)    |
           +------------------------|
                        |
        +------------------------------+
        | Core NARS System             |
        | (core/, agent/ modules)      |
        +------------------------------+
```

## Communication Protocol

Both UIs use the same WebSocket-based communication protocol to interact with the agent service:

### Common Message Types

- `narsese` - Send Narsese statements to the agent
- `agentControl` - Start/stop/reset agent
- `get_tasks` - Retrieve current tasks
- `add_task` - Add a new task
- `search` - Search agent memory
- `get_system_stats` - Get system statistics
- `get_config` - Get agent configuration

### Common Events from Agent

- `system_stats` - System statistics updates
- `add_belief` - New belief created
- `add_goal` - New goal created
- `add_question` - New question created
- `reasoning_step` - Reasoning step executed
- `logMessage` - Log messages

## Shared Communication Service

To ensure consistent communication behavior, both UIs use a shared communication service:

- **Location**: `common/services/AgentCommunicationService.js`
- **Purpose**: Provides consistent connection management, message queuing, and reconnection logic
- **Adaptation**:
    - Web UI: Uses browser WebSocket API
    - TUI: Uses Node.js `ws` library

## Integration Points

### Web UI Integration

- Uses the shared service while maintaining Y.js CRDT functionality for collaboration
- Enhanced error handling and logging
- Message queuing and reconnection logic
- Consistent event system across interfaces

### TUI Integration

- Lightweight terminal interface for quick interactions
- Real-time updates from agent
- Command-based interface with help system
- Simple task management and monitoring

## Backend Components

### Agent Service (`agent/server.js`)

- WebSocket server for UI connections
- Event broadcasting to connected clients
- File system access for file operations
- Command execution capabilities
- Memory and reasoning integration

### Core System (`core/`)

- NARS reasoning engine
- Memory management
- Task processing
- Configuration system

## Development Workflow

### Adding New Features

1. Define new message types in the protocol
2. Implement backend support in `agent/server.js`
3. Add shared communication logic in `common/services/`
4. Implement UI handling in both Web and TUI interfaces

### Testing

- Unit tests for shared communication service
- Integration tests for UI-to-agent communication
- End-to-end tests for complete workflows

## Best Practices

1. **Consistent Protocol**: Ensure both UIs handle messages consistently
2. **Error Handling**: Implement robust error handling and user feedback
3. **Connection Management**: Proper reconnection and message queuing
4. **Event Handling**: Consistent event emission and UI updates
5. **Performance**: Optimize for real-time updates without overwhelming the UI

## Troubleshooting

### Common Issues

- Connection timeouts: Check agent service status
- Message queuing: Verify WebSocket connection state
- UI inconsistencies: Ensure both interfaces use the shared service
- CRDT conflicts: May require Y.js specific handling in Web UI only

### Debugging

- Enable detailed logging in agent service
- Monitor WebSocket connections
- Check protocol message format consistency