import { $userLevel, $chat, $focusTerm, $selectedMessageId } from '../core/store.js';

let initialized = false;

function showHint(text: string): void {
  const existing = document.getElementById('onboarding-hint');
  if (existing) existing.remove();
  const el = document.createElement('div');
  el.id = 'onboarding-hint';
  el.style.cssText = `
    position:fixed; bottom:24px; left:50%; transform:translateX(-50%);
    background:rgba(0,243,255,0.12); border:1px solid rgba(0,243,255,0.3);
    border-radius:6px; padding:8px 16px; font-family:JetBrains Mono,monospace;
    font-size:0.75rem; color:#00f3ff; z-index:1000; cursor:pointer;
    backdrop-filter:blur(4px); animation:fadeIn 0.3s ease;
    max-width:400px; text-align:center;
  `;
  el.textContent = text;
  el.onclick = () => el.remove();
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 8000);

  if (!document.getElementById('onboarding-hint-style')) {
    const style = document.createElement('style');
    style.id = 'onboarding-hint-style';
    style.textContent = `@keyframes fadeIn { from { opacity:0; transform:translateX(-50%) translateY(8px); } to { opacity:1; transform:translateX(-50%) translateY(0); } }`;
    document.head.appendChild(style);
  }
}

function clearHint(): void {
  document.getElementById('onboarding-hint')?.remove();
}

const HINTS = [
  { at: 3, text: 'Tip: Click a message to see it centered in the graph' },
  { at: 5, text: 'Full mode unlocked! Try switching lenses in the status bar' },
];

export function initOnboarding(): void {
  if (initialized) return;
  initialized = true;

  $chat.subscribe((msgs) => {
    for (const h of HINTS) {
      if (msgs.length === h.at) showHint(h.text);
    }
    if (msgs.length >= 5) {
      $userLevel.set('full');
    }
  });

  $focusTerm.subscribe((term) => {
    if (term) clearHint();
  });
}
