import cytoscape, { type Core } from 'cytoscape';
import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { wsClient } from '../core/ws-client.js';

interface DriveData {
  id: string;
  name: string;
  intensity: number;
  active: boolean;
}

interface WMData {
  concept?: string;
  priority?: number;
}

interface StreamData {
  cycle?: number;
  derived?: number;
  status?: string;
}

@customElement('cognitive-hud')
export class CognitiveHud extends LitElement {
  private cy: Core | null = null;
  @state() private hasData = false;
  @state() private drives: DriveData[] = [];
  @state() private wm: WMData | null = null;
  @state() private stream: StreamData | null = null;

  static override styles = css`
    :host { display: block; flex: 1; background: var(--bg-void); position: relative; }
    #graph { width: 100%; height: 100%; }
    .overlay { position: absolute; top: 10px; left: 10px; font-family: var(--font-data); font-size: 0.8rem; color: var(--accent-amber); text-transform: uppercase; pointer-events: none; letter-spacing: 1px; }
    .empty { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; color: var(--text-dim); font-family: var(--font-data); font-size: 0.85rem; text-transform: uppercase; letter-spacing: 1px; pointer-events: none; }
    .wm-flash { position: absolute; top: 10px; right: 10px; font-family: var(--font-data); font-size: 0.75rem; color: var(--accent-cyan); background: rgba(0,0,0,0.7); padding: 4px 8px; border-radius: 4px; border-left: 2px solid var(--accent-cyan); pointer-events: none; transition: opacity 0.3s; }
    .stream-info { position: absolute; bottom: 10px; left: 10px; font-family: var(--font-data); font-size: 0.7rem; color: var(--text-dim); pointer-events: none; }
    .drives-panel { position: absolute; bottom: 10px; right: 10px; pointer-events: none; }
    .drive-row { display: flex; align-items: center; gap: 6px; margin-bottom: 2px; font-family: var(--font-data); font-size: 0.65rem; color: var(--text-dim); }
    .drive-bar { width: 60px; height: 6px; background: #1e293b; border-radius: 3px; overflow: hidden; }
    .drive-fill { height: 100%; border-radius: 3px; transition: width 0.3s; }
    .drive-fill.active { background: var(--accent-cyan); }
    .drive-fill.idle { background: #475569; }
  `;

  private onCognitive = (msg: { module: string; data: any }) => {
    if (!msg.data) return;
    switch (msg.module) {
      case 'belief_graph':
        if (!msg.data.elements) return;
        this.cy?.elements().remove();
        this.cy?.add(msg.data.elements);
        this.cy?.layout({ name: 'cose', idealEdgeLength: 100, nodeOverlap: 20, animate: true, animationDuration: 500 }).run();
        if (!this.hasData) this.hasData = true;
        break;
      case 'working_memory':
        this.wm = msg.data;
        break;
      case 'drives':
        this.drives = msg.data;
        break;
      case 'stream_reasoner':
        this.stream = msg.data;
        break;
    }
  };

  override connectedCallback() {
    super.connectedCallback();
    wsClient.on('cognitive.update', this.onCognitive);
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    wsClient.off('cognitive.update', this.onCognitive);
  }

  override firstUpdated() {
    const container = this.shadowRoot?.getElementById('graph');
    if (!container) return;

    this.cy = cytoscape({
      container,
      style: [
        {
          selector: 'node',
          style: {
            'background-color': 'data(color)',
            label: 'data(id)',
            color: '#fff',
            'font-family': 'JetBrains Mono',
            'font-size': '10px',
            width: 'data(size)',
            height: 'data(size)',
            'border-width': 2,
            'border-color': '#00f3ff',
            'text-valign': 'bottom',
            'text-halign': 'center',
            'text-margin-y': 6,
          },
        },
        {
          selector: 'edge',
          style: {
            'line-color': '#334155',
            'target-arrow-color': '#334155',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            width: 1.5,
          },
        },
      ],
      layout: { name: 'cose', animate: false },
    });
  }

  override render() {
    return html`
      <div class="overlay">NARS Belief Graph // Real-Time</div>
      ${!this.hasData ? html`<div class="empty">Awaiting Cognitive Stream...</div>` : ''}
      ${this.wm?.concept ? html`<div class="wm-flash">▲ ${this.wm.concept} (p:${this.wm.priority?.toFixed(2)})</div>` : ''}
      ${this.stream?.cycle ? html`<div class="stream-info">cycle ${this.stream.cycle} · ${this.stream.derived ?? '?'} derived${this.stream.status ? ` · ${this.stream.status}` : ''}</div>` : ''}
      ${this.drives.length > 0 ? html`
        <div class="drives-panel">${this.drives.map(d => html`
          <div class="drive-row">
            <span>${d.name ?? d.id}</span>
            <div class="drive-bar"><div class="drive-fill ${d.active ? 'active' : 'idle'}" style="width:${d.intensity * 100}%"></div></div>
            <span>${(d.intensity * 100).toFixed(0)}%</span>
          </div>
        `)}</div>
      ` : ''}
      <div id="graph"></div>
    `;
  }
}
