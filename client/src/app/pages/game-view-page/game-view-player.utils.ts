import { CHARACTER_BASE_ATTRIBUTES } from '@common/character/character.model';
import { MatchPlayer } from '@common/game/match.interface';
import { Player, PlayerStatus } from '@common/player/player.interface';

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
                attack: player.baseAttack,
                defense: player.baseDefense,
            },
            wins: player.combatWins,
            hasFlag: flagCarrierId === player.id,
            remainingActions: isActivePlayer && !actionTaken ? 1 : 0,
            remainingMovements: isActivePlayer ? movementPointsRemaining : 0,
        },
        render: player.render ? { ...player.render } : {},
    };
}
