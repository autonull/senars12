/**
 * Ask — the conversational prototype.
 *
 * The thinnest honest loop over the kernel: say something, get an answer, see
 * why. Plain language routes through the agent's ingress; Narsese routes through
 * the control path and returns a proof. No lenses, no layouts, no panels — the
 * reasoning is the interface.
 *
 * Now built on the normalized app framework (P5).
 */
import { generateId } from '@senars/util';
import { css, html, nothing, type TemplateResult } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import {
  $chatMessages,
  $cognitiveEvents,
  BaseComponent,
  narsBackend,
  send,
} from '../../kernel/index.js';
import { defineApp, type AppDescriptor } from '../../framework/app.js';
import { defineBundle } from '../../framework/bundle.js';
import type { Composition } from '../../framework/composition.js';
import { type SurfaceDescriptor } from '../../framework/surface.js';

type ProofStep = {
  readonly rule: string;
  readonly premises: readonly string[];
  readonly conclusion: string;
  readonly frequency: number;
  readonly confidence: number;
};

type Turn = {
  readonly id: string;
  readonly role: 'user' | 'agent';
  readonly text: string;
  readonly confidence?: number;
  readonly frequency?: number;
  readonly proof?: readonly ProofStep[];
  readonly error?: boolean;
  readonly pending?: boolean;
};

