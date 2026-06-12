/**
 * Decorator that caches the return value for each call to f(args).
 * Then when called again with same args, we can just look it up.
 */
export function memo<T extends (...args: unknown[]) => unknown>(f: T): T {
    const cache = new Map<string, ReturnType<T>>();
    const _f = (...args: Parameters<T>): ReturnType<T> => {
        const key = JSON.stringify(args);
        if (cache.has(key)) {
            return cache.get(key)!;
        }
        const result = f(...args) as ReturnType<T>;
        cache.set(key, result);
        return result;
    };
    return _f as T;
}