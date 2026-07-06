const isNull = x => x == null;

export function strVal(x) {
    if (isNull(x)) {
        return '';
    }
    const s = String(x?.name ?? x);
    if (s.startsWith('"') && s.endsWith('"')) {
        return s.slice(1, -1);
    }
    return s;
}

export function matches(line, pattern) {
    return typeof pattern === 'string' ? line.includes(pattern) : pattern.test(line);
}
