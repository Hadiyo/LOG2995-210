import { CombatPlayerStatistics } from '@common/combat/combat.interface';
import { MatchPlayer } from '@common/game/match.interface';

export function buildAttackCalculationLog(
    attackerName: string,
    entry: CombatPlayerStatistics,
): string {
    return [
        `Calcul detaille pour attaque de ${attackerName} :`,
        `valeur de base ${entry.attackBaseValue ?? 0},`,
        `bonus de posture ${formatSignedValue(entry.attackPostureBonus ?? 0)},`,
        `resultat de de ${entry.attackRoll},`,
        `malus ${formatPenalty(entry.attackPenalty ?? 0)},`,
        `total ${entry.attack}.`,
    ].join(' ');
}

export function buildDefenseCalculationLog(
    defenderName: string,
    entry: CombatPlayerStatistics,
): string {
    return [
        `Calcul detaille pour defense de ${defenderName} :`,
        `valeur de base ${entry.defenseBaseValue ?? 0},`,
        `bonus de posture ${formatSignedValue(entry.defensePostureBonus ?? 0)},`,
        `resultat de de ${entry.defenseRoll},`,
        `malus ${formatPenalty(entry.defensePenalty ?? 0)},`,
        `total ${entry.defense}.`,
    ].join(' ');
}

export function buildCombatDifferenceLog(
    players: MatchPlayer[],
    statistics: CombatPlayerStatistics[],
): string {
    const [firstAttack, secondAttack] = statistics;
    const firstAttacker = findPlayerName(players, firstAttack.attacker.id) ?? firstAttack.attacker.id;
    const firstDefender = findPlayerName(players, firstAttack.victim.id) ?? firstAttack.victim.id;
    const secondAttacker = findPlayerName(players, secondAttack.attacker.id) ?? secondAttack.attacker.id;
    const secondDefender = findPlayerName(players, secondAttack.victim.id) ?? secondAttack.victim.id;

    return [
        `Difference entre l'attaque de ${firstAttacker} et la defense de ${firstDefender} :`,
        `${firstAttack.attack - firstAttack.defense}.`,
        `Difference entre l'attaque de ${secondAttacker} et la defense de ${secondDefender} :`,
        `${secondAttack.attack - secondAttack.defense}.`,
    ].join(' ');
}

function buildAttackResultLog(
    attackerName: string,
    defenderName: string,
    damage: number,
): string {
    if (damage > 0) {
        return `Resultat de l'attaque de ${attackerName} contre ${defenderName} : ${damage} degats.`;
    }

    return `Resultat de l'attaque de ${attackerName} contre ${defenderName} : aucun degat.`;
}

export function buildCombatResultLog(
    players: MatchPlayer[],
    statistics: CombatPlayerStatistics[],
): string {
    const [firstAttack, secondAttack] = statistics;
    const firstAttacker = findPlayerName(players, firstAttack.attacker.id) ?? firstAttack.attacker.id;
    const firstDefender = findPlayerName(players, firstAttack.victim.id) ?? firstAttack.victim.id;
    const secondAttacker = findPlayerName(players, secondAttack.attacker.id) ?? secondAttack.attacker.id;
    const secondDefender = findPlayerName(players, secondAttack.victim.id) ?? secondAttack.victim.id;
    const firstDamage = firstAttack.damageDealt ?? Math.max(firstAttack.attack - firstAttack.defense, 0);
    const secondDamage = secondAttack.damageDealt ?? Math.max(secondAttack.attack - secondAttack.defense, 0);

    return [
        buildAttackResultLog(firstAttacker, firstDefender, firstDamage),
        buildAttackResultLog(secondAttacker, secondDefender, secondDamage),
    ].join(' ');
}

export function buildCombinedCalculationLog(
    label: 'attaque' | 'defense',
    lines: string[],
): string {
    return `Calcul detaille pour ${label} : ${lines.join(' ')}`;
}

function formatSignedValue(value: number): string {
    return value > 0 ? `+${value}` : `${value}`;
}

function formatPenalty(value: number): string {
    return value > 0 ? `-${value}` : '0';
}

function findPlayerName(players: MatchPlayer[], playerId: string): string | undefined {
    return players.find((player) => player.id === playerId)?.name;
}
