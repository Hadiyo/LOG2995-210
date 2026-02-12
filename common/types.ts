import { MouseEventType } from "./enum";

export type TileEvent = {
    type: MouseEventType;
    index: number;
    originalEvent: MouseEvent;
};