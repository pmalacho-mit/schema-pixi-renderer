import * as PIXI from '@pixi/webworker';
import type { PixiByRenderInput, RenderInput } from "./";
import type { Scope } from './runtime';
import { set as setSprite } from "./visuals/sprite";
import { draw as drawGraphic } from "./visuals/graphic";
import { GlowFilter } from 'pixi-filters';

type Property = { [k in keyof PixiByRenderInput]: RenderInput[k][string] };

export type ApplyPropertyTo<T extends keyof PixiByRenderInput> = <Property extends keyof RenderInput[T][string]>(
    pixi: PixiByRenderInput[T],
    property: Property,
    value: RenderInput[T][string][Property],
    scope: Scope,
) => void;

export default {
    Sprite: (sprite, property, value, scope) => {
        const config = scope.lookup.Sprite.configBy.get(sprite)!;
        config[property] = value;
        setSprite(sprite, scope, config);
    },
    Filter: (filter, property, value, _) => {
        switch (property) {
            case "amount":
                const amount = value as Property["Filter"]["amount"];
                if (filter instanceof PIXI.BlurFilter) filter.blur = amount;
                else if (filter instanceof PIXI.AlphaFilter) filter.alpha = amount;
                // This will need to be adapted if we use ColorMatrixFilter for other purposes
                else if (filter instanceof PIXI.ColorMatrixFilter) filter.brightness(amount, false);
                else if (filter instanceof GlowFilter) filter.outerStrength = amount;
                return;
        }
    },

    Graphic: (graphic, property, value, scope) => {
        const config = scope.lookup.Graphic.configBy.get(graphic)!;
        config[property] = value;
        drawGraphic(graphic, scope, config);
    },

} satisfies ({ [k in keyof PixiByRenderInput]: ApplyPropertyTo<k> });