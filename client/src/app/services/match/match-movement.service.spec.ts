import { TestBed } from '@angular/core/testing';
import { InitializedMatch, MatchPlayer } from '@common/game/match.interface';
import { GameMode, MapSize, ObjectSize, ObjectType, TileType } from '@common/maps/map.enums';
import { EditorCell } from '@common/maps/map.interface';
import { MatchMovementService } from './match-movement.service';

const createCells = (): EditorCell[] => {
    const cells: EditorCell[] = [];

    for (let y = 0; y < MapSize.S; y++) {
        for (let x = 0; x < MapSize.S; x++) {
            cells.push({
                position: { x, y },
                tileType: TileType.DIRT,
                isWalkable: true,
                isOccupied: false,
            });
        }
    }

    const patch = (x: number, y: number, next: Partial<EditorCell>): void => {
        const cell = cells.find((candidate) => candidate.position.x === x && candidate.position.y === y);
        if (cell) Object.assign(cell, next);
    };

    patch(2, 1, { tileType: TileType.WATER });
    patch(3, 1, { tileType: TileType.ICE });
    patch(4, 1, { tileType: TileType.WALL, isWalkable: false });
    patch(1, 2, { tileType: TileType.DOOR, isWalkable: false });
    patch(2, 2, { tileType: TileType.DOOR, isWalkable: true });

    return cells;
};

const createPlayers = (): MatchPlayer[] => [
    {
        id: 'player-1',
        name: 'Alpha',
        avatarId: 0,
        isOrganizer: true,
        speed: 8,
        maxHealth: 6,
        baseAttack: 4,
        baseDefense: 4,
        attackDie: 'D6',
        defenseDie: 'D4',
        controller: 'human',
        position: { x: 1, y: 1 },
        startingPosition: { x: 1, y: 1 },
        health: 6,
        combatWins: 0,
    },
    {
        id: 'player-2',
        name: 'Bravo',
        avatarId: 1,
        isOrganizer: false,
        speed: 6,
        maxHealth: 6,
        baseAttack: 4,
        baseDefense: 4,
        attackDie: 'D6',
        defenseDie: 'D4',
        controller: 'human',
        position: { x: 5, y: 5 },
        startingPosition: { x: 5, y: 5 },
        health: 6,
        combatWins: 0,
    },
];

const createMatch = (): InitializedMatch => {
    const allObjects = [
        { id: 1, type: ObjectType.START, position: { x: 1, y: 1 }, size: ObjectSize.S },
        { id: 2, type: ObjectType.START, position: { x: 5, y: 5 }, size: ObjectSize.S },
    ];

    return {
        mapId: 'map-1',
        mapName: 'Arena',
        mode: GameMode.CLASSIC,
        mapSize: MapSize.S,
        debugMode: false,
        map: createCells(),
        objects: allObjects,
        allObjects,
        allStartingPoints: [{ x: 1, y: 1 }, { x: 5, y: 5 }],
        players: createPlayers(),
    };
};

describe('MatchMovementService', () => {
    let service: MatchMovementService;

    beforeEach(() => {
        TestBed.configureTestingModule({});
        service = TestBed.inject(MatchMovementService);
    });

    it('should apply the correct movement costs from the destination tile', () => {
        const match = createMatch();

        expect(service.getMovementCost(match, { x: 2, y: 1 }, 'player-1')).toBe(2);
        expect(service.getMovementCost(match, { x: 3, y: 1 }, 'player-1')).toBe(0);
        expect(service.getMovementCost(match, { x: 2, y: 2 }, 'player-1')).toBe(1);
    });

    it('should reject walls, closed doors, occupied tiles, and off-map movement', () => {
        const match = createMatch();
        match.players[1].position = { x: 0, y: 1 };

        expect(service.getMovementCost(match, { x: 4, y: 1 }, 'player-1')).toBeNull();
        expect(service.getMovementCost(match, { x: 1, y: 2 }, 'player-1')).toBeNull();
        expect(service.getMovementCost(match, { x: 0, y: 1 }, 'player-1')).toBeNull();
        expect(service.getMovementCost(match, { x: -1, y: 1 }, 'player-1')).toBeNull();
    });

    it('should treat sanctuaries as blocked tiles for movement', () => {
        const match = createMatch();
        const sanctuary = { id: 3, type: ObjectType.REGEN, position: { x: 6, y: 1 }, size: ObjectSize.L };
        match.objects = [...match.objects, sanctuary];
        match.allObjects = [...match.allObjects, sanctuary];

        expect(service.getMovementCost(match, { x: 6, y: 1 }, 'player-1')).toBeNull();
        expect(service.getMovementCost(match, { x: 7, y: 2 }, 'player-1')).toBeNull();
    });

    it('should allow only cardinal moves within the remaining movement points', () => {
        const match = createMatch();

        expect(service.tryMove(match, 'player-1', 'right', 2)).toEqual({
            success: true,
            cost: 2,
            destination: { x: 2, y: 1 },
            reason: null,
        });

        expect(service.tryMove(match, 'player-1', 'right', 1)).toEqual({
            success: false,
            cost: 2,
            destination: { x: 2, y: 1 },
            reason: 'INSUFFICIENT_MOVEMENT_POINTS',
        });
    });

    it('should compute reachable tiles using the movement rules', () => {
        const match = createMatch();
        const reachable = service.getReachableTiles(match, 'player-1', 3);

        expect(reachable.has('1:1')).toBeTrue();
        expect(reachable.has('2:1')).toBeTrue();
        expect(reachable.has('3:1')).toBeTrue();
        expect(reachable.has('4:1')).toBeFalse();
        expect(reachable.has('1:2')).toBeFalse();
    });
});
