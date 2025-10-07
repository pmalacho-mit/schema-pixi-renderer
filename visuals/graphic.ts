import * as PIXI from '@pixi/webworker';
import { type Parent, point, resolvePosition, rootParent } from ".";
import type { PixiObject } from "..";
import type { Scope } from "../runtime";

export const draw = (graphic: PIXI.Graphics, scope: Scope, config?: PixiObject["Graphic"], parent?: Parent) => {
    const { lookup: { Graphic: lookup }, parentByChild } = scope;
    config ??= lookup.configBy.get(graphic)!;
    parent ??= parentByChild.get(graphic) ?? rootParent(scope);

    graphic.clear();
    graphic.zIndex = config.zIndex ?? 0;

    switch (config.kind) {
        case "circle": {
            const { x, y, radius, color } = config;
            const size = { width: radius * parent.width, height: radius * parent.height };
            const centerX = resolvePosition(x, "x", size, parent);
            const centerY = resolvePosition(y, "y", size, parent)
            graphic.beginFill(color);
            graphic.drawCircle(centerX, centerY, config.radius * parent.height);
            graphic.endFill();
            return;
        }
        case "rectangle": {
            const { color, x, y, } = config;
            const size = { width: config.width * parent.width, height: config.height * parent.height };
            const topLeftX = resolvePosition(x, "x", size, parent) - size.width / 2;
            const topLeftY = resolvePosition(y, "y", size, parent) - size.height / 2;
            graphic.beginFill(color);
            graphic.drawRect(topLeftX, topLeftY, size.width, size.height);
            graphic.endFill();
            return;
        }
        case "rounded rectangle": {
            const { color, x, y, radius } = config;
            const size = { width: config.width * parent.width, height: config.height * parent.height };
            const topLeftX = resolvePosition(x, "x", size, parent) - size.width / 2;
            const topLeftY = resolvePosition(y, "y", size, parent) - size.height / 2;
            const longest = size.width > size.height ? size.width : size.height;
            graphic.beginFill(color);
            graphic.drawRoundedRect(topLeftX, topLeftY, size.width, size.height, radius * longest);
            graphic.endFill();
            return;
        }
        case "line": {
            const { thickness, color, points } = config;
            graphic.lineStyle({
                width: thickness, color, cap: PIXI.LINE_CAP.ROUND,

            });
            graphic.moveTo(resolvePosition(points[0].x, "x", point, parent), resolvePosition(points[0].y, "y", point, parent));
            for (const { x, y } of points) {
                graphic.lineTo(resolvePosition(x, "x", point, parent), resolvePosition(y, "y", point, parent));
                graphic.moveTo(resolvePosition(x, "x", point, parent), resolvePosition(y, "y", point, parent));
            }
            console.log("line", graphic);
            return;
        }
        case "ellipse": {
            const { x, y, width, height, color } = config;
            const size = { width: width * parent.width, height: height * parent.height };
            const centerX = resolvePosition(x, "x", size, parent);
            const centerY = resolvePosition(y, "y", size, parent);
            graphic.beginFill(color);
            graphic.drawEllipse(centerX, centerY, size.width / 2, size.height / 2);
            return;
        }
    }
}