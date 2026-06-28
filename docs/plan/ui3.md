# SeNARS UI Development Plan (v8 - Vanilla JS & Cytoscape.js - Final)

## 1. Vision & Guiding Principles

This document outlines the definitive, phased plan to build the new SeNARS web UI using **vanilla JavaScript and
Cytoscape.js**. Its goal is a **highly functional, testable, and robust application** that prioritizes core logic and
early, verifiable delivery of usable features. This plan is based on an analysis of the existing `src/server/`
architecture and is designed to mitigate all anticipated risks.

### Guiding Principles:

- **Functionality Over Aesthetics**: Defer all styling and non-essential UI polish. The initial goal is a "functionally
  ugly" but completely reliable tool.
- **Minimal Dependencies**: The core application will be vanilla JavaScript (ES6+). Cytoscape.js will be used for the
  graph. A simple static file server (like `npx serve`) will be used for development. No frameworks or bundlers.
- **Test-Driven Core Logic**: The WebSocket service and state management logic are the highest-risk components. They
  will be built and unit-tested *before* any UI code is written.
- **Incremental, Verifiable Delivery**: A functional REPL is the first deliverable, followed by the graph.
- **Architectural Coherency**: This plan is confirmed to be compatible with the existing server-side `WebSocketMonitor`,
  with the key prerequisite of implementing server-side event batching.

---

## 2. Asynchronous State Synchronization Strategy (Mandatory)

The strategy is unchanged and confirmed to be necessary after server analysis.

- **Layer 1: Server-Side Buffering & Throttling (Mandatory Prerequisite)**: The `WebSocketMonitor` **must** be modified
  to buffer high-frequency events. It currently sends events instantly. This must be changed to collect events and
  broadcast them in batches every 100-200ms.
- **Layer 2: Client-Side Batch Processing**: The client's `WebSocketService` will be built to receive these batches and
  pass them to a central `StateStore` for atomic processing.
- **Layer 3: Client-Controlled View**: The UI will use the server's existing `control/refresh` command to get a full
  `memorySnapshot` for initial population. A "Live Update" toggle will control the processing of real-time event
  batches.

---

## 3. Phase 0: Project Foundation

**Goal**: Create a clean, minimal, and fully verified project environment.

| Task ID | Action                      | Details & Commands                                                                                     | Verification                                             |
|:--------|:----------------------------|:-------------------------------------------------------------------------------------------------------|:---------------------------------------------------------|
| **0.1** | **Archive Legacy UI**       | Rename `ui` to `ui-react-legacy`.                                                                      | `mv ui ui-react-legacy`                                  |
| **0.2** | **Scaffold New Project**    | Create `ui/`, `ui/src/`, `ui/css/`, `ui/tests/`.                                                       | `mkdir -p ui/src ui/css ui/tests`                        |
| **0.3** | **Create Basic HTML Shell** | Create `ui/index.html` with placeholders: `<div id="repl">`, `<div id="cy">`, `<div id="status-bar">`. | The file exists and has the required DOM elements.       |
| **0.4** | **Setup Dev Server**        | Use `npx serve ui/`.                                                                                   | The `index.html` page loads successfully in a browser.   |
| **0.5** | **Create App Entry Point**  | Create `ui/src/main.js` which logs a confirmation to the console. Link it in `index.html`.             | The confirmation message appears in the browser console. |

---

## 4. Phase 1: Core Services & Logic (Headless First & Test-Driven)

**Goal**: Build and rigorously test the entire data layer *without* a UI.

| Task ID | Action                                         | Details & Concerns                                                                                                                                                                                                                                               | Verification                                                                                                                                            |
|:--------|:-----------------------------------------------|:-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|:--------------------------------------------------------------------------------------------------------------------------------------------------------|
| **1.1** | **Implement Server-Side Batching (Mandatory)** | **Modify `WebSocketMonitor.js`**. Intercept events from the `_nar` instance. Instead of broadcasting immediately, push them to a buffer. Use `setInterval` to broadcast and clear this buffer every 100ms.                                                       | A unit test verifies that a mock engine emitting 1k events/sec results in the monitor emitting ≤10 batches/sec. This is the most critical prerequisite. |
| **1.2** | **Create `Configuration` file**                | Create `ui/src/config.js` to store the WebSocket URL, reconnection timings, and other constants.                                                                                                                                                                 | All constants are sourced from this file, no magic strings in other modules.                                                                            |
| **1.3** | **Create `WebSocketService`**                  | Create `ui/src/websocket-service.js`. It must manage connection state, expose `connect()` and `sendCommand()` methods, and use an event-emitter pattern for incoming messages.                                                                                   | The class is self-contained and exposes a clear API.                                                                                                    |
| **1.4** | **Unit Test `WebSocketService`**               | Create `ui/tests/websocket-service.test.js`. **Sub-tasks**: Test successful connection, graceful handling of failed connection, automatic reconnection logic after a disconnect, command sending, and parsing of valid/invalid JSON messages from a mock server. | All unit tests pass, proving the service is reliable under various network conditions.                                                                  |
| **1.5** | **Create `StateStore`**                        | Create `ui/src/state-store.js` as a class that manages all application state (logs, graph elements, connection status). Implement a publish/subscribe pattern for state changes.                                                                                 | The class provides methods like `getState()`, `dispatch(action)`, and `subscribe(listener)`.                                                            |
| **1.6** | **Unit Test `StateStore`**                     | Create `ui/tests/state-store.test.js`. **Sub-tasks**: Test initial state, adding log entries, pruning logs to a max size (e.g., 1000 entries), adding/updating/removing graph nodes and edges, and ensuring subscribers are correctly notified on changes.       | All unit tests pass, proving state logic is predictable and correct.                                                                                    |

