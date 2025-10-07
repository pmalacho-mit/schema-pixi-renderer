import * as PIXI from '@pixi/webworker';
import type { AliasLookup, GenericTransition, PixiObject, RenderInput, Spritesheet, } from "./";
import { perform as performTransitions, configure as configureTransitions } from './transitions';
import { configure as configureVisuals, type ParentVisual, type Visual } from "./visuals";
import { configure as configureFilters } from "./filters";

export type Lookup<T, Key extends keyof RenderInput> = {
    byIdentifier: Map<string, T>;
    byTag: Map<string, T[]>;
    configBy: Map<T, PixiObject[Key]>;
    identifierBy: Map<T, string>;
}

const createLookup = <T, K extends keyof RenderInput>(): Lookup<T, K> => ({
    byIdentifier: new Map(),
    byTag: new Map(),
    configBy: new Map(),
    identifierBy: new Map(),
});

export type Scope = {
    app: PIXI.Application;
    container: PIXI.Container;
    assetPrefix?: string;
    lookup: {
        Sprite: Lookup<PIXI.Sprite, "Sprite">;
        Filter: Lookup<PIXI.Filter, "Filter">;
        Graphic: Lookup<PIXI.Graphics, "Graphic">;
        Transition: Lookup<GenericTransition, "Transition">;
    },
    childrenByParent: Map<ParentVisual, Visual[]>;
    parentByChild: Map<Visual, ParentVisual>;
    startTimeSeconds: number;
    elapsedTimeSeconds: number;
    alias: AliasLookup["Alias"];
    spritesheets?: Spritesheet[];
    texturesFromSheet?: Record<string, PIXI.Texture<PIXI.Resource>>;
}

export const createScope = (canvas: HTMLCanvasElement | OffscreenCanvas, assetPrefix?: string, pixelRatio?: number, spritesheets?: Spritesheet[]) => {
    const scope: Scope = {
        container: new PIXI.Container(),
        app: new PIXI.Application({
            view: canvas as PIXI.ICanvas,
            backgroundColor: '#fff',
            width: canvas.width,
            height: canvas.height,
        }),
        lookup: {
            Sprite: createLookup(),
            Filter: createLookup(),
            Transition: createLookup(),
            Graphic: createLookup(),
        },
        childrenByParent: new Map(),
        parentByChild: new Map(),
        elapsedTimeSeconds: 0,
        startTimeSeconds: performance.now(),
        assetPrefix,
        alias: undefined as any as Scope["alias"],
        spritesheets,
        texturesFromSheet: undefined,
    };
    scope.app.stage.addChild(scope.container);
    scope.app.ticker.add(performTransitions.bind(null, scope));
    scope.app.stage.sortableChildren = true;
    return scope;
}

const clean = <T extends PIXI.Sprite | PIXI.Filter | PIXI.Graphics>(
    current: Record<string, any>, lookup: Lookup<T, keyof RenderInput>
) => {
    if (!current) return;
    const set = new Set(Object.keys(current));
    for (const [identifier, item] of lookup.byIdentifier) {
        if (set.has(identifier)) continue;
        lookup.byIdentifier.delete(identifier);
        lookup.configBy.delete(item);
        item.destroy();
    }
    lookup.byTag.clear();
}

const getLocater = ({ assetPrefix }: Pick<Scope, "assetPrefix">) => (id: string) => (assetPrefix ?? "") + id;

type Input = RenderInput & AliasLookup;

