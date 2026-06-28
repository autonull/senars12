# SeNARS UI Development Plan (v9 - Definitive Implementation Blueprint)

## 1. Vision & Guiding Principles

This document is the final, actionable blueprint for the SeNARS web UI, built with **vanilla JavaScript and Cytoscape.js
**. It is based on a direct analysis of the server architecture and incorporates detailed implementation guidance to
ensure a robust, testable, and maintainable outcome.

### Guiding Principles:

- **Functionality Over Aesthetics**: All styling is deferred. The goal is a reliable tool.
- **Minimal Dependencies, No Frameworks**: The application will be pure ES6+ JavaScript. The only external libraries
  will be Cytoscape.js for the graph and a simple dev server.
- **Test-Driven Core**: All logic in the `WebSocketService` and `StateStore` will be developed with unit tests first.
- **Verifiable Milestones**: A functional REPL is the first deliverable, followed by the graph.
- **Architectural Coherency**: The plan is confirmed to be compatible with `src/server/WebSocketMonitor.js`, contingent
  on the mandatory implementation of server-side event batching.

---

## 2. Phase 0: Project Foundation

**Goal**: Create a clean, verifiable project environment.

| Task ID | Action                     | Details & File References                                                                                                | Verification                                                            |
|:--------|:---------------------------|:-------------------------------------------------------------------------------------------------------------------------|:------------------------------------------------------------------------|
| **0.1** | **Archive Legacy UI**      | Rename `ui` to `ui-react-legacy`.                                                                                        | `mv ui ui-react-legacy` succeeds.                                       |
| **0.2** | **Scaffold New Project**   | Create directories: `ui/`, `ui/src/`, `ui/css/`, `ui/tests/`.                                                            | `mkdir -p ui/src ui/css ui/tests` succeeds.                             |
| **0.3** | **Create HTML Shell**      | Create `ui/index.html`. It should contain placeholders, a script tag for the entry point, and the Cytoscape.js CDN link. | The file is created. **See Appendix A for content.**                    |
| **0.4** | **Setup Dev Server**       | Use `npx serve ui/`.                                                                                                     | The `index.html` page loads in a browser without errors.                |
| **0.5** | **Create App Entry Point** | Create `ui/src/main.js`. It will import and initialize all controllers. For now, it will just log to the console.        | `console.log('SeNARS UI Initialized');` appears in the browser console. |

---

## 3. Phase 1: Core Services & Logic (Headless First & Test-Driven)

**Goal**: Build and rigorously test the entire data layer without a UI, ensuring the application's backbone is flawless.

| Task ID | Action                                         | Details & File References                                                                                                                                                                                                                                                                                 | Verification                                                                                                     |
|:--------|:-----------------------------------------------|:----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|:-----------------------------------------------------------------------------------------------------------------|
| **1.1** | **Implement Server-Side Batching (Mandatory)** | **Modify: `src/server/WebSocketMonitor.js`**. Add `this.eventBuffer = [];` to the constructor. In the `start()` method, add `setInterval(() => { /* broadcast and clear buffer */ }, 150);`. Modify the existing NAR event handler to push events into `this.eventBuffer` instead of sending immediately. | Unit tests prove that a high frequency of NAR events results in a low frequency of batched WebSocket broadcasts. |
| **1.2** | **Create Configuration**                       | Create `ui/src/config.js`. It will export an object containing `WEBSOCKET_URL`, `RECONNECT_DELAY`, `MAX_LOG_ENTRIES`, etc.                                                                                                                                                                                | All constants are imported from this file. No magic strings in the codebase.                                     |
| **1.3** | **Create `WebSocketService`**                  | Create `ui/src/websocket-service.js`. It will be a class responsible for all `ws://` communication. **See Appendix B for suggested API.** It must implement an exponential backoff algorithm for reconnection attempts to avoid spamming the server.                                                      | The class and its methods are defined.                                                                           |
| **1.4** | **Unit Test `WebSocketService`**               | Create `ui/tests/websocket-service.test.js`. Use a mock WebSocket library (or a simple mock object) to test all scenarios: successful connection, connection refused, server disconnect, sending various message types, and receiving malformed JSON.                                                     | All unit tests pass, proving the service is resilient.                                                           |
| **1.5** | **Create `StateStore`**                        | Create `ui/src/state-store.js`. It will be a class implementing a publish/subscribe pattern to manage a single state object. **See Appendix C for suggested API and state structure.**                                                                                                                    | The class is defined with methods for dispatching actions and subscribing to changes.                            |
| **1.6** | **Unit Test `StateStore`**                     | Create `ui/tests/state-store.test.js`. Test all state transitions (actions): setting connection status, adding a log entry, pruning the log buffer when it exceeds `MAX_LOG_ENTRIES`, and adding/updating/removing graph nodes and edges based on batched events.                                         | All unit tests pass, proving the state logic is predictable.                                                     |

