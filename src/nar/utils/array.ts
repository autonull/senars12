export const unique = <T>(arr: T[]): T[] => [...new Set(arr)];

export const halfSlice = <T>(arr: T[], maxSize: number): T[] =>
    arr.slice(-Math.floor(maxSize / 2));