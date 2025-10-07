import type * as PIXI from '@pixi/webworker';
import { isSprite, resolvePosition } from ".";
import type { Scope } from '../runtime';
import type { PixiObject } from '..';
import { type Parent, rootParent } from ".";
import { draw as drawGraphic } from './graphic';


export const set = (sprite: PIXI.Sprite, scope: Scope, config?: PixiObject["Sprite"], parent?: Parent,) => {
    const { parentByChild, childrenByParent, lookup: { Sprite: lookup } } = scope;
    parent ??= parentByChild.get(sprite) ?? rootParent(scope);
    config ??= lookup.configBy.get(sprite)!;

    const { x, y, height, width, zIndex, rotation } = config!;
    if (height && width) {
        sprite.height = parent.height * height;
        sprite.width = parent.width * width;
    }
    else if (height) {
        sprite.height = parent.height * height;
        sprite.width = sprite.height * config?.ratio!;
    }
    else if (width) {
        sprite.width = parent.width * width;
        sprite.height = sprite.width / config?.ratio!;
    }
    sprite.x = resolvePosition(x, "x", sprite, parent);
    sprite.y = resolvePosition(y, "y", sprite, parent);

    // TODO: Should this be relative to parent?
    if (rotation !== undefined) sprite.rotation = rotation * 2 * Math.PI;

    if (zIndex !== undefined) sprite.zIndex = zIndex;

    if (!childrenByParent.has(sprite)) return;
    for (const child of childrenByParent.get(sprite)!)
        isSprite(child)
            ? set(child, scope, undefined, sprite)
            : drawGraphic(child, scope, undefined, sprite);
}
