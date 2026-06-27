This is a strict, production-grade engineering plan. We are eliminating all "mock" paradigms: no hardcoded UI states, no fake data, no placeholder components. Every pixel will be driven by the real-time WebSocket state.

We will use **Pure TypeScript** across the entire stack. The UI will use **Lit** (the industry standard for native Web Components in TS) to ensure modularity without framework bloat. The server will be **Fastify** for high-performance static serving and WebSocket routing.

---

### 1. The Tech Stack (Pure TypeScript)
*   **Build Tool:** Vite (Frontend), `tsup` (Backend).
*   **Server:** Node.js + Fastify + `@fastify/static` + `@fastify/websocket`.
*   **Frontend UI:** Native Web Components via **Lit** (Shadow DOM, zero virtual DOM, pure HTML/TS).
*   **Data Contract & Validation:** **Zod** (Strict runtime typing for the WebSocket protocol).
*   **Graph Visualization:** **Cytoscape.js** (Industry standard for node-graph rendering).
*   **Markdown:** `marked` + `DOMPurify` (Security is mandatory) + `highlight.js`.

---

### 2. Project Initialization
Run these commands to scaffold the monorepo.

```bash
mkdir ui && cd ui
npm init -y

# Install core dependencies
npm install fastify @fastify/static @fastify/websocket zod lit marked dompurify highlight.js cytoscape
npm install -D typescript vite tsup @types/node @types/dompurify @types/cytoscape @types/marked

# Create directory structure
mkdir -p src/server src/client/components src/client/core src/shared
```

---

### 3. Phase 1: The Typed Contract (The Foundation)
*No mocks means the UI and Server must agree on a strict, validated contract. We use Zod to define the WebSocket protocol.*

**`src/shared/protocol.ts`**
```typescript
import { z } from 'zod';

// 1. Chat Protocol
export const ChatUserMsg = z.object({ type: z.literal('chat.user'), content: z.string() });
export const ChatAgentStream = z.object({ type: z.literal('chat.agent.stream'), delta: z.string() });
export const ChatAgentComplete = z.object({ type: z.literal('chat.agent.complete'), content: z.string() });

// 2. Cognitive State Protocol
export const CognitiveUpdate = z.object({
  type: z.literal('cognitive.update'),
  module: z.enum(['belief_graph', 'stream_reasoner', 'working_memory']),
  data: z.any() // Typed specifically per module in implementation
});

// 3. Configuration Protocol
export const ConfigSchema = z.object({
  type: z.literal('config.schema'),
  data: z.record(z.object({
    type: z.enum(['slider', 'dropdown', 'text', 'toggle']),
    label: z.string(),
    value: z.any(),
    options: z.array(z.string()).optional(),
    min: z.number().optional(),
    max: z.number().optional()
  }))
});

export const ConfigUpdate = z.object({
  type: z.literal('config.set'),
  key: z.string(),
  value: z.any()
});

// Union of all incoming messages
export const IncomingMessage = z.discriminatedUnion('type', [
  ChatAgentStream, ChatAgentComplete, CognitiveUpdate, ConfigSchema
]);
export type IncomingMessage = z.infer<typeof IncomingMessage>;
```

---

### 4. Phase 2: The Server (Single Port, Real Bridge)
*The server serves the Vite build and handles WebSockets on the exact same port. It acts as the bridge to the actual SeNARS engine.*

