# **SeNARS Desktop UI Experiments: Actionable Prototype Plan**

> **Objective**: Develop **two minimal, self-contained prototypes** in parallel within the monorepo to evaluate *
*webview-based** and **native widget-based** desktop UIs.  
> Both connect to the local SeNARS engine via WebSocket and implement **core functionality**:
> - Snapshot-based graph view
> - Live update toggle
> - Log panel
> - Input bar

---

## Repository Structure

```
senars-monorepo/
├── ui/                     ← Existing Vite + React web UI (source of truth)
├── exp/
│   ├── tauri/              ← Experiment A: Tauri (webview, full reuse)
│   └── nodegui/            ← Experiment B: NodeGUI (native Qt widgets)
├── senars-engine/          ← Unchanged
├── package.json
└── README.md
```

---

## Shared Prerequisites

1. **Engine runs locally** at `ws://127.0.0.1:8080`
2. **Web UI (`ui/`)** is functional and serves as reference
3. **Node.js ≥ 20**, **npm ≥ 10**, **Rust** (for Tauri), **CMake** (for NodeGUI) installed
4. **Git** for branching and isolation

---

## EXPERIMENT A: `exp/tauri/` – Webview (Tauri 2)

### Goal

Reuse **100% of `ui/` codebase** in a native desktop binary using system webview.

### Steps

1. **Initialize Tauri Project**
   ```bash
   cd exp
   npm create tauri-app@latest tauri -- --template vanilla
   ```

2. **Copy Web UI Build Output**
   ```bash
   cp -r ../ui/dist/* tauri/src-tauri/resources/
   ```

3. **Configure `tauri.conf.json`**
   ```json
   {
     "productName": "SeNARS-Tauri",
     "bundle": {
       "identifier": "ai.x.senars.tauri",
       "icon": ["icons/32x32.png", "icons/128x128.png", "icons/256x256.png"]
     },
     "tauri": {
       "allowlist": { "all": true },
       "windows": [
         {
           "title": "SeNARS (Tauri)",
           "width": 1200,
           "height": 800,
           "resizable": true
         }
       ]
     }
   }
   ```

4. **Add Engine Launch Command (`src-tauri/src/main.rs`)**
   ```rust
   #[tauri::command]
   fn launch_engine() -> Result<(), String> {
       std::process::Command::new("../../senars-engine")
           .spawn()
           .map_err(|e| e.to_string())?;
       Ok(())
   }

   fn main() {
       tauri::Builder::default()
           .invoke_handler(tauri::generate_handler![launch_engine])
           .run(tauri::generate_context!())
           .expect("error while running tauri application");
   }
   ```

5. **Modify `ui/src/App.jsx` (Add Native Button)**
   ```jsx
   {window.__TAURI__ && (
     <button onClick={() => window.__TAURI__.invoke('launch_engine')}>
       Launch Engine (Native)
     </button>
   )}
   ```

6. **Build & Test**
   ```bash
   cd exp/tauri
   npm run tauri dev    # Hot-reload dev
   npm run tauri build  # Produces .exe, .dmg, .AppImage
   ```

7. **Verification Checklist**
    - [ ] App launches with SeNARS UI
    - [ ] WebSocket connects to `ws://127.0.0.1:8080`
    - [ ] "Refresh View" loads snapshot
    - [ ] "Live Update" toggle works
    - [ ] Graph renders ≥ 100 nodes
    - [ ] No console errors

---

## EXPERIMENT B: `exp/nodegui/` – Native Widgets (React-NodeGUI)

### Goal

Build a **minimal native UI** using Qt6 widgets and canvas, **without webview**, for maximum performance.

### Steps

1. **Scaffold NodeGUI + React**
   ```bash
   cd exp
   npx create-nodegui-app@latest nodegui --template react
   cd nodegui
   ```

2. **Install WebSocket Client**
   ```bash
   npm install ws zustand
   ```

3. **Create Minimal State Store (`src/store.js`)**
   ```js
   import { create } from 'zustand';
   export const useStore = create((set) => ({
     nodes: [],
     edges: [],
     log: [],
     live: true,
     setSnapshot: (data) => set({ nodes: data.nodes, edges: data.edges }),
     appendLog: (entry) => set((s) => ({ log: [...s.log, entry].slice(-500) })),
     toggleLive: () => set((s) => ({ live: !s.live })),
   }));
   ```

