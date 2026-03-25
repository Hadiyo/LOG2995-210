import { inject, Injectable } from '@angular/core';
import { Character } from '@common/character/character.interface';
import {
    CHARACTER_BASE_ATTRIBUTES,
    CHARACTER_PLUS_TWO_VALUE,
} from '@common/character/character.model';
import { MatchEndState, InitializedMatch, MatchLobbyPlayer, MatchPlayer } from '@common/game/match.interface';
import { ObjectType } from '@common/maps/map.enums';
import { EditorMapDetails } from '@common/maps/map.interface';
import { generateClientId } from '@app/utils/id.util';
import {
    CLASSIC_WIN_THRESHOLD,
    DEFAULT_PLAYER_ATTACK,
    DEFAULT_PLAYER_DEFENSE,
} from './match-defaults';
import { MatchBoardService } from './match-board.service';
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
            attackDie: character.bonuses.attaqueDie,
            defenseDie: character.bonuses.defenseDie,
            controller: 'human',
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
        const initializedPlayers = players.map((player, index): MatchPlayer => {
            const startObject = shuffledStarts[index];
            return {
                ...player,
                position: cloneVec2(startObject.position),
                startingPosition: cloneVec2(startObject.position),
                health: player.maxHealth,
                combatWins: 0,
                render: {
                    facing: 'front',
                    pose: 'idle',
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
            objects: this.matchBoardService.buildVisibleObjects(map.objects, initializedPlayers),
            allObjects: map.objects.map((object) => ({ ...object, position: cloneVec2(object.position) })),
            allStartingPoints: availableStartObjects.map((object) => cloneVec2(object.position)),
            players: initializedPlayers,
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
        };
    }

    normalizeMatch(match: InitializedMatch | null): InitializedMatch | null {
        if (!match) {
            return null;
        }

        const normalizedPlayers = match.players.map((player) => ({
            ...player,
            baseAttack: player.baseAttack ?? DEFAULT_PLAYER_ATTACK,
            baseDefense: player.baseDefense ?? DEFAULT_PLAYER_DEFENSE,
            health: player.health ?? player.maxHealth,
            combatWins: player.combatWins ?? 0,
            controller: player.controller ?? 'human',
            render: {
                facing: player.render?.facing ?? 'front',
                pose: player.render?.pose ?? 'idle',
                ...(player.render?.poseStartedAt ? { poseStartedAt: player.render.poseStartedAt } : {}),
                ...(player.render?.poseDurationMs !== undefined ? { poseDurationMs: player.render.poseDurationMs } : {}),
            },
        }));
        const allObjects = (match.allObjects ?? match.objects).map((object) => ({
            ...object,
            position: cloneVec2(object.position),
        }));
        const allStartingPoints = (match.allStartingPoints ?? allObjects
            .filter((object) => object.type === ObjectType.START)
            .map((object) => object.position))
            .map((position) => cloneVec2(position));

        return {
            ...match,
            debugMode: match.debugMode ?? false,
            players: normalizedPlayers,
            allObjects,
            allStartingPoints,
            endState: match.endState ?? null,
            objects: this.matchBoardService.buildVisibleObjects(allObjects, normalizedPlayers),
        };
    }

    createClassicEndState(winner: MatchPlayer): MatchEndState {
        return {
            id: generateClientId(),
            winnerKind: 'player',
            winnerPlayerId: winner.id,
            message: `${winner.name} remporte la partie avec ${winner.combatWins} victoires de combat.`,
            resolvedAt: Date.now(),
        };
    }

    createNoWinnerEndState(remainingPlayer: MatchPlayer): MatchEndState {
        return {
            id: generateClientId(),
            winnerKind: 'none',
            winnerPlayerId: null,
            message: `La partie se termine sans gagnant: ${remainingPlayer.name} est le dernier joueur encore en partie apres les abandons.`,
            resolvedAt: Date.now(),
        };
    }

    isClassicWinner(combatWins: number): boolean {
        return combatWins >= CLASSIC_WIN_THRESHOLD;
    }

    private getCharacterSpeed(character: Character): number {
        return CHARACTER_BASE_ATTRIBUTES.rapidite +
            (character.bonuses.plusTwo === 'rapidite' ? CHARACTER_PLUS_TWO_VALUE : 0);
    }

    private getCharacterMaxHealth(character: Character): number {
        return CHARACTER_BASE_ATTRIBUTES.vie +
            (character.bonuses.plusTwo === 'vie' ? CHARACTER_PLUS_TWO_VALUE : 0);
    }
}
