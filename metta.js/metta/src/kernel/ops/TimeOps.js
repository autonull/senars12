import { sym } from '../Term.js';

export function registerTimeOps(registry) {
    registry.register('&time', () => sym(String(Date.now())));
    registry.register('&time-str', () => sym(new Date().toISOString()));
}
