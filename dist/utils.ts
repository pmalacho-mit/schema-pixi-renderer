export const setOrAppend = <Key, Item>(map: Map<Key, Item[]>, key: Key, item: Item) => map.has(key) ? map.get(key)!.push(item) : map.set(key, [item]);

export type WithoutNever<T> = {
    [K in keyof T as T[K] extends never ? never : K]: T[K]
};