---

## 4. Phase 2: REPL - The First Usable Milestone

**Goal**: Deliver a functional REPL, validating the entire service layer.

| Task ID | Action                      | Details & File References                                                                                                                                                                                                                                                          | Verification                                                                                                                                                                     |
|:--------|:----------------------------|:-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|:---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **2.1** | **Create `REPLView`**       | Create `ui/src/repl-view.js`. This module will export an `init(container, onCommand)` function. It will programmatically create an `<input>` and a `<pre>` block, append them to `container`, and call the `onCommand` callback when the user submits input.                       | The REPL elements appear on the page.                                                                                                                                            |
| **2.2** | **Create `REPLController`** | Create `ui/src/repl-controller.js`. It will be initialized with instances of the view, store, and service. It will subscribe to the store and call view methods to render new logs. The `onCommand` callback from the view will be wired to call `WebSocketService.sendCommand()`. | The controller code is in place.                                                                                                                                                 |
| **2.3** | **Integrate & Verify REPL** | In `ui/src/main.js`, import and initialize all modules, wiring them together.                                                                                                                                                                                                      | **Manual E2E Test:** Start the server and UI. A user can type a NARS command (e.g., `<a --> b>.`), press Enter, and see the formatted server response appear in the output area. |
| **2.4** | **Implement REPL History**  | Enhance `REPLController` to use `localStorage` for command history.                                                                                                                                                                                                                | Past commands are saved between page loads and are navigable with arrow keys.                                                                                                    |

---

## 5. Phase 3: Graph Visualization

**Goal**: Implement the graph visualization using Cytoscape.js.

| Task ID | Action                         | Details & File References                                                                                                                                                                                                                                                                            | Verification                                                                                     |
|:--------|:-------------------------------|:-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|:-------------------------------------------------------------------------------------------------|
| **3.1** | **Create `GraphView`**         | Create `ui/src/graph-view.js`. It will export an `init(container)` function that initializes Cytoscape.js on the `container` element and returns the `cy` instance. **See Appendix D for sample config.**                                                                                            | An empty graph canvas is rendered.                                                               |
| **3.2** | **Create `GraphController`**   | Create `ui/src/graph-controller.js`. It will be initialized with the `cy` instance, store, and service. It subscribes to the store. On state changes, it will intelligently add, update, or remove nodes/edges. **Crucial:** All updates must be wrapped in `cy.batch()` to ensure high performance. | The controller code is in place.                                                                 |
| **3.3** | **Implement Snapshot/Refresh** | Add a "Refresh" button to `index.html`. Wire it in `main.js` to call a method on the `GraphController` which dispatches a state action and calls the `WebSocketService` to request a `control/refresh`. The service already supports this.                                                           | Clicking the button clears the graph and populates it with the `memorySnapshot` from the server. |

---

## 6. Phase 4: Integration & Controls

