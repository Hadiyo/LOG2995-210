import { ObjectType, TileType } from '@common/enum';
import type { Vec2 } from '@common/interface';

/**
 * Snapshot of what the user is currently inspecting (mouse tool)
 * Stored so Sidebar / UI can show contextual actions like "delete object".
 */
export type SelectedCellInfo = {
    index: number;
    position: Vec2;
    tileType: TileType;
    objectType: ObjectType | null;
    objectId: number | null;
};