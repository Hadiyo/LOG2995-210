import type { EditorCell, EditorMap, MapObject } from '@common/maps/map.interface';

export type PersistedCell = Omit<EditorCell, 'position' | 'isWalkable' | 'isOccupied'> & { doorOpen?: boolean };
export type PersistedMap = Omit<EditorMap, 'id' | 'map'> & { map: PersistedCell[] };

export type PersistedMapRecord = Omit<EditorMap, 'id' | 'map'> & {
    _id: string;
    map: PersistedCell[];
    objects: MapObject[];
    createdAt?: Date;
    updatedAt?: Date;
};
