export const timed = <T>(fn: () => T): { result: T; duration: number } => {
    const start = Date.now();
    return {result: fn(), duration: Date.now() - start};
};