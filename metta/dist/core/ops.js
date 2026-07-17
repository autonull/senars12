const ops = new Map();
export function registerOp(name, op) {
    ops.set(name, op);
}
export function getOp(name) {
    return ops.get(name);
}
export function hasOp(name) {
    return ops.has(name);
}
export function clearOps() {
    ops.clear();
}
export function defineOp(name, impl, opts) {
    return {
        name,
        execute: impl,
        pure: opts?.pure ?? true,
        lazy: opts?.lazy ?? false,
    };
}
//# sourceMappingURL=ops.js.map