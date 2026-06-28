import { $userLevel, $chat } from '../core/store.js';

let initialized = false;

export function initOnboarding(): void {
  if (initialized) return;
  initialized = true;

  $chat.subscribe((msgs) => {
    if (msgs.length >= 5) {
      $userLevel.set('full');
    }
  });
}
