import { GameSessionRuntime } from '@app/utilities/game/game.interface';
import { CombatPlayerStatistics } from '@common/combat/combat.interface';
import {
    buildAttackCalculationLog,
    buildCombinedCalculationLog,
    buildCombatDifferenceLog,
    buildCombatResultLog,
    buildDefenseCalculationLog,
} from './game-session.combat-log';

type AppendLogEntry = (
    session: GameSessionRuntime,
    content: string,
    involvedPlayers: string[],
    visibleToPlayerIds?: string[] | null,
) => void;

export function appendCombatRoundLogEntries(
    session: GameSessionRuntime,
    statistics: CombatPlayerStatistics[],
    appendLogEntry: AppendLogEntry,
): void {
    if (statistics.length < 2) {
        return;
    }

    const involvedIds = [...new Set(statistics.flatMap((entry) => [entry.attacker.id, entry.victim.id]))];
    const involvedPlayers = session.match.players.filter((player) => involvedIds.includes(player.id));
    if (involvedPlayers.length < 2) {
        return;
    }

    const visibleToPlayerIds = involvedPlayers.map((player) => player.id);
    const involvedPlayerNames = involvedPlayers.map((player) => player.name);
    const attackLogs: string[] = [];
    const defenseLogs: string[] = [];

    for (const entry of statistics) {
        const attacker = session.match.players.find((player) => player.id === entry.attacker.id);
        const defender = session.match.players.find((player) => player.id === entry.victim.id);
        if (!attacker || !defender) {
            continue;
        }

        attackLogs.push(buildAttackCalculationLog(attacker.name, entry));
        defenseLogs.push(buildDefenseCalculationLog(defender.name, entry));
    }

    appendLogEntry(
        session,
        buildCombinedCalculationLog('attaque', attackLogs),
        involvedPlayerNames,
        visibleToPlayerIds,
    );
    appendLogEntry(
        session,
        buildCombinedCalculationLog('defense', defenseLogs),
        involvedPlayerNames,
        visibleToPlayerIds,
    );
    appendLogEntry(
        session,
        buildCombatDifferenceLog(session.match.players, statistics),
        involvedPlayerNames,
        visibleToPlayerIds,
    );
    appendLogEntry(
        session,
        buildCombatResultLog(session.match.players, statistics),
        involvedPlayerNames,
        visibleToPlayerIds,
    );
}
