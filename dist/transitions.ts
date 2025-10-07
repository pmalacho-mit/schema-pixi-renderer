import type { GenericTransition, PixiByRenderInput, RenderInput } from ".";
import apply, { type ApplyPropertyTo, } from "./apply";
import type { Scope, Lookup } from './runtime';
import { lerp } from './lerp';
import { setOrAppend } from "./utils";

export const setCurrentFrame = (transition: GenericTransition, { elapsedTimeSeconds: timeSeconds }: Scope) => {
    const { times, currentFrame } = transition;
    if (currentFrame === -1 || currentFrame === undefined) transition.currentFrame = timeSeconds < times[0] ? -1 : 0;
    else if (currentFrame >= times.length - 1 || times[currentFrame + 1] > timeSeconds) return;
    else transition.currentFrame!++;
}

export const tryLerpToNextFrame = ({ frames, currentFrame, times }: GenericTransition, { elapsedTimeSeconds }: Scope) => {
    const nextIndex = currentFrame! + 1;
    if (nextIndex > frames.length - 1) return null;
    const start = frames[currentFrame!]!;
    const end = frames[nextIndex]!;
    const startTime = times[currentFrame!];
    const timeRatio = (elapsedTimeSeconds - startTime) / (times[nextIndex] - startTime);
    return lerp(start as any, end, Math.min(timeRatio, 1)) as typeof start;
}

const performTransition = <T extends keyof PixiByRenderInput>(transition: GenericTransition, scope: Scope, lookup: Lookup<PixiByRenderInput[T], T>, apply: ApplyPropertyTo<T>) => {
    const { property, target, frames, times } = transition;
    setCurrentFrame(transition, scope);

    if (transition.currentFrame === -1 || transition.currentFrame === frames.length || transition.times[0] === null) return;

    if (transition.repeat && transition.currentFrame === frames.length - 1 && times[transition.currentFrame] < scope.elapsedTimeSeconds) {
        transition.totalDuration ??= transition.times.at(-1)! - transition.times.at(0)!;
        transition.currentFrame = 0;
        transition.times = times.map(time => time + transition.totalDuration!);
    }

    try {
        const value = tryLerpToNextFrame(transition, scope) ?? frames[transition.currentFrame!]!;
        if (target.identifiers)
            for (const id of target.identifiers)
                apply(lookup.byIdentifier.get(id)!, property, value as any, scope);
        if (target.tags)
            for (const tag of target.tags)
                if (lookup.byTag.has(tag))
                    for (const pixi of lookup.byTag.get(tag)!) apply(pixi, property, value as any, scope);
    }
    catch (e) {
        console.error(`Unable to perform transition: ${JSON.stringify(transition)}; error: ${e}`);
    }
}

export const perform = (scope: Scope) => {
    const { lookup: { Transition }, startTimeSeconds } = scope;
    scope.elapsedTimeSeconds = (performance.now() - startTimeSeconds) / 1000;
    for (const [_, transition] of Transition.byIdentifier)
        performTransition<typeof transition.kind>(transition, scope, scope.lookup[transition.kind], apply[transition.kind]);
};

export const configure = ({ Transition }: Pick<RenderInput, "Transition">, { lookup }: Scope) => {
    for (const identifier in Transition) {
        const config = Transition[identifier];
        lookup.Transition.byIdentifier.set(identifier, config);
        if (config.tag) setOrAppend(lookup.Transition.byTag, config.tag, config);
    }
}
