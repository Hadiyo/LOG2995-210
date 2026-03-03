import { MouseEventType } from "./mouse-events.enum";

export type TileEvent = {
    type: MouseEventType;
    index: number;
    originalEvent: MouseEvent;
};