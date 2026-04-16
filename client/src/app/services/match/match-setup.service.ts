import { inject, Injectable } from '@angular/core';
import { generateClientId } from '@app/utils/id.util';
import { Character } from '@common/character/character.interface';
import {
    CHARACTER_BASE_ATTRIBUTES,
    CHARACTER_PLUS_TWO_VALUE,
} from '@common/character/character.model';
import { InitializedMatch, MatchEndState, MatchLobbyPlayer, MatchPlayer } from '@common/game/match.interface';
import { buildTeamAssignments } from '@common/game/match.utils';
import { ObjectType } from '@common/maps/map.enums';
import { EditorMapDetails } from '@common/maps/map.interface';
import { PlayerFacing, PlayerPose } from '@common/player/player.interface';
import { MatchBoardService } from './match-board.service';
import {
    CLASSIC_WIN_THRESHOLD,
    DEFAULT_PLAYER_ATTACK,
    DEFAULT_PLAYER_DEFENSE,
} from './match-defaults';
import { cloneVec2, shuffle } from './match-geometry';

@Injectable({ providedIn: 'root' })
export class MatchSetupService {
    private readonly matchBoardService = inject(MatchBoardService);

    buildLocalPlayer(
        character: Character,
        _existingLocalPlayer: MatchLobbyPlayer | null,
        isOrganizer: boolean,
    ): MatchLobbyPlayer {
        return {
            id: generateClientId(),
            name: character.name,
            avatarId: character.avatarId,
            isOrganizer,
            speed: this.getCharacterSpeed(character),
            maxHealth: this.getCharacterMaxHealth(character),
            baseAttack: DEFAULT_PLAYER_ATTACK,
            baseDefense: DEFAULT_PLAYER_DEFENSE,
            attackDie: character.bonuses.attackDie,
            defenseDie: character.bonuses.defenseDie,
            controller: 'human',
            virtualProfile: null,
        };
    }

    buildInitializedMatch(map: EditorMapDetails, players: MatchLobbyPlayer[], random: () => number): InitializedMatch {
        if (players.length === 0) {
            throw new Error('Impossible de demarrer une partie sans joueur.');
        }

        const availableStartObjects = map.objects.filter((object) => object.type === ObjectType.START);
        if (availableStartObjects.length < players.length) {
            throw new Error('La carte ne contient pas assez de points de depart pour les joueurs actifs.');
        }

        const shuffledStarts = shuffle(availableStartObjects, random);
        const teamAssignments = buildTeamAssignments(players.length, map.mode, random);
        const initializedPlayers = players.map((player, index): MatchPlayer => {
            const startObject = shuffledStarts[index];
            return {
                ...player,
                position: cloneVec2(startObject.position),
                startingPosition: cloneVec2(startObject.position),
                teamId: teamAssignments[index],
                health: player.maxHealth,
                combatWins: 0,
                attackBonus: 0,
                defenseBonus: 0,
                arenaBuffTurnsRemaining: 0,
                render: {
                    facing: PlayerFacing.Front,
                    pose: PlayerPose.Idle,
                },
            };
        });

        return {
            mapId: map.id,
            mapName: map.name,
            mode: map.mode,
            mapSize: map.mapsize,
            debugMode: false,
            map: map.map.map((cell) => ({ ...cell, position: cloneVec2(cell.position) })),
            objects: this.matchBoardService.buildVisibleObjects(map.objects, initializedPlayers, null),
            allObjects: map.objects.map((object) => ({ ...object, position: cloneVec2(object.position) })),
            allStartingPoints: availableStartObjects.map((object) => cloneVec2(object.position)),
            players: initializedPlayers,
            flagCarrierId: null,
            pendingFlagTransfer: null,
            sanctuaryStates: this.matchBoardService.buildSanctuaryStates(map.objects),
            pendingSanctuaryChoice: null,
            endState: null,
        };
    }

    normalizeLobbyPlayer(player: MatchLobbyPlayer | null): MatchLobbyPlayer | null {
        if (!player) {
            return null;
        }

        return {
            ...player,
            baseAttack: player.baseAttack ?? DEFAULT_PLAYER_ATTACK,
            baseDefense: player.baseDefense ?? DEFAULT_PLAYER_DEFENSE,
            controller: player.controller ?? 'human',
            ...this.buildNormalizedVirtualProfile(player.controller ?? 'human', player.virtualProfile),
        };
    }

    normalizeMatch(match: InitializedMatch | null): InitializedMatch | null {
        if (!match) {
            return null;
        }

        const normalizedPlayers = match.players.map((player) => this.normalizeMatchPlayer(player));
        const allObjects = this.cloneAllObjects(match);
        const allStartingPoints = this.buildAllStartingPoints(match, allObjects);
        const sanctuaryStates = this.normalizeSanctuaryStates(match, allObjects);
        const pendingSanctuaryChoice = this.normalizePendingSanctuaryChoice(match, normalizedPlayers, sanctuaryStates);

        return {
            ...match,
            debugMode: match.debugMode ?? false,
            players: normalizedPlayers,
            allObjects,
            allStartingPoints,
            flagCarrierId: match.flagCarrierId ?? null,
            pendingFlagTransfer: match.pendingFlagTransfer ?? null,
            sanctuaryStates,
            pendingSanctuaryChoice,
            endState: match.endState ?? null,
            objects: this.matchBoardService.buildVisibleObjects(allObjects, normalizedPlayers, match.flagCarrierId ?? null),
        };
    }