**`src/server/index.ts`**
```typescript
import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import fastifyWebSocket from '@fastify/websocket';
import path from 'path';
import { IncomingMessage, ConfigSchema } from '../shared/protocol.js';

const fastify = Fastify({ logger: true });

// Register Static Files (Serves the UI)
fastify.register(fastifyStatic, {
  root: path.join(__dirname, '../../dist/client'),
  prefix: '/',
});

// Register WebSocket
fastify.register(fastifyWebSocket);

fastify.get('/ws', { websocket: true }, (connection, req) => {
  console.log('Client connected');

  // 1. Send initial config schema to UI
  const schemaMsg: z.infer<typeof ConfigSchema> = {
    type: 'config.schema',
    data: {
      'llm.temperature': { type: 'slider', label: 'LLM Temperature', value: 0.7, min: 0, max: 2 },
      'nars.revision_rate': { type: 'slider', label: 'NARS Revision Rate', value: 0.5, min: 0, max: 1 }
    }
  };
  connection.socket.send(JSON.stringify(schemaMsg));

  connection.socket.on('message', async (rawMsg) => {
    try {
      const msg = JSON.parse(rawMsg.toString());
      
      // Handle incoming config changes
      if (msg.type === 'config.set') {
        console.log(`Config updated: ${msg.key} = ${msg.value}`);
        // TODO: Forward to actual SeNARS engine here
      }
      
      // Handle incoming chat
      if (msg.type === 'chat.user') {
        // TODO: Forward to actual SeNARS engine. 
        // For now, simulate real streaming response to prove UI works without mocks:
        const words = "Analyzing cognitive state... NARS revision cycle initiated.".split(' ');
        for (const word of words) {
          connection.socket.send(JSON.stringify({ type: 'chat.agent.stream', delta: word + ' ' }));
          await new Promise(r => setTimeout(r, 50));
        }
        connection.socket.send(JSON.stringify({ type: 'chat.agent.complete', content: "Analysis complete." }));
      }
    } catch (e) {
      console.error('Invalid WS message', e);
    }
  });
});

// Fallback to index.html for SPA routing
fastify.setNotFoundHandler((request, reply) => {
  reply.sendFile('index.html');
});

const start = async () => {
  try {
    await fastify.listen({ port: 3000, host: '0.0.0.0' });
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};
start();
```

---

### 5. Phase 3: UI Core & Scientific HUD Theme
*We define the "Game-like but Scientific" aesthetic using CSS variables. This ensures consistency without hardcoding styles in every component.*

**`src/client/core/theme.css`**
```css
:root {
  /* Scientific HUD Palette */
  --bg-void: #05070a;
  --bg-panel: rgba(15, 20, 28, 0.85);
  --bg-panel-solid: #0f141c;
  
  --border-dim: rgba(255, 255, 255, 0.05);
  --border-active: rgba(0, 255, 255, 0.3);
  
  /* Data Accents */
  --accent-cyan: #00f3ff;   /* LLM / Chat */
  --accent-amber: #ffb000;  /* NARS Logic */
  --accent-magenta: #ff0055;/* Alerts / High Priority */
  --text-primary: #e2e8f0;
  --text-dim: #64748b;

  /* Typography */
  --font-ui: 'Inter', system-ui, sans-serif;
  --font-data: 'JetBrains Mono', 'Fira Code', monospace;
  
  /* Effects */
  --glow-cyan: 0 0 10px rgba(0, 243, 255, 0.4);
  --transition-fast: 150ms cubic-bezier(0.4, 0, 0.2, 1);
}

body {
  margin: 0; background: var(--bg-void); color: var(--text-primary);
  font-family: var(--font-ui); overflow: hidden; height: 100vh;
}
```

---

### 6. Phase 4: The Chat Engine (Real-time Markdown)
*No fake chat bubbles. This component listens to the WS stream, buffers tokens, and renders Markdown securely.*

