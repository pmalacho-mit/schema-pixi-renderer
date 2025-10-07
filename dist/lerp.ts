type Lerpable = number | number[] | Record<string, number | number[] | Record<string, number | number[]>>;

export const lerp = <T extends Lerpable>(start: T, end: T, amonunt: number): T => {
    if (Array.isArray(start) && Array.isArray(end)) return start.map((x, i) => lerp(x, end[i], amonunt)) as T;
    else if (typeof start === "object" && typeof end === "object") {
        const result = {} as T;
        for (const key in start) {
            result[key as keyof T] = lerp(start[key] as Lerpable, end[key] as Lerpable, amonunt) as T[keyof T];
        }
        return result;
    }
    else if (typeof start === "number" && typeof end === "number") return start + (end - start) * amonunt as T;
    else throw new Error(`Cannot lerp: ${start} and ${end}`);
}