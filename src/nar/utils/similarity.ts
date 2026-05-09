export const jaccard = <T>(a: Set<T>, b: Set<T>): number => {
    if (a.size === 0 && b.size === 0) return 0;
    const inter = [...a].filter(x => b.has(x)).length;
    return inter / (a.size + b.size - inter || 1);
};