    createClassicEndState(winner: MatchPlayer): MatchEndState {
        return {
            id: generateClientId(),
            winnerKind: 'player',
            winnerPlayerId: winner.id,
            winnerTeamId: null,
            message: `${winner.name} remporte la partie avec ${winner.combatWins} victoires de combat.`,
            resolvedAt: Date.now(),
        };
    }

    createNoWinnerEndState(remainingPlayer: MatchPlayer): MatchEndState {
        return {
            id: generateClientId(),
            winnerKind: 'none',
            winnerPlayerId: null,
            winnerTeamId: null,
            message: `La partie se termine sans gagnant: ${remainingPlayer.name} est le dernier joueur encore en partie apres les abandons.`,
            resolvedAt: Date.now(),
        };
    }

    isClassicWinner(combatWins: number): boolean {
        return combatWins >= CLASSIC_WIN_THRESHOLD;
    }

    private getCharacterSpeed(character: Character): number {
        return CHARACTER_BASE_ATTRIBUTES.speed +
            (character.bonuses.plusTwo === 'speed' ? CHARACTER_PLUS_TWO_VALUE : 0);
    }

    private getCharacterMaxHealth(character: Character): number {
        return CHARACTER_BASE_ATTRIBUTES.health +
            (character.bonuses.plusTwo === 'health' ? CHARACTER_PLUS_TWO_VALUE : 0);
    }

    private normalizeMatchPlayer(player: MatchPlayer): MatchPlayer {
        return {
            ...player,
            baseAttack: player.baseAttack ?? DEFAULT_PLAYER_ATTACK,
            baseDefense: player.baseDefense ?? DEFAULT_PLAYER_DEFENSE,
            health: player.health ?? player.maxHealth,
            combatWins: player.combatWins ?? 0,
            attackBonus: player.attackBonus ?? 0,
            defenseBonus: player.defenseBonus ?? 0,
            arenaBuffTurnsRemaining: player.arenaBuffTurnsRemaining ?? 0,
            controller: player.controller ?? 'human',
            ...this.buildNormalizedVirtualProfile(player.controller ?? 'human', player.virtualProfile),
            render: this.normalizePlayerRender(player),
        };
    }

    private cloneAllObjects(match: InitializedMatch) {
        return (match.allObjects ?? match.objects).map((object) => ({
            ...object,
            position: cloneVec2(object.position),
        }));
    }

    private buildAllStartingPoints(match: InitializedMatch, allObjects: InitializedMatch['allObjects']) {
        return (match.allStartingPoints ?? allObjects
            .filter((object) => object.type === ObjectType.START)
            .map((object) => object.position))
            .map((position) => cloneVec2(position));
    }

    private normalizeSanctuaryStates(match: InitializedMatch, allObjects: InitializedMatch['allObjects']) {
        const sanctuaryStateMap = new Map(
            this.matchBoardService.buildSanctuaryStates(allObjects).map((state) => [state.objectId, state]),
        );
        for (const state of match.sanctuaryStates ?? []) {
            if (!sanctuaryStateMap.has(state.objectId)) {
                continue;
            }

            sanctuaryStateMap.set(state.objectId, {
                objectId: state.objectId,
                cooldownTurnsRemaining: Math.max(0, state.cooldownTurnsRemaining ?? 0),
            });
        }

        return [...sanctuaryStateMap.values()];
    }

    private normalizePendingSanctuaryChoice(
        match: InitializedMatch,
        players: MatchPlayer[],
        sanctuaryStates: NonNullable<InitializedMatch['sanctuaryStates']>,
    ) {
        return match.pendingSanctuaryChoice &&
            players.some((player) => player.id === match.pendingSanctuaryChoice?.playerId) &&
            sanctuaryStates.some((state) => state.objectId === match.pendingSanctuaryChoice?.objectId)
            ? match.pendingSanctuaryChoice
            : null;
    }

    private normalizePlayerRender(player: MatchPlayer): NonNullable<MatchPlayer['render']> {
        return {
            facing: player.render?.facing ?? PlayerFacing.Front,
            pose: player.render?.pose ?? PlayerPose.Idle,
            ...(player.render?.poseStartedAt ? { poseStartedAt: player.render.poseStartedAt } : {}),
            ...(typeof player.render?.poseDurationMs === 'number' ? { poseDurationMs: player.render.poseDurationMs } : {}),
        };
    }

    private buildNormalizedVirtualProfile(
        controller: MatchLobbyPlayer['controller'],
        virtualProfile: MatchLobbyPlayer['virtualProfile'],
    ): Partial<Pick<MatchLobbyPlayer, 'virtualProfile'>> {
        return virtualProfile != null || controller === 'virtual'
            ? { virtualProfile: virtualProfile ?? null }
            : {};
    }
}