export const load = async (scope: Scope, input: Input, locate?: ReturnType<typeof getLocater>) => {
    locate ??= getLocater(scope);
    if (scope.spritesheets) {
        if (!scope.texturesFromSheet) {
            const sprites = Object.keys(input.Sprite);
            const textures = await Promise.all(
                Object.values(scope.spritesheets).map(async sheet => {
                    const texture = PIXI.BaseTexture.from(locate(sheet.meta.image));
                    const spritesheet = new PIXI.Spritesheet(texture, sheet);
                    await spritesheet.parse();
                    await Promise.all(sprites
                        .map(_sprite => spritesheet.textures[_sprite])
                        .filter(Boolean)
                        .map(_texture => new Promise((r) => _texture.on('update', r))));
                    return spritesheet.textures;
                })
            );
            scope.texturesFromSheet = Object.assign({}, ...textures);
        }
        return scope.texturesFromSheet!;
    }
    else return PIXI.Assets.load<PIXI.Texture>(Object.keys(input.Sprite).map(locate));
}

export const prepare = async (scope: Scope, input: Input) => {
    console.time("prepare");
    const { app, parentByChild, childrenByParent, lookup } = scope;
    app.stop();
    scope.alias = input.Alias;

    (["Sprite", "Graphic", "Filter"] as const).forEach(key => clean(input[key], lookup[key] as any));
    [...Object.values(lookup.Transition), parentByChild, childrenByParent].forEach(map => map.clear());

    const locate = getLocater(scope);
    const textures = await load(scope, input, locate);

    configureVisuals(
        input,
        scope,
        (identifier) => {
            const sprite = PIXI.Sprite.from(textures[identifier] ?? textures[locate(identifier)]);
            sprite.anchor.set(0.5);
            return sprite;
        },
        () => new PIXI.Graphics()
    );

    configureFilters(input, scope);

    configureTransitions(input, scope);
    scope.container.sortableChildren = true;
    scope.container.sortChildren();
    scope.elapsedTimeSeconds = 0;
    scope.startTimeSeconds = performance.now();
    scope.app.ticker.update();
    scope.app.stop();
    console.timeEnd("prepare");
}


export const start = (scope: Scope) => {
    //debugger;
    scope.startTimeSeconds = performance.now();
    scope.app.start();
}

type SceneItem = PIXI.Sprite | PIXI.Container | PIXI.Graphics;
const isSceneItem = (item: any): item is SceneItem => {
    return item instanceof PIXI.Sprite || item instanceof PIXI.Container || item instanceof PIXI.Graphics;
}

function findTopmostObjectAtPosition(root: SceneItem, x: number, y: number) {
    let topmostObject: SceneItem | null = null;

    // Recursive function to traverse the scene graph
    function traverse(container: SceneItem, x: number, y: number) {
        // Iterate backwards to start checking from the topmost (last rendered) object
        for (let i = container.children.length - 1; i >= 0; i--) {
            const child = container.children[i];

            // Calculate the bounds of the child
            const bounds = child.getBounds();

            // Check if the click is within the bounds of the child
            if (x >= bounds.x && x <= bounds.x + bounds.width &&
                y >= bounds.y && y <= bounds.y + bounds.height) {

                // If the child is a container itself, dive deeper
                if (isSceneItem(child) && child.children && child.children.length > 0) {
                    traverse(child, x, y);
                }

                // Update the topmost object if this child is the topmost one so far
                if (!topmostObject || child.zIndex > topmostObject.zIndex) {
                    topmostObject = child as SceneItem;
                }


                // Since we've found a child under the point, break the loop
                return;
            }
        }
    }

    traverse(root, x, y);

    return topmostObject;
}

export const getHit = (scope: Scope, x: number, y: number) => {
    // loop over scop children
    const candidate = findTopmostObjectAtPosition(scope.container, x, y);
    if (!candidate) return postMessage(null);
    const result = candidate as SceneItem;
    if (result instanceof PIXI.Sprite) {
        const config = scope.lookup.Sprite.configBy.get(result);
        (config as any)["identifier"] = scope.lookup.Sprite.identifierBy.get(result);
        postMessage(config);
    }
    else if (result instanceof PIXI.Graphics) {
        const config = scope.lookup.Graphic.configBy.get(result);
        (config as any)["identifier"] = scope.lookup.Graphic.identifierBy.get(result);
        postMessage(config);
    }
}

