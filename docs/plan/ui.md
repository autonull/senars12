# SeNARS UI Development Plan (v5 - Revised)

## 1. Vision & Guiding Principles

This document outlines a phased, actionable plan to build a new web UI for SeNARS. The primary goal is a **maintainable,
testable, and resilient application** that serves as a powerful, scalable window into the reasoning engine. This revised
plan incorporates lessons from previous development cycles to de-risk the project and ensure a robust outcome.

### Guiding Principles:

- **Project Consistency**: The UI will be written in **JavaScript (ES6+) with JSX**, using JSDoc for annotations, to
  maintain consistency with the core SeNARS codebase.
- **Scalable State Management**: The architecture will handle high-speed engine operation via a **mandatory server-side
  batching protocol** and a client-controlled, partial state model.
- **Testability is Non-Negotiable**: Every piece of logic and every component will be developed with testing in mind,
  from day one.
- **Incremental, Verifiable Steps**: The project is decomposed into small, achievable tasks, each with a clear,
  verifiable outcome that is confirmed before proceeding.

---

## 2. Asynchronous State Synchronization Strategy (Mandatory)

The core architectural challenge is to decouple the high-speed NAR engine from the human-speed UI. The UI cannot and
should not render every event in real-time. Our goal is **asynchronous eventual consistency**, built on a mandatory,
protocol-level batching strategy.

This is a **producer-consumer** problem. The server **must** act as a buffer to protect the client from being
overwhelmed.

### Layer 1: Server-Side Buffering & Throttling (Mandatory Prerequisite)

The `WebSocketMonitor` **must** be modified to buffer high-frequency events from the NAR engine. It will collect events
and send them in configurable batches (e.g., every 100ms). This transforms a flood of micro-updates into a predictable,
manageable stream. Client-side throttling alone is insufficient and will fail under load.

### Layer 2: Client-Side Batch Processing & State Resilience

The client will be designed to handle these event batches efficiently. The `nar-service` will pass the entire batch to
the state store, which will process it in a single, atomic update. The store will also include logic to handle race
conditions, stale data, and memory management (log pruning).

### Layer 3: Client-Controlled View & Updates

The client will manage a "focus window" on the server's state.

1. **Snapshot-Based View**: The user requests a *snapshot* to populate the initial view. A loading indicator will
   prevent duplicate requests.
2. **Filtered Real-time Updates**: The batched event stream updates the graph *only if* the concepts are within the
   client's current view and the events are not stale (i.e., older than the last snapshot).
3. **User Control**: A "Live Update" toggle will allow the user to pause the processing of the real-time stream for
   inspection.

---

## 3. Phase 0: Project Foundation & Toolchain Verification

**Goal**: To create a clean, modern project environment and **verify that all tools work together** before writing
application code.

| Task ID | Action                        | Details & Commands                                                                                                                                    | Verification                                                                                                        |
|:--------|:------------------------------|:------------------------------------------------------------------------------------------------------------------------------------------------------|:--------------------------------------------------------------------------------------------------------------------|
| **0.1** | **Archive Legacy UI**         | Rename `ui` to `ui-old`.                                                                                                                              | `ui-old/` exists; `ui/` is absent.                                                                                  |
| **0.2** | **Scaffold New Project**      | `npm create vite@latest ui -- --template react`                                                                                                       | New `ui/` directory is created.                                                                                     |
| **0.3** | **Install Dependencies**      | `cd ui && npm install zustand reactflow`                                                                                                              | Dependencies are in `ui/package.json`.                                                                              |
| **0.4** | **Install Dev Dependencies**  | `cd ui && npm install -D playwright @playwright/test @vitejs/plugin-react vitest jsdom @testing-library/react eslint prettier eslint-config-prettier` | Dev dependencies are in `ui/package.json`.                                                                          |
| **0.5** | **Configure Linting**         | Set up `eslint.config.js` and `.prettierrc` with auto-fix on save.                                                                                    | `npm run lint` passes on the template files.                                                                        |
| **0.6** | **Configure `.gitignore`**    | Add a comprehensive `.gitignore` for Vite, Storybook, Playwright reports, and IDE files.                                                              | Build artifacts and test reports are not tracked by Git.                                                            |
| **0.7** | **E2E Smoke Test (Critical)** | Create a minimal `App.jsx` that renders `<p>Hello World</p>`. Write a Playwright test that navigates to the page and asserts the text is visible.     | `npm run test:e2e` runs successfully. This confirms Vite, Playwright, and the test runner are configured correctly. |
| **0.8** | **Update Root Scripts**       | Modify root `package.json` scripts (`web:dev`, `test:ui`, etc.).                                                                                      | Scripts correctly run commands inside the `ui/` directory.                                                          |

---

## 4. Phase 1: Isolated Component Development

