import { createScope, prepare, start, type Scope, load, getHit } from "./runtime";
import type * as PIXI from '@pixi/webworker';
import type { WithoutNever } from "./utils";



export { createScope, prepare, start, Scope, load, getHit };

export type Position = {
    /** 
     * The value of this position, which can be thought of as the magnitude of the 1D vector from the `parent` anchor to the `self` anchor.
     * 
     * (see the documentation on the `self` and `parent` properties of the `anchors` object for more information)
     */
    value: number,
    anchors: {
        /** 
         * The positon on the imagery (sprite or graphic) where this position should correspond to.
         *  
         * A value of 0.5 means the center of the imagery, and 0 means the left or top edge.
         * 
         * When paired with the `parent` property, the `value` can be understood as the 1D vector from the `parent` anchor to this `self` anchor.
        */
        self: number,
        /**
         * The position from the imagery's parent (either the canvas or another imagery) that this position is calculated from.
         * 
         * A value of 0.5 means the center of the parent, and 0 means the left or top edge.
         * 
         * When paired with the `self` property, the `value` can be understood as the 1D vector from this `parent` anchor to the `self` anchor.
         */
        parent: number
    }
};

export const makeTransition = <Type extends keyof WithoutNever<PixiObject>, Property extends keyof WithoutNever<PixiObject>[Type]>(kind: Type, property: Property, transition: Omit<Transition<Type, Property>, "kind" | "property">) => ({
    ...transition, kind, property
}) as Transition<keyof WithoutNever<PixiObject>, keyof PixiObject[keyof PixiObject]>;

export type Shape =
    { kind: "rectangle", width: number, height: number, x: Position, y: Position } |
    { kind: "circle", radius: number, x: Position, y: Position } |
    {
        kind: "rounded rectangle",
        width: number,
        height: number,
        radius: number,
        /** The coordinate of where the rounded rectangle's center should align on the x / horizontal axis  */
        x: Position,
        /** The coordinate of where the rounded rectangle's center should align on the y / vertical axis  */
        y: Position
    } |
    { kind: "line", thickness: number, points: ({ x: Position, y: Position })[] } |
    { kind: "ellipse", x: Position, y: Position, width: number, height: number };

export type PixiObject = {
    Sprite: {
        x: Position;
        y: Position;
        width?: number;
        height?: number;
        rotation?: number;
        /**
         * Currently, the parent relationship only affects the x, y, width, and height properties of children.
         * In this way, this can (only) be used to position and/or size a sprite or graphic relative to another.
         */
        parent?: string;
        persistent?: boolean;
        tag?: string;
        ratio: number;
        zIndex?: number;
        roundness?: number;
        mask?: string;
        onClick?: string[];
    },
    Graphic: Shape & {
        color: PIXI.ColorSource,
        parent?: string;
        persistent?: boolean;
        tag?: string;
        zIndex?: number;
    },
    Filter: {
        type: "blur" | "alpha" | "brightness" | "glow",
        amount: number;
        persistent?: boolean;
        include?: { tags?: string[]; identifiers?: string[]; },
        tag?: string;
    },
    Transition: never,
}


export type Transition<Type extends keyof PixiObject, Property extends keyof (PixiObject[Type]) = keyof (PixiObject[Type])> = {
    kind: Type;
    target: {
        identifiers?: string[];
        tags?: string[];
    };
    property: Property;
    frames: PixiObject[Type][Property][];
    times: number[];
    tag?: string;
    persistent?: boolean;
    currentFrame?: number;
    repeat?: boolean;
    totalDuration?: number;
}
export type GenericTransition = Transition<keyof WithoutNever<PixiObject>, keyof PixiObject[keyof PixiObject]>;

export type RenderInput = {
    Sprite: Record<string, PixiObject["Sprite"]>;
    Filter: Record<string, PixiObject["Filter"]>;
    Graphic: Record<string, PixiObject["Graphic"]>;
    Transition: Record<string, GenericTransition>;
}

export type AliasLookup = { Alias: Record<string, { assetPath: string }> };

export type PixiByRenderInput = {
    Sprite: PIXI.Sprite;
    Filter: PIXI.Filter;
    Graphic: PIXI.Graphics;
}

export type Spritesheet = PIXI.SpriteSheetJson;

export type Transitionable = Omit<RenderInput, "Transition">;