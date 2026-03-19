import { EditorCell, MapObject } from '@common/maps/map.interface';

export interface SelectedCellInfo {
    cell: EditorCell;
    object: MapObject | null;
}