4. **Implement WebSocket Service (`src/nar-service.js`)**
   ```js
   import WebSocket from 'ws';
   import { useStore } from './store';

   const ws = new WebSocket('ws://127.0.0.1:8080');
   const store = useStore.getState();

   ws.on('message', (data) => {
     const msg = JSON.parse(data);
     if (msg.type === 'snapshot') store.setSnapshot(msg);
     else if (store.live) store.appendLog(msg);
   });

   export const requestSnapshot = () => {
     ws.send(JSON.stringify({ type: 'request_snapshot', limit: 100 }));
   };
   ```

5. **Build `GraphPanel` with Canvas (`src/GraphPanel.tsx`)**
   ```tsx
   import { Canvas, View } from '@nodegui/react-nodegui';
   import { useStore } from './store';

   const style = `flex: 1; background: #1a1a1a;`;

   export function GraphPanel() {
     const { nodes, edges } = useStore();
     const canvasRef = React.useRef();

     React.useEffect(() => {
       const ctx = canvasRef.current?.getContext('2d');
       if (!ctx) return;
       ctx.clearRect(0, 0, 1200, 800);
       nodes.forEach(n => {
         ctx.fillStyle = '#4f46e5';
         ctx.fillRect(n.x - 8, n.y - 8, 16, 16);
       });
       edges.forEach(e => {
         ctx.strokeStyle = '#666';
         ctx.beginPath();
         ctx.moveTo(e.sourceX, e.sourceY);
         ctx.lineTo(e.targetX, e.targetY);
         ctx.stroke();
       });
     }, [nodes, edges]);

     return (
       <View style={style}>
         <Canvas ref={canvasRef} width={1200} height={800} />
       </View>
     );
   }
   ```

6. **Assemble `App.tsx`**
   ```tsx
   import { Window, View, Text, Button, TextInput } from '@nodegui/react-nodegui';
   import { GraphPanel } from './GraphPanel';
   import { useStore } from './store';
   import { requestSnapshot } from './nar-service';

   const containerStyle = `flex: 1; flex-direction: column;`;
   const barStyle = `height: 40; padding: 8; background: #2d2d2d; flex-direction: row;`;

   export function App() {
     const { live, toggleLive } = useStore();

     return (
       <Window style={`flex: 1;`} windowTitle="SeNARS (NodeGUI)">
         <View style={containerStyle}>
           <View style={barStyle}>
             <Button text="Refresh" on={{ clicked: requestSnapshot }} />
             <Button text={live ? 'Live: ON' : 'Live: OFF'} on={{ clicked: toggleLive }} />
             <TextInput placeholder="Enter NARs command..." />
           </View>
           <GraphPanel />
         </View>
       </Window>
     );
   }
   ```

7. **Build & Test**
   ```bash
   npm run start     # Dev mode
   npm run build
   npm run pack:win  # → .exe
   ```

8. **Verification Checklist**
    - [ ] Native window opens
    - [ ] WebSocket connects
    - [ ] "Refresh" loads graph
    - [ ] Live toggle pauses updates
    - [ ] Canvas renders nodes/edges
    - [ ] No webview, no browser engine

---

## Final Deliverables

| Path            | Output                                           |
|-----------------|--------------------------------------------------|
| `exp/tauri/`    | `senars-tauri.exe`, `.dmg`, `.AppImage`          |
| `exp/nodegui/`  | `senars-nodegui.exe`                             |
| `comparison.md` | Bundle size, cold start, FPS, memory, code reuse |

---

## Success Criteria (Both Prototypes)

| Feature                           | Required |
|-----------------------------------|----------|
| Connect to `ws://127.0.0.1:8080`  | Yes      |
| Render ≥ 100 nodes + edges        | Yes      |
| "Live Update" toggle              | Yes      |
| Input command → log entry         | Yes      |
| No crashes on launch              | Yes      |
| Runs offline (after engine start) | Yes      |

---

**Next Step**: Run both, measure, decide.  
**No shared code between `exp/tauri` and `exp/nodegui`** — pure isolation.  
**All code self-contained** — delete either folder without impact.

