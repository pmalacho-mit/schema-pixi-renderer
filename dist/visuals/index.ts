import type * as PIXI from '@pixi/webworker';
import type { PixiByRenderInput, PixiObject, Position, RenderInput } from '..';
import type { Lookup, Scope } from '../runtime';
import { setOrAppend } from '../utils';
import { draw as drawGraphic } from './graphic';
import { set as setSprite } from './sprite';

/**
 * Visuals are things that can be rendered on screen (sprites and graphics), 
 * which are different than filters which affect how visuals are rendered, 
 * and transitions which update properties of visuals and/or filters over time.
 */

/**
 * Currently only sprites can be used as parents, 
 * but with development effort (need a method to isolate the top left corner position (x,y) of graphics and get their dimensions) 
 * graphics can be also.
 */
export type ParentVisual = PIXI.Sprite;
export type Visual = PIXI.Sprite | PIXI.Graphics;
export type VisualKey = ("Sprite" | "Graphic") & keyof RenderInput;

type Size = { width: number, height: number };
type Center = { x: number, y: number, };
export type Parent = Center & Size;

export const point: Size = { width: 0, height: 0 };

export const rootParent = ({ app: { screen: { width, height } } }: Scope): Parent => ({ width, height, x: width / 2, y: height / 2 });

export const isSprite = (query: Visual): query is PIXI.Sprite => query.isSprite;

export const resolvePosition = ({ value, anchors }: Position, dimension: "x" | "y", self: Size, parent: Parent,) => {
    const unit = dimension === "x" ? "width" : "height";
    return parent[dimension] - parent[unit] / 2 + anchors.parent * parent[unit] + (0.5 - anchors.self) * self[unit] + parent[unit] * value;
}

const childrenByIdentifier = new Map<string, (PIXI.Sprite | PIXI.Graphics)[]>();

export type Factory<Key extends VisualKey> = (identifier: string, config: PixiObject[Key]) => PixiByRenderInput[Key];
export type Setter<Key extends VisualKey> = (item: PixiByRenderInput[Key], scope: Scope, config?: PixiObject[Key]) => void;
type Lookups<Key extends VisualKey> = Lookup<PixiByRenderInput[Key], Key>;
type Configs<Key extends VisualKey> = Record<string, PixiObject[Key]>;

export const create = <Key extends VisualKey>(configs: Configs<Key>, { byIdentifier, byTag, configBy, identifierBy }: Lookups<Key>, make: Factory<Key>) => {
    for (const identifier in configs) {
        const config = configs[identifier];
        const pixi = byIdentifier.get(identifier) ?? make(identifier, config);
        pixi.filters = [];
        byIdentifier.set(identifier, pixi);
        if (config.tag) setOrAppend(byTag, config.tag, pixi);
        if (config.parent) setOrAppend(childrenByIdentifier, config.parent, pixi);
        configBy.set(pixi, config);
        identifierBy.set(pixi, identifier);
    }
}

const formRelationships = ({ childrenByParent, parentByChild, lookup: { Sprite }, alias }: Scope) => {
    for (const [identifier, children] of childrenByIdentifier) {
        const parent = (Sprite.byIdentifier.get(identifier) ?? Sprite.byIdentifier.get(alias[identifier].assetPath))!; // since only sprites can be parents (for now)
        childrenByParent.set(parent, children);
        for (const child of children) parentByChild.set(child, parent);
    }
}

const initialize = <Key extends VisualKey>({ configBy }: Lookup<PixiByRenderInput[Key], Key>, scope: Scope, set: Setter<Key>) => {
    const { parentByChild, container } = scope;
    for (const [item, config] of configBy) {
        container.addChild(item);
        if (parentByChild.has(item)) continue; // children will be set via the parent setter
        set(item, scope, config);
    }
}

const setupMasks = (Sprite: Record<string, PixiObject["Sprite"]>, scope: Scope) => {
    for (const [spriteId, spriteConfig] of Object.entries(Sprite)) {
        const { mask } = spriteConfig;
        if (!mask) continue;
        const sprite = scope.lookup.Sprite.byIdentifier.get(spriteId);
        const graphic = scope.lookup.Graphic.byIdentifier.get(mask);
        sprite.mask = graphic;
    }
}

export const configure = ({ Graphic, Sprite }: Pick<RenderInput, VisualKey>, scope: Scope, makeSprite: Factory<"Sprite">, makeGraphic: Factory<"Graphic">) => {
    const { lookup, } = scope;
    childrenByIdentifier.clear();
    create(Graphic, lookup.Graphic, makeGraphic);
    create(Sprite, lookup.Sprite, makeSprite);
    formRelationships(scope);
    setupMasks(Sprite, scope);
    initialize(lookup.Sprite, scope, setSprite);
    initialize(lookup.Graphic, scope, drawGraphic);
}
