import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { ObjectSize, TileType } from '@common/enum';
import type { EditorCell, EditorMap, MapObject, Vec2 } from '@common/interface';
import { Game, GameDocument } from '@app/model/database/game';
import { createNameUniquenessChecker, validateGameOnServer } from '@app/validators/server-game-validation';

type PersistedCell = Omit<EditorCell, 'isWalkable' | 'isOccupied'> & { doorOpen?: boolean };
type PersistedGame = Omit<EditorMap, 'id' | 'map'> & { map: PersistedCell[] };

type PersistedGameRecord = Omit<EditorMap, 'id' | 'map'> & {
    _id: string;
    map: PersistedCell[];
    objects: MapObject[];
    createdAt?: Date;
    updatedAt?: Date;
};

@Injectable()
export class GameService {
    constructor(@InjectModel(Game.name) private readonly gameModel: Model<GameDocument>) {}

    async getAllGames(): Promise<EditorMap[]> {
        const games = await this.gameModel.find().sort({ createdAt: 1 }).exec();
        return games.map((game) => this.toEditorMap(game));
    }

    async getVisibleGames(): Promise<EditorMap[]> {
        const games = await this.gameModel.find({ visibility: true }).sort({ createdAt: 1 }).exec();
        return games.map((game) => this.toEditorMap(game));
    }

    async getGameById(id: string): Promise<EditorMap> {
        const game = await this.gameModel.findById(id).exec();
        if (!game) {
            throw new NotFoundException('Game not found');
        }
        return this.toEditorMap(game);
    }

    async createGame(game: EditorMap): Promise<EditorMap> {
        await this.ensureGameIsValid(game);
        const created = await this.insertGame(game);
        return this.toEditorMap(created);
    }

    async updateGame(id: string, game: EditorMap): Promise<EditorMap> {
        await this.ensureGameIsValid(game, id);

        const updated = await this.gameModel.findByIdAndUpdate(id, this.buildGamePayload(game), { new: true }).exec();
        if (updated) {
            return this.toEditorMap(updated);
        }

        const created = await this.insertGame(game);
        return this.toEditorMap(created);
    }

    async updateGameVisibility(id: string, isVisible: boolean): Promise<EditorMap> {
        const updated = await this.gameModel.findByIdAndUpdate(id, { visibility: isVisible }, { new: true }).exec();
        if (!updated) {
            throw new NotFoundException('Game not found');
        }
        return this.toEditorMap(updated);
    }

    async deleteGame(id: string): Promise<void> {
        const result = await this.gameModel.deleteOne({ _id: id }).exec();
        if (result.deletedCount === 0) {
            throw new NotFoundException('Game already deleted or missing');
        }
    }

    private async ensureGameIsValid(game: EditorMap, excludeId?: string): Promise<void> {
        const isNameUnique = createNameUniquenessChecker(this.gameModel, { excludeId });
        const validation = await validateGameOnServer(game, isNameUnique);
        if (validation.isValid) return;

        throw new BadRequestException(validation);
    }

    private async insertGame(game: EditorMap): Promise<GameDocument> {
        const payload = this.buildGamePayload(game);
        return this.gameModel.create(payload);
    }

    private buildGamePayload(game: EditorMap): PersistedGame {
        const now = new Date().toISOString();
        return {
            name: game.name.trim(),
            description: game.description.trim(),
            mode: game.mode,
            size: game.size,
            date: now,
            map: game.map.map((cell) => ({
                position: cell.position,
                tileType: cell.tileType,
                ...(cell.tileType === TileType.DOOR ? { doorOpen: cell.isWalkable === true } : {}),
            })),
            objects: game.objects,
            visibility: false,
        };
    }

    private toEditorMap(game: GameDocument): EditorMap {
        const gameObject = game.toObject({ versionKey: false }) as PersistedGameRecord;
        const { _id: idValue, map, objects, ...rest } = gameObject;
        delete (rest as { createdAt?: Date }).createdAt;
        delete (rest as { updatedAt?: Date }).updatedAt;
        const occupied = this.buildOccupiedKeySet(objects);
        const hydratedMap: EditorCell[] = map.map((cell) => {
            const isWalkable = this.isTileWalkable(cell.tileType, cell.doorOpen);
            const key = `${cell.position.x},${cell.position.y}`;
            return {
                position: cell.position,
                tileType: cell.tileType,
                isWalkable,
                isOccupied: occupied.has(key),
            };
        });
        return {
            ...rest,
            map: hydratedMap,
            objects,
            id: idValue.toString(),
        };
    }

    private isTileWalkable(tileType: TileType, doorOpen?: boolean): boolean {
        if (tileType === TileType.WALL) return false;
        if (tileType === TileType.DOOR) return doorOpen === true;
        return true;
    }

    private buildOccupiedKeySet(objects: MapObject[]): Set<string> {
        const occupied = new Set<string>();
        for (const object of objects) {
            for (const pos of this.getCoveredPositions(object.position, object.size)) {
                occupied.add(`${pos.x},${pos.y}`);
            }
        }
        return occupied;
    }

    private getCoveredPositions(position: Vec2, size: ObjectSize): Vec2[] {
        if (size === ObjectSize.S) {
            return [{ ...position }];
        }
        return [
            { ...position },
            { x: position.x + 1, y: position.y },
            { x: position.x, y: position.y + 1 },
            { x: position.x + 1, y: position.y + 1 },
        ];
    }
}