---

## 5. Phase 2: REPL - The First Usable Milestone

**Goal**: Deliver a functional REPL to validate the entire service layer with a real UI.

| Task ID | Action                          | Details & Concerns                                                                                                                                                                                                                  | Verification                                                                                                                                                                                                    |
|:--------|:--------------------------------|:------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|:----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **2.1** | **Create `REPLView` Component** | Create `ui/src/repl-view.js`. This module will be responsible for creating the REPL's DOM elements (input field, output container) and appending them to the `<div id="repl">` placeholder.                                         | The REPL input and output areas are visible on the page.                                                                                                                                                        |
| **2.2** | **Create `REPLController`**     | Create `ui/src/repl-controller.js`. This controller will listen for form submission from the `REPLView`, send commands via the `WebSocketService`, and subscribe to the `StateStore` to update the `REPLView` with new log entries. | The controller correctly orchestrates data flow between the view and the services.                                                                                                                              |
| **2.3** | **Integrate & Verify REPL**     | In `main.js`, initialize and connect all components.                                                                                                                                                                                | **E2E Manual Test:** Start the server and UI. A user can type a NARS command, press Enter, and see the formatted response from the server appear in the output area. This is the first major success milestone. |
| **2.4** | **Implement REPL History**      | Enhance `REPLController` to use `localStorage` for saving command history and listen for up/down arrow keys.                                                                                                                        | Past commands are saved between page loads and can be navigated.                                                                                                                                                |

---

## 6. Phase 3: Graph Visualization

**Goal**: Implement the graph visualization using Cytoscape.js.

| Task ID | Action                         | Details & Concerns                                                                                                                                                                                     | Verification                                                                                     |
|:--------|:-------------------------------|:-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|:-------------------------------------------------------------------------------------------------|
| **3.1** | **Add Cytoscape.js**           | Add the library via a CDN link in `index.html`.                                                                                                                                                        | The `cytoscape` global is available in the browser console.                                      |
| **3.2** | **Create `GraphView`**         | Create `ui/src/graph-view.js`. It will initialize a Cytoscape instance on the `<div id="cy">` element with a basic layout (e.g., `cose`) and style.                                                    | An empty graph canvas with a background is rendered.                                             |
| **3.3** | **Create `GraphController`**   | Create `ui/src/graph-controller.js`. It will subscribe to the `StateStore` and efficiently update the `GraphView` (Cytoscape instance) when graph elements change, using `cy.batch()` for performance. | Graph elements received from the server are rendered by Cytoscape.                               |
| **3.4** | **Implement Snapshot/Refresh** | Add a "Refresh View" button to the HTML. Wire it to a `GraphController` method that calls `WebSocketService.sendCommand({type: 'control/refresh'})`.                                                   | Clicking the button clears the graph and populates it with the `memorySnapshot` from the server. |

---

## 7. Phase 4 & 5: Integration, Controls & Polish (Deferred)

**Goal**: Add final UI controls and address non-functional requirements once core functionality is stable.

| Task ID | Action                                  | Details & Concerns                                                                                              | Verification                                                                                                                          |
|:--------|:----------------------------------------|:----------------------------------------------------------------------------------------------------------------|:--------------------------------------------------------------------------------------------------------------------------------------|
| **4.1** | **Implement UI Controls**               | Add buttons for "Toggle Live Updates", "Clear Log", and a status bar for connection state.                      | The controls are visible and wired to the `StateStore`. Toggling live updates correctly starts/stops the processing of event batches. |
| **4.2** | **Defensive UI Logic**                  | Add error handling to display connection errors or server error messages in the status bar or REPL output.      | If the WebSocket disconnects, a clear "Disconnected" message appears.                                                                 |
| **5.1** | **Basic Styling**                       | Apply minimal, clean CSS for layout and readability.                                                            | The UI is organized and usable.                                                                                                       |
| **5.2** | **Performance Analysis & Optimization** | Test with a large graph (1000+ nodes). If slow, implement optimizations like view culling or simplified styles. | The UI remains responsive under load.                                                                                                 |

---

## 9. Anticipated Problems & Mitigation

- **Server-Side Prerequisite**: The mandatory **server-side batching** is the biggest dependency.
    - **Mitigation**: This is **Task 1.1** and must be completed before the UI can be meaningfully tested E2E.
- **Cytoscape.js Performance**: Very large graphs (>5,000 elements) can be slow.
    - **Mitigation**: Defer complex rendering. Use simple node/edge styles initially. Plan for performance optimization
      in **Phase 5**.
- **State Management Complexity**: A manual pub/sub pattern requires discipline.
    - **Mitigation**: Enforce a strict, clean interface for the `StateStore`. All state modifications MUST go through
      the store.
- **Browser Compatibility**:
    - **Mitigation**: Use modern but widely-supported ES6+ features and Web APIs. Avoid experimental features. Test on
      latest versions of Chrome and Firefox.
- **Data Validation**: Server data might be malformed.
    - **Mitigation**: The `WebSocketService` will wrap message parsing in `try...catch` blocks. The `StateStore` will
      validate data before merging it into the state.
