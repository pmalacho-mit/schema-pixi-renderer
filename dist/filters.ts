import * as PIXI from '@pixi/webworker';
import { GlowFilter } from 'pixi-filters';
import type { PixiObject, RenderInput, Scope } from ".";
import apply from './apply';
import { setOrAppend } from './utils';

type FilterKey = keyof RenderInput["Filter"];

const makeFilter = ({ type }: PixiObject["Filter"]) =>
    type === "blur" ? new PIXI.BlurFilter() :
        type === "alpha" ? new PIXI.AlphaFilter() :
            type === "brightness" ? new PIXI.ColorMatrixFilter() :
                type === "glow" ? new GlowFilter({ color: 0xffff00 }) :
                    null;

type FilterHandler = (identifier: FilterKey, filter: PIXI.Filter, config: RenderInput["Filter"][FilterKey], scope: Scope) => void;

const applyProperties: FilterHandler = (_, filter, config, scope) => {
    type Property = keyof typeof config;
    for (const key in config) apply.Filter(filter, key as Property, config[key as Property], scope);
}

const store: FilterHandler = (identifier, filter, config, { lookup: { Filter } }) => {
    Filter.byIdentifier.set(identifier, filter);
    Filter.configBy.set(filter, config);
    Filter.identifierBy.set(filter, identifier);
}

const tag: FilterHandler = (_, filter, config, scope) => {
    if (!config.tag) return;
    setOrAppend(scope.lookup.Filter.byTag, config.tag, filter);
}

const attachToVisualByIdentifer: FilterHandler = (_, filter, config, { lookup: { Sprite, Graphic } }) => {
    if (!config.include?.identifiers) return;
    for (const id of config.include.identifiers) {
        Sprite.byIdentifier.get(id)?.filters!.push(filter);
        Graphic.byIdentifier.get(id)?.filters!.push(filter);
    }
}

const attachToVisualByTag: FilterHandler = (store, filter, config, { lookup: { Sprite, Graphic } }) => {
    if (!config.include?.tags) return;
    for (const tag of config.include.tags) {
        Sprite.byTag.get(tag)?.forEach(sprite => sprite.filters!.push(filter));
        Graphic.byTag.get(tag)?.forEach(graphic => graphic.filters!.push(filter));
    }
}

export const configure = ({ Filter }: Pick<RenderInput, "Filter">, scope: Scope) => {
    const handlers = [store, tag, applyProperties, attachToVisualByIdentifer, attachToVisualByTag];
    for (const identifier in Filter) {
        const config = Filter[identifier];
        const filter = scope.lookup.Filter.byIdentifier.get(identifier) ?? makeFilter(config);
        if (!filter) throw new Error(`Unknown filter type: ${config.type}`);
        handlers.forEach(handler => handler(identifier, filter, config, scope));
    }
}