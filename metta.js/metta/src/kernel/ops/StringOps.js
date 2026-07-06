/**
 * StringOps.js - String operations
 */

export function registerStringOps(registry) {
    registry.register('&str-concat', (a, b) => String(a) + String(b));
    registry.register('&to-string', a => String(a));
}