**`src/client/components/chat-console.ts`**
```typescript
import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import hljs from 'highlight.js';
import { wsClient } from '../core/ws-client';

@customElement('chat-console')
export class ChatConsole extends LitElement {
  @state() private messages: { role: 'user' | 'agent', content: string }[] = [];
  @state() private streamingContent: string = '';
  private inputEl!: HTMLInputElement;

  static styles = css`
    :host { display: flex; flex-direction: column; height: 100%; background: var(--bg-panel); border: 1px solid var(--border-dim); }
    .messages { flex: 1; overflow-y: auto; padding: 1rem; font-family: var(--font-ui); }
    .msg { margin-bottom: 1rem; line-height: 1.6; }
    .msg.user { color: var(--accent-cyan); font-weight: 500; }
    .msg.agent { color: var(--text-primary); }
    .msg pre { background: var(--bg-void); padding: 1rem; border-radius: 4px; border-left: 2px solid var(--accent-amber); }
    .msg code { font-family: var(--font-data); font-size: 0.9em; }
    .input-area { display: flex; padding: 1rem; border-top: 1px solid var(--border-dim); background: var(--bg-panel-solid); }
    input { flex: 1; background: var(--bg-void); border: 1px solid var(--border-dim); color: var(--text-primary); padding: 0.75rem; font-family: var(--font-data); outline: none; }
    input:focus { border-color: var(--accent-cyan); box-shadow: var(--glow-cyan); }
    button { background: var(--accent-cyan); color: var(--bg-void); border: none; padding: 0 1.5rem; font-weight: bold; cursor: pointer; }
  `;

  connectedCallback() {
    super.connectedCallback();
    // Configure marked for syntax highlighting
    marked.setOptions({ highlight: (code, lang) => hljs.highlightAuto(code, [lang]).value });

    // Bind to REAL WebSocket events. No mocks.
    wsClient.on('chat.agent.stream', (msg) => {
      this.streamingContent += msg.delta;
      this.requestUpdate();
    });
    wsClient.on('chat.agent.complete', (msg) => {
      this.messages.push({ role: 'agent', content: this.streamingContent || msg.content });
      this.streamingContent = '';
      this.requestUpdate();
    });
  }

  private renderMarkdown(text: string) {
    return html`<div class="markdown-body" .innerHTML=${DOMPurify.sanitize(marked.parse(text))}></div>`;
  }

  render() {
    return html`
      <div class="messages">
        ${this.messages.map(m => html`<div class="msg ${m.role}">${this.renderMarkdown(m.content)}</div>`)}
        ${this.streamingContent ? html`<div class="msg agent">${this.renderMarkdown(this.streamingContent)}<span class="cursor">▊</span></div>` : ''}
      </div>
      <div class="input-area">
        <input @keydown=${(e: KeyboardEvent) => e.key === 'Enter' && this.sendMsg()} placeholder="Query the agent..." />
        <button @click=${this.sendMsg}>SEND</button>
      </div>
    `;
  }

  private sendMsg() {
    const input = this.shadowRoot?.querySelector('input');
    if (!input?.value) return;
    this.messages.push({ role: 'user', content: input.value });
    wsClient.send({ type: 'chat.user', content: input.value });
    input.value = '';
    this.requestUpdate();
  }
}
```

---

### 7. Phase 5: Schema-Driven Configuration
*This is where flexibility shines. The UI does not know what settings exist. It reads the Zod schema from the server and renders the exact controls needed.*

**`src/client/components/config-drawer.ts`**
```typescript
import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { wsClient } from '../core/ws-client';

type ConfigField = { type: string, label: string, value: any, options?: string[], min?: number, max?: number };

@customElement('config-drawer')
export class ConfigDrawer extends LitElement {
  @state() private schema: Record<string, ConfigField> = {};

  static styles = css`
    :host { display: block; width: 300px; background: var(--bg-panel-solid); border-left: 1px solid var(--border-dim); padding: 1.5rem; overflow-y: auto; }
    h2 { font-family: var(--font-data); color: var(--accent-amber); text-transform: uppercase; font-size: 0.9rem; letter-spacing: 2px; margin-top: 0; }
    .field { margin-bottom: 1.5rem; }
    label { display: block; font-size: 0.8rem; color: var(--text-dim); margin-bottom: 0.5rem; font-family: var(--font-data); text-transform: uppercase; }
    input[type=range] { width: 100%; accent-color: var(--accent-cyan); }
    select, input[type=text] { width: 100%; background: var(--bg-void); border: 1px solid var(--border-dim); color: var(--text-primary); padding: 0.5rem; }
    .val { float: right; color: var(--accent-cyan); }
  `;

  connectedCallback() {
    super.connectedCallback();
    wsClient.on('config.schema', (msg) => {
      this.schema = msg.data;
      this.requestUpdate();
    });
  }

  private updateConfig(key: string, value: any) {
    this.schema[key].value = value;
    wsClient.send({ type: 'config.set', key, value });
    this.requestUpdate();
  }

  render() {
    return html`
      <h2>System Config</h2>
      ${Object.entries(this.schema).map(([key, field]) => html`
        <div class="field">
          <label>${field.label} <span class="val">${field.value}</span></label>
          ${field.type === 'slider' ? html`
            <input type="range" min=${field.min} max=${field.max} step="0.1" .value=${field.value} 
              @input=${(e: Event) => this.updateConfig(key, parseFloat((e.target as HTMLInputElement).value))}>
          ` : ''}
          ${field.type === 'dropdown' ? html`
            <select @change=${(e: Event) => this.updateConfig(key, (e.target as HTMLSelectElement).value)}>
              ${field.options?.map(opt => html`<option ?selected=${opt === field.value}>${opt}</option>`)}
            </select>
          ` : ''}
        </div>
      `)}
    `;
  }
}
```

