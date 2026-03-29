import { CHARACTER_BASE_ATTRIBUTES } from '@common/character/character.model';
import { MatchPlayer, MatchPlayerController, VirtualPlayerProfile } from '@common/game/match.interface';
import { Player, PlayerFacing, PlayerPose, PlayerStatus } from '@common/player/player.interface';

type VirtualPlayerLike = {
    controller?: MatchPlayerController;
    virtualProfile?: VirtualPlayerProfile | null;
} | null | undefined;

export function toGamePlayer(
    player: MatchPlayer,
    activePlayerId: string | null,
    actionTaken: boolean,
    movementPointsRemaining: number,
    flagCarrierId: string | null,
): Player {
    const isActivePlayer = activePlayerId === player.id;

    return {
        id: player.id,
        information: {
            name: player.name,
            avatarId: player.avatarId,
            isOrganizer: player.isOrganizer,
            controller: player.controller,
            virtualProfile: player.virtualProfile ?? null,
            teamId: player.teamId ?? null,
            dices: {
                attack: player.attackDie,
                defense: player.defenseDie,
            },
            bonus: player.speed > CHARACTER_BASE_ATTRIBUTES.rapidite ? 'speed' : 'life',
        },
        state: {
            position: player.position,
            status: player.health > 0 ? PlayerStatus.Active : PlayerStatus.Eliminated,
            attributes: {
                health: player.health,
                maxHealth: player.maxHealth,
                speed: player.speed,
                attack: player.baseAttack + (player.attackBonus ?? 0),
                defense: player.baseDefense + (player.defenseBonus ?? 0),
            },
            wins: player.combatWins,
            hasFlag: flagCarrierId === player.id,
            remainingActions: isActivePlayer && !actionTaken ? 1 : 0,
            remainingMovements: isActivePlayer ? movementPointsRemaining : 0,
        },
        render: {
            facing: player.render?.facing ?? PlayerFacing.Front,
            pose: player.render?.pose ?? PlayerPose.Idle,
            poseStartedAt: player.render?.poseStartedAt,
            poseDurationMs: player.render?.poseDurationMs,
        },
    };
}

export function getActivePanelPlayer(
    turnPhase: 'active' | 'transition' | null | undefined,
    activePlayer: Player | null,
    players: readonly Player[],
    transitionTargetPlayerId: string | null,
): Player | null {
    if (!turnPhase) {
        return null;
    }

    return turnPhase === 'active'
        ? activePlayer
        : players.find((player) => player.id === transitionTargetPlayerId) ?? null;
}

export function getVirtualPlayerBadgeLabel(player: VirtualPlayerLike): string | null {
    if (player?.controller !== 'virtual') {
        return null;
    }

    return player.virtualProfile === 'defensive' ? 'JV defensif' : 'JV agressif';
}