**Goal**: Connect all remaining UI elements and ensure the application is fully interactive and provides clear feedback
to the user.

| Task ID | Action                            | Details & File References                                                                                                                                                                                                                                                                                     | Verification                                                                                                  |
|:--------|:----------------------------------|:--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|:--------------------------------------------------------------------------------------------------------------|
| **4.1** | **Implement Controls Controller** | Create `ui/src/controls-controller.js`. It will add event listeners to the buttons in `index.html` (`#refresh-btn`, `#toggle-live-btn`).                                                                                                                                                                      | The controller is created and linked in `main.js`.                                                            |
| **4.2** | **Wire UI Controls**              | The controller will dispatch actions to the `StateStore` (e.g., `{ type: 'TOGGLE_LIVE_UPDATES' }`). The `GraphController` and `REPLController` will react to the `isLiveUpdateEnabled` state change to pause or resume processing new data. The refresh button will trigger the snapshot logic from Task 3.3. | Clicking the "Pause" button stops the graph and REPL from updating. Clicking "Refresh" repopulates the graph. |
| **4.3** | **Implement Status Bar**          | Create `ui/src/status-bar-view.js`. It will subscribe to the `StateStore` and update the `#status-bar` element's text and CSS class based on the `connectionStatus` state ('connecting', 'connected', 'disconnected', 'error').                                                                               | The status bar accurately reflects the WebSocket connection state in real-time.                               |

---

## 7. Phase 5: Polish & Finalization

**Goal**: Address basic usability, aesthetics, and performance once core functionality is rock-solid.

| Task ID | Action                       | Details & File References                                                                                                                                                                                | Verification                                                                                                              |
|:--------|:-----------------------------|:---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|:--------------------------------------------------------------------------------------------------------------------------|
| **5.1** | **Create Basic Stylesheet**  | Create `ui/css/style.css`. Add simple, clean CSS using Flexbox or Grid for the main layout. Ensure fonts are readable and components are clearly delineated. This is for usability, not aesthetics.      | The UI is organized, readable, and usable without overlapping elements.                                                   |
| **5.2** | **Performance Stress Test**  | Manually test the application by running a script or NAR process that generates a high volume of events, aiming for 1000+ graph nodes.                                                                   | The UI remains responsive (pan, zoom, input) under load. No significant memory leaks are observed over a 5-minute period. |
| **5.3** | **Performance Optimization** | If the stress test reveals issues, ensure all Cytoscape updates are wrapped in `cy.batch()`. If the REPL is slow, ensure the DOM node count is not growing infinitely (log pruning should prevent this). | The UI meets the responsiveness criteria from the stress test.                                                            |

---

## 8. Development Workflow & Testing Strategy

### Workflow

1. **Run Backend Server**: In the project root, start the SeNARS application (e.g., via `node demonstration.js` or
   `node launcher.js`) to activate the `WebSocketMonitor`.
2. **Run UI Dev Server**: In a separate terminal, run `npx serve ui/`.
3. **Develop**: Open the browser to the `localhost` address provided by `serve`. Edit code in the `ui/` directory and
   refresh the browser to see changes.

### Testing Strategy

1. **Unit Tests**: Core logic modules (`WebSocketService`, `StateStore`) **must** have comprehensive unit tests located
   in `ui/tests/`. These can be simple JS files using the native `console.assert` and run with Node.js (
   `node ui/tests/state-store.test.js`). No complex framework is needed. The goal is to verify all logic paths and error
   conditions in isolation.
2. **Manual Integration Tests**: After each phase is complete, a full manual test of the integrated features is
   required. This involves starting both server and client and following a checklist to ensure features work together as
   expected.
3. **Defensive Programming**: All modules that parse external data (especially `WebSocketService`) or receive user input
   must treat that data as untrusted. Use `try...catch` blocks for JSON parsing and validate data structures before
   processing.

---

## 9. Anticipated Problems & Mitigation (Final)