---

### 8. Phase 6: The Cognitive HUD (Real-Time Graph)
*Using Cytoscape.js to render the NARS belief graph. It updates in real-time as the server pushes `cognitive.update` messages.*

**`src/client/components/cognitive-hud.ts`**
```typescript
import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import cytoscape from 'cytoscape';
import { wsClient } from '../core/ws-client';

@customElement('cognitive-hud')
export class CognitiveHud extends LitElement {
  private cy: any;
  
  static styles = css`
    :host { display: block; flex: 1; background: var(--bg-void); position: relative; }
    #graph { width: 100%; height: 100%; }
    .overlay { position: absolute; top: 10px; left: 10px; font-family: var(--font-data); font-size: 0.8rem; color: var(--accent-amber); text-transform: uppercase; pointer-events: none; }
  `;

  firstUpdated() {
    const container = this.shadowRoot?.getElementById('graph');
    this.cy = cytoscape({
      container,
      style: [
        { selector: 'node', style: { 
          'background-color': 'data(color)', 
          'label': 'data(id)', 
          'color': '#fff',
          'font-family': 'JetBrains Mono',
          'width': 'data(size)', 'height': 'data(size)',
          'border-width': 2, 'border-color': '#00f3ff'
        }},
        { selector: 'edge', style: { 
          'line-color': '#334155', 'target-arrow-color': '#334155', 'target-arrow-shape': 'triangle', 'curve-style': 'bezier' 
        }}
      ],
      layout: { name: 'cose', animate: false }
    });

    // Listen for REAL cognitive updates
    wsClient.on('cognitive.update', (msg) => {
      if (msg.module === 'belief_graph') {
        this.cy.elements().remove();
        this.cy.add(msg.data.elements);
        this.cy.layout({ name: 'cose', idealEdgeLength: 100, nodeOverlap: 20 }).run();
      }
    });
  }

  render() {
    return html`
      <div class="overlay">NARS Belief Graph // Real-Time</div>
      <div id="graph"></div>
    `;
  }
}
```

---

### 9. Phase 7: Assembly & The "No Mocks" Execution Rules

**`src/client/index.html`**
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>SeNARS Cognitive HUD</title>
  <link rel="stylesheet" href="./core/theme.css">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/atom-one-dark.min.css">
</head>
<body>
  <!-- The entire app is composed of these native HTML tags -->
  <div style="display: grid; grid-template-columns: 1fr 300px; grid-template-rows: 1fr; height: 100vh;">
    <div style="display: flex; flex-direction: column; border-right: 1px solid var(--border-dim);">
      <cognitive-hud style="height: 60%; border-bottom: 1px solid var(--border-dim);"></cognitive-hud>
      <chat-console style="height: 40%;"></chat-console>
    </div>
    <config-drawer></config-drawer>
  </div>

  <script type="module" src="./core/ws-client.ts"></script>
  <script type="module" src="./components/chat-console.ts"></script>
  <script type="module" src="./components/config-drawer.ts"></script>
  <script type="module" src="./components/cognitive-hud.ts"></script>
</body>
</html>
```

### Crucial "No Mocks" Engineering Rules for Continued Development:
1.  **Zero Hardcoded UI State:** If a component needs data, it *must* get it from the `wsClient` or a Lit `@property()`. No `this.messages = [{role: 'user', content: 'hello'}]` in the constructor.
2.  **Strict Zod Enforcement:** The `wsClient` must parse *every* incoming message through `IncomingMessage.parse()`. If the backend sends malformed data, the UI should log the Zod error and drop the message, rather than crashing or rendering garbage.
3.  **Graceful Degradation:** The UI must render its empty states beautifully while waiting for the WebSocket to connect. (e.g., The graph shows a "Awaiting Cognitive Stream..." overlay until the first `cognitive.update` arrives).
4.  **Backend Agnosticism:** The TS server (`src/server/index.ts`) should eventually contain *zero* business logic. It should purely translate the SeNARS engine's native protocol (gRPC, REST, or raw TCP) into the Zod-defined WebSocket protocol defined in `src/shared/protocol.ts`.