**Goal**: To build and visually test all core UI components in isolation, with ongoing documentation.

| Task ID | Component                     | Action & Details                                                                                   | Verification                                                                                                                         |
|:--------|:------------------------------|:---------------------------------------------------------------------------------------------------|:-------------------------------------------------------------------------------------------------------------------------------------|
| **1.1** | **`LogPanel` & `LogEntry`**   | Create `.jsx` files and `.stories.jsx` files for components. Add JSDoc to all props and functions. | Stories exist for different event types and auto-scrolling. Unit tests pass.                                                         |
| **1.2** | **`InputBar` & `ControlBar`** | Create `.jsx` and `.stories.jsx` files. Add JSDoc. `ControlBar` props will be optional.            | Stories exist for all states. Callbacks are tested. Unit tests pass.                                                                 |
| **1.3** | **`ViewControls`**            | Create `src/components/ViewControls.jsx` and stories. Add JSDoc.                                   | Stories exist for all states, including invalid inputs (e.g., limit=-1). Callbacks are fired correctly. Unit tests pass.             |
| **1.4** | **`GraphPanel`**              | Create `src/components/GraphPanel.jsx`. Props: `nodes`, `edges`. Add JSDoc.                        | Stories exist for an empty graph, a simple populated graph, and a high-load graph (500+ nodes) to check for performance bottlenecks. |
| **1.5** | **`AppLayout`**               | Assemble all other components into the final UI layout. Add JSDoc.                                 | The component renders the full layout structure correctly in Storybook.                                                              |

---

## 5. Phase 2: Application Assembly & Resilient State

**Goal**: To implement mandatory server-side changes and wire components to a resilient central store.

| Task ID | Action                                         | Details & Concerns                                                                                                                                                                                                                                                                       | Verification                                                                                                                                                                                         |
|:--------|:-----------------------------------------------|:-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|:-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **2.1** | **Implement Server-Side Batching (Mandatory)** | Modify `WebSocketMonitor` to buffer events from the engine and emit them in batches at a configurable interval (default 100ms).                                                                                                                                                          | Unit test with a mock engine emitting 1k events/sec verifies that the monitor emits ≤10 batches/sec.                                                                                                 |
| **2.2** | **Implement WebSocket Service**                | Create `ui/src/services/nar-service.js` with logic for requests, reconnection, and error handling.                                                                                                                                                                                       | Unit tests (with a mock WebSocket) verify snapshot requests and batched event parsing.                                                                                                               |
| **2.3** | **Define Resilient State Store**               | Create `ui/src/store/nar-store.js` using Zustand. State: `viewQuery`, `liveUpdateEnabled`, `logEntries`, `graphNodes`, `graphEdges`, `isSnapshotLoading`, `lastSnapshotTime`. Actions: `handleSnapshot`, `handleEventBatch` (discards stale events), `pruneLog` (keeps last 1k entries). | All actions are unit tested, especially the filtering and pruning logic.                                                                                                                             |
| **2.4** | **Assemble the Application**                   | In `ui/src/App.jsx`, connect components to the store. Wire `ViewControls` to actions. Use React Flow's `onLoad` to auto-zoom the graph.                                                                                                                                                  | The application renders. Interacting with `ViewControls` updates the store. Clicking "Refresh" calls the service.                                                                                    |
| **2.5** | **Manual Verification**                        | Run the UI and backend (`launcher.js`).                                                                                                                                                                                                                                                  | **1.** UI loads without console errors. **2.** "Refresh View" shows a loading state and populates the graph. **3.** Live updates work and can be toggled. **4.** Logs do not exceed the prune limit. |

---

## 6. Phase 3: End-to-End Integration & Refinement

**Goal**: To build a comprehensive E2E test suite and polish the UI.

| Task ID | Action                             | Details & Concerns                                                                                                                                                                                                                                       | Verification                                                                          |
|:--------|:-----------------------------------|:---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|:--------------------------------------------------------------------------------------|
| **3.1** | **Write E2E Tests**                | Create `ui/e2e/main-workflow.spec.js` using Playwright. Test the happy path (snapshot, live update, toggle). Add tests for edge cases: toggling live update during a snapshot fetch, invalid inputs, and graceful UI handling of a WebSocket disconnect. | The E2E test suite runs and passes reliably in a headless browser.                    |
| **3.2** | **Add Accessibility (a11y) Tests** | Use Playwright's a11y checks to ensure the application is usable.                                                                                                                                                                                        | `expect(page).toHaveNoViolations()` passes on all main views.                         |
| **3.3** | **Styling & Theming**              | Implement a consistent and clean CSS theme. Add loading indicators, visual feedback for live status, and ensure the graph is readable in both light and dark modes.                                                                                      | The application is visually coherent and provides clear user feedback. Manual review. |
