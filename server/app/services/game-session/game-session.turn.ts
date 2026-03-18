import { MatchPlayer } from '@common/game/match.interface';
import { MatchTurnOrderEntry } from '@common/game/turn.interface';
import { shuffle } from './game-session.match';

export const buildTurnOrderFromPlayers = (players: MatchPlayer[], random: () => number): MatchTurnOrderEntry[] => {
    const playersBySpeed = new Map<number, MatchPlayer[]>();

    players.forEach((player) => {
        const group = playersBySpeed.get(player.speed) ?? [];
        group.push(player);
        playersBySpeed.set(player.speed, group);
    });

    return [...playersBySpeed.entries()]
        .sort(([leftSpeed], [rightSpeed]) => rightSpeed - leftSpeed)
        .flatMap(([speed, groupedPlayers]) =>
            shuffle(groupedPlayers, random).map((player) => ({
                playerId: player.id,
                speed,
            })),
        );
};