/** A sentence is Narsese if it names a relation or is a bracketed task. */
const looksNarsese = (text: string): boolean =>
  /-->|<->|==>|=>/.test(text) || /^[<(].*[.?!]$/.test(text.trim());

const modeFor = (term: string): 'belief' | 'goal' | 'question' => {
  const t = term.trim();
  if (t.endsWith('?')) return 'question';
  if (t.endsWith('!')) return 'goal';
  return 'belief';
};

/** The Ask app surface — mounted in the viewport. */
@customElement('ask-surface')
export class AskSurface extends BaseComponent {
  static override styles = css`
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
      background: var(--colors-semantic-bg-base);
      color: var(--colors-semantic-text-primary);
      font-family: var(--typography-fontFamilies-ui, system-ui, sans-serif);
    }
    .app {
      display: flex;
      flex-direction: column;
      width: 100%;
      max-width: 780px;
      margin: 0 auto;
      height: 100%;
    }
    .messages {
      flex: 1;
      overflow-y: auto;
      padding: 20px 24px;
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .empty {
      margin: auto;
      max-width: 460px;
      text-align: center;
      color: var(--colors-semantic-text-muted);
      line-height: 1.6;
    }
    .empty h2 {
      font-size: 16px;
      font-weight: 600;
      color: var(--colors-semantic-text-primary);
      margin: 0 0 8px;
    }
    .empty code {
      font-family: var(--typography-fontFamilies-data, monospace);
      background: var(--colors-semantic-bg-panel-solid);
      border: 1px solid var(--colors-semantic-border-subtle);
      border-radius: 4px;
      padding: 1px 5px;
    }
    .turn {
      max-width: 88%;
      line-height: 1.5;
    }
    .turn.user {
      align-self: flex-end;
      background: var(--colors-semantic-accent-subtle, #2b3a55);
      border: 1px solid var(--colors-semantic-border-subtle);
      border-radius: 12px 12px 2px 12px;
      padding: 8px 12px;
      white-space: pre-wrap;
    }
    .turn.agent {
      align-self: flex-start;
    }
    .turn.agent.error {
      color: #e5534b;
    }
    .answer {
      font-size: 15px;
    }
    .answer .term {
      font-family: var(--typography-fontFamilies-data, monospace);
    }
    .confidence {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 6px;
      font-size: 12px;
      color: var(--colors-semantic-text-muted);
    }
    .bar {
      width: 120px;
      height: 4px;
      border-radius: 2px;
      background: var(--colors-semantic-border-subtle);
      overflow: hidden;
    }
    .bar > span {
      display: block;
      height: 100%;
      background: var(--colors-semantic-accent-primary, #6ea8fe);
    }
    details.why {
      margin-top: 6px;
      font-size: 13px;
    }
    details.why summary {
      cursor: pointer;
      color: var(--colors-semantic-accent-primary, #6ea8fe);
      user-select: none;
    }
    .step {
      margin: 6px 0 0 4px;
      padding-left: 10px;
      border-left: 2px solid var(--colors-semantic-border-subtle);
      font-family: var(--typography-fontFamilies-data, monospace);
      font-size: 12px;
      line-height: 1.7;
      color: var(--colors-semantic-text-secondary);
    }
    .step .rule {
      color: var(--colors-semantic-accent-primary, #6ea8fe);
    }
    .pending {
      opacity: 0.5;
    }
    form {
      display: flex;
      gap: 8px;
      padding: 12px 24px 20px;
      border-top: 1px solid var(--colors-semantic-border-subtle);
    }
    input {
      flex: 1;
      background: var(--colors-semantic-bg-panel-solid);
      color: var(--colors-semantic-text-primary);
      border: 1px solid var(--colors-semantic-border-subtle);
      border-radius: 8px;
      padding: 10px 12px;
      font-size: 14px;
      font-family: inherit;
      outline: none;
    }
    input:focus {
      border-color: var(--colors-semantic-accent-primary, #6ea8fe);
    }
    button {
      background: var(--colors-semantic-accent-primary, #6ea8fe);
      color: #0b1020;
      border: none;
      border-radius: 8px;
      padding: 0 16px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
    }
    button:disabled {
      opacity: 0.4;
      cursor: default;
    }
  `;

  @state() private turns: Turn[] = [];
  @state() private draft = '';
  private seenChatIds = new Set<string>();

  override connectedCallback(): void {
    super.connectedCallback();
    this.watch($cognitiveEvents);
    this.watchWith($chatMessages, () => this.collectChatReplies());
  }

  protected override firstUpdated(): void {
    this.renderRoot.querySelector('input')?.focus();
  }

  /** Pull any agent chat messages the ingress produced into the transcript. */
  private collectChatReplies(): void {
    const fresh = $chatMessages
      .get()
      .filter((m) => m.role === 'agent' && !this.seenChatIds.has(m.id));
    if (fresh.length === 0) return;
    for (const m of fresh) this.seenChatIds.add(m.id);
    this.turns = [
      ...this.turns.filter((t) => !t.pending),
      ...fresh.map((m) => ({ id: m.id, role: 'agent' as const, text: m.content })),
    ];
  }

  private latestProof(): readonly ProofStep[] | undefined {
    const events = $cognitiveEvents.get();
    for (let i = events.length - 1; i >= 0; i--) {
      if (events[i]!.type !== 'derivation.record') continue;
      const payload = events[i]!.payload as {
        steps?: ReadonlyArray<{
          ruleId: string;
          premises?: readonly string[];
          conclusion: string;
          truth?: { frequency?: number; confidence?: number };
        }>;
      };
      return (payload.steps ?? []).map((s) => ({
        rule: s.ruleId,
        premises: s.premises ?? [],
        conclusion: s.conclusion,
        frequency: s.truth?.frequency ?? 0,
        confidence: s.truth?.confidence ?? 0,
      }));
    }
    return undefined;
  }

  private push(turn: Omit<Turn, 'id'>): string {
    const id = generateId('turn');
    this.turns = [...this.turns, { ...turn, id }];
    return id;
  }

  private patch(id: string, next: Partial<Turn>): void {
    this.turns = this.turns.map((t) => (t.id === id ? { ...t, ...next } : t));
  }

  private async onSubmit(event: Event): Promise<void> {
    event.preventDefault();
    const text = this.draft.trim();
    if (!text) return;
    this.draft = '';
    this.push({ role: 'user', text });
    if (looksNarsese(text)) await this.submitStructured(text);
    else this.submitNatural(text);
  }

  private submitNatural(text: string): void {
    this.push({ role: 'agent', text: 'thinking…', pending: true });
    // The ingress reply arrives as a `chat.agent.complete`; `collectChatReplies`
    // folds it in on the next `$chatMessages` tick and drops the placeholder.
    send({ type: 'chat.user', content: text });
  }

  private async submitStructured(term: string): Promise<void> {
    const control = narsBackend.control;
    if (!control) {
      this.push({ role: 'agent', text: 'No reasoning engine is attached.', error: true });
      return;
    }
    const mode = modeFor(term);
    const pendingId = this.push({ role: 'agent', text: 'reasoning…', pending: true });
    const result = await control.submit({ term, mode });
    if (!result.ok) {
      this.patch(pendingId, {
        text: result.message ?? 'The engine rejected that.',
        error: true,
        pending: false,
      });
      return;
    }
    if (mode === 'question') {
      const answer = result.answer;
      this.patch(pendingId, {
        text: answer?.answer ?? '(no answer was derived)',
        confidence: answer?.confidence,
        frequency: answer?.frequency,
        proof: answer?.hasDerivation ? this.latestProof() : undefined,
        pending: false,
      });
      return;
    }
    this.patch(pendingId, {
      text: mode === 'goal' ? '✓ goal accepted' : '✓ belief accepted',
      pending: false,
    });
  }

  private renderProof(proof: readonly ProofStep[]): TemplateResult {
    return html`
      <details class="why">
        <summary>Why?</summary>
        ${proof.map(
          (step) => html`
            <div class="step">
              ${step.premises.join(', ')} <span class="rule">── ${step.rule} ──▶</span>
              ${step.conclusion} <span>[f=${step.frequency.toFixed(2)} c=${step.confidence.toFixed(2)}]</span>
            </div>
          `
        )}
      </details>
    `;
  }

  private renderTurn(turn: Turn): TemplateResult {
    if (turn.role === 'user') {
      return html`<div class="turn user">${turn.text}</div>`;
    }
    return html`
      <div class="turn agent ${turn.error ? 'error' : ''} ${turn.pending ? 'pending' : ''}">
        <div class="answer ${looksNarsese(turn.text) ? 'term' : ''}">${turn.text}</div>
        ${turn.confidence !== undefined
          ? html`
              <div class="confidence">
                <div class="bar"><span style="width:${Math.round(turn.confidence * 100)}%"></span></div>
                <span>confidence ${turn.confidence.toFixed(2)}</span>
              </div>
            `
          : nothing}
        ${turn.proof ? this.renderProof(turn.proof) : nothing}
      </div>
    `;
  }

  private renderEmpty(): TemplateResult {
    return html`
      <div class="empty">
        <h2>Ask SeNARS</h2>
        <p>
          Type a question in plain language, or a Narsese sentence like
          <code><bird-->animal>.</code> and <code><bird-->animal>?</code>.
        </p>
        <p>Answers carry their confidence; open <em>Why?</em> to read the proof.</p>
      </div>
    `;
  }

  protected override render(): TemplateResult {
    return html`
      <div class="app">
        <div class="messages">
          ${this.turns.length === 0 ? this.renderEmpty() : this.turns.map((t) => this.renderTurn(t))}
        </div>
        <form @submit=${this.onSubmit}>
          <input
            .value=${this.draft}
            @input=${(e: Event) => (this.draft = (e.target as HTMLInputElement).value)}
            placeholder="Ask a question, or assert a belief…"
            autocomplete="off"
          />
          <button type="submit" ?disabled=${!this.draft.trim()}>Ask</button>
        </form>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ask-surface': AskSurface;
  }
}

/** Ask app surfaces — just the viewport surface for now. */
const askSurfaces: SurfaceDescriptor[] = [
  {
    id: 'ask-surface',
    label: 'Ask',
    title: 'Ask SeNARS',
    icon: 'chat',
    placement: 'viewport',
    tag: 'ask-surface',
  },
];

/** Ask's default composition — one content cell; the shell supplies the chrome. */
const askComposition: Composition = {
  id: 'ask',
  name: 'Ask',
  layout: 'auto',
  cells: [{ surface: 'ask-surface' }],
  globals: {
    lens: 'belief',
    layer: 'conversation',
    shape: 'graph',
    mode: '2d',
    fit: 'legible',
    filter: 'all',
  },
};

/** Ask app descriptor — one bundle of contributions plus the shell contract. */
export const ASK_APP: AppDescriptor<'ask'> = defineApp({
  bundle: defineBundle({
    id: 'ask',
    name: 'Ask',
    description: 'Conversational reasoning — ask, get an answer, see the proof.',
    surfaces: {
      viewport: askSurfaces,
    },
  }),
  icon: 'chat',
  composition: askComposition,
  defaultLens: 'belief',
  defaultGraphLayer: 'conversation',
  defaultCapabilityFilter: 'all',
  connection: {
    url: '/ws',
    reconnect: true,
  },
  capability: 'language',
});

/** The Ask app id for registration and routing. */
export const ASK_APP_ID = ASK_APP.id;

/** Re-export for compatibility. */
export { ASK_APP as askApp };