- **Problem**: **Server-Side Prerequisite Not Met**. The UI is blocked if the server-side batching (Task 1.1) is not
  implemented correctly.
    - **Mitigation**: This is the **highest priority task**. Client-side development can proceed using mock data passed
      to the `StateStore`, but cannot be fully integrated until this is done.

- **Problem**: **State Management Complexity**. Without a framework, the manual pub/sub pattern can lead to bugs if not
  used with discipline.
    - **Mitigation**: Enforce a strict one-way data flow:
      `View Event -> Controller -> Service -> Server -> Service -> Store -> Controller -> View Update`. No component
      should ever modify state directly except the `StateStore` through a dispatched action. This must be a strictly
      enforced convention.

- **Problem**: **Cytoscape Performance**. Graphs with thousands of elements can become slow.
    - **Mitigation**: Proactively use `cy.batch()` for all updates from the start. Use simple, efficient styles (
      Appendix D). Defer features like animations. If performance is still an issue, the `GraphController` will need to
      be updated to only render a subset of the data provided by the `StateStore`.

- **Problem**: **Data Validation**. Malformed data from the server or unexpected event structures could crash the
  client.
    - **Mitigation**: The `WebSocketService` **must** wrap all `JSON.parse()` calls in `try...catch`. The `StateStore` *
      *must** validate the structure of action payloads before merging them into the state. Any errors will be
      dispatched as a state change to be displayed in the status bar, preventing silent failures.

- **Problem**: **Race Conditions**. A `memorySnapshot` could arrive while a live event batch is being processed.
    - **Mitigation**: The `StateStore` will use a simple versioning system. For example, when a snapshot request is
      sent, it can set a `loadingSnapshot = true` flag. Any live events that arrive while this is true can be queued or
      discarded to ensure consistency when the snapshot arrives and the flag is cleared.

## 6. Appendices

### Appendix A: `ui/index.html`

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>SeNARS UI</title>
    <link rel="stylesheet" href="css/style.css">
</head>
<body>
    <div id="status-bar">Connecting...</div>
    <div id="main-container">
        <div id="repl-container"></div>
        <div id="cy-container"></div>
    </div>
    <div id="controls">
        <button id="refresh-btn">Refresh Graph</button>
        <button id="toggle-live-btn">Pause Live Updates</button>
    </div>
    <script src="https://unpkg.com/cytoscape/dist/cytoscape.min.js"></script>
    <script type="module" src="src/main.js"></script>
</body>
</html>
```

### Appendix B: `WebSocketService` Suggested API

```javascript
// ui/src/websocket-service.js
class WebSocketService {
    // constructor(url), connect(), disconnect(), sendMessage(type, payload)
    // Uses an internal event emitter to emit 'open', 'close', 'error', 'message' events.
}
```

### Appendix C: `StateStore` Suggested API & State

```javascript
// ui/src/state-store.js
class StateStore {
    // constructor(), subscribe(listener), getState(), dispatch(action)
    // An action is an object: { type: 'SET_CONNECTION_STATUS', payload: 'connected' }
}

// Initial State Structure:
const initialState = {
    connectionStatus: 'disconnected', // 'connected', 'connecting', 'error'
    isLiveUpdateEnabled: true,
    logEntries: [], // Array of { timestamp, content, type: 'in'|'out' }
    graph: {
        nodes: new Map(), // Use a Map for efficient lookups by ID
        edges: new Map()
    }
};
```

### Appendix D: `GraphView` Cytoscape Config

```javascript
// ui/src/graph-view.js (inside init)
const cy = cytoscape({
    container: container,
    style: [
        { selector: 'node', style: { 'label': 'data(id)' } },
        { selector: 'edge', style: { 'width': 1, 'line-color': '#ccc', 'target-arrow-shape': 'triangle' } }
    ],
    layout: { name: 'cose', animate: false }
});
```
