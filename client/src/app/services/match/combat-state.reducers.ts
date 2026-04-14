import { CombatWaitingSnapshot } from '@common/combat/combat.interface';
import { MatchLobbyPlayer, MatchPlayer } from '@common/game/match.interface';
import { PlayerPose } from '@common/player/player.interface';
import { CombatFooterMessageOptions, CombatPanelStateFromTurnSnapshotOptions } from './combat-state.interfaces';
import {
    CombatOutcomeNotice,
    CombatPanelFighter,
    CombatPanelState,
    CombatRoundFighterLog,
    CombatRoundLog,
    CombatWaitingState,
} from './combat-state.models';
import {
    createCombatPanelFighter,
    getCombatOrientation,
    getCountdownSeconds,
    getOrderedCombatPlayers,
    getTileTypeForCombatPlayer,
    isOpenDoorForCombatPlayer,
    resolveCombatParticipants,
} from './combat-state.utils';

export function getCombatFooterMessage({
    canSelectStance,
    endingNotice,
    hasActiveCombat,
    isResolvingRound,
    selectedStance,
}: CombatFooterMessageOptions): string {
    if (!hasActiveCombat) {
        return '';
    }

    if (endingNotice) {
        return 'Fin du combat.';
    }

    if (isResolvingRound) {
        return 'Résolution du tour en cours...';
    }

    if (!canSelectStance) {
        return 'En attente du prochain choix de posture.';
    }

    if (selectedStance === 'attack') {
        return 'Posture offensive sélectionnée.';
    }

    if (selectedStance === 'defense') {
        return 'Posture défensive sélectionnée.';
    }

    return 'Choisissez une posture pour préparer le combat.';
}

export function buildCombatPanelStateFromTurnSnapshot({
    currentPanelState,
    keepAnimatedPose,
    localPlayerId,
    match,
    turnState,
}: CombatPanelStateFromTurnSnapshotOptions): CombatPanelState | null {
    const participants = resolveCombatParticipants(match.players, turnState);
    if (!participants) {
        return null;
    }

    const [attacker, defender] = participants;
    const orientation = getCombatOrientation(attacker, defender);
    const orderedPlayers = getOrderedCombatPlayers(attacker, defender, orientation);
    const isNewCombat = currentPanelState?.id !== turnState.matchId;
    const round = isNewCombat ? 1 : (currentPanelState?.round ?? 1);
    const currentHealthByFighterId = new Map(
        currentPanelState?.fighters.map((fighter) => [fighter.id, fighter.currentHealth]) ?? [],
    );
    const previousFightersById = new Map(
        currentPanelState?.fighters.map((fighter) => [fighter.id, fighter]) ?? [],
    );
    const fighters = orderedPlayers.map((player, index) =>
        createCombatPanelFighter({
            player,
            index,
            localPlayerId,
            currentHealth: currentHealthByFighterId.get(player.id) ?? player.health,
            previousFighter: previousFightersById.get(player.id) ?? null,
            tileType: getTileTypeForCombatPlayer(match, player),
            isDoorOpen: isOpenDoorForCombatPlayer(match, player),
            keepAnimatedPose,
        }),
    ) as [CombatPanelFighter, CombatPanelFighter];

    return {
        id: turnState.matchId,
        attackerId: attacker.id,
        defenderId: defender.id,
        orientation,
        round,
        countdownSeconds: getCountdownSeconds(turnState),
        fighters,
    };
}

export function applyResolvedDiceState(
    panelState: CombatPanelState,
    resolvedRoundLog: CombatRoundLog,
): CombatPanelState {
    const resolvedFightersById = getResolvedFightersById(resolvedRoundLog);
    return {
        ...panelState,
        fighters: panelState.fighters.map((fighter) => ({
            ...fighter,
            attackRollValue: resolvedFightersById.get(fighter.id)?.attack.dieValue ?? fighter.attackRollValue,
            defenseRollValue: resolvedFightersById.get(fighter.id)?.defense.dieValue ?? fighter.defenseRollValue,
            rollToken: fighter.rollToken + 1,
            pose: PlayerPose.Idle,
            isDefending: false,
            isHit: false,
        })) as [CombatPanelFighter, CombatPanelFighter],
    };
}

export function applyResolvedStanceAnimationState(
    panelState: CombatPanelState,
    resolvedRoundLog: CombatRoundLog,
): CombatPanelState {
    const resolvedFightersById = getResolvedFightersById(resolvedRoundLog);
    return {
        ...panelState,
        fighters: panelState.fighters.map((fighter) => ({
            ...fighter,
            pose: resolvedFightersById.get(fighter.id)?.stance === 'attack' ? PlayerPose.Attack : PlayerPose.Idle,
            isDefending: resolvedFightersById.get(fighter.id)?.stance === 'defense',
        })) as [CombatPanelFighter, CombatPanelFighter],
    };
}

export function applyResolvedDamageState(
    panelState: CombatPanelState,
    damageTakenByFighterId: Map<string, number>,
    updatedHealthByFighterId: Map<string, number>,
): CombatPanelState {
    return {
        ...panelState,
        fighters: panelState.fighters.map((fighter) => {
            const nextHealth = updatedHealthByFighterId.get(fighter.id) ?? fighter.currentHealth;
            return {
                ...fighter,
                currentHealth: nextHealth,
                pose: nextHealth <= 0 ? PlayerPose.Dead : PlayerPose.Idle,
                isDefending: false,
                isHit: (damageTakenByFighterId.get(fighter.id) ?? 0) > 0,
            };
        }) as [CombatPanelFighter, CombatPanelFighter],
    };
}

export function advanceCombatRoundState(panelState: CombatPanelState): CombatPanelState {
    return {
        ...panelState,
        round: panelState.round + 1,
        fighters: panelState.fighters.map((fighter) => ({
            ...fighter,
            isHit: false,
            isDefending: false,
            pose: fighter.currentHealth <= 0 ? PlayerPose.Dead : PlayerPose.Idle,
        })) as [CombatPanelFighter, CombatPanelFighter],
    };
}

export function createCombatForfeitNotice(
    localPlayer: MatchLobbyPlayer,
    matchPlayers: readonly MatchPlayer[],
    panelState: CombatPanelState,
): CombatOutcomeNotice | null {
    const missingOpponent = panelState.fighters.find((fighter) =>
        fighter.id !== localPlayer.id && !matchPlayers.some((player) => player.id === fighter.id),
    );
    if (!missingOpponent) {
        return null;
    }

    const localPlayerName = matchPlayers.find((player) => player.id === localPlayer.id)?.name ?? localPlayer.name;
    return {
        id: `${localPlayer.id}:${missingOpponent.id}:${Date.now()}`,
        attackerId: localPlayer.id,
        defenderId: missingOpponent.id,
        attackerMessage: `Victoire contre ${missingOpponent.name} par abandon.`,
        defenderMessage: `Défaite contre ${localPlayerName} par abandon.`,
        logMessage: `${missingOpponent.name} abandonne le combat.`,
    };
}

export function createCombatWaitingState(
    snapshot: CombatWaitingSnapshot,
    players: readonly MatchPlayer[],
): CombatWaitingState {
    const attacker = players.find((player) => player.id === snapshot.attackerId) ?? null;
    const defender = players.find((player) => player.id === snapshot.defenderId) ?? null;
    const activePlayer = players.find((player) => player.id === snapshot.activePlayerId) ?? null;
    return {
        combatId: snapshot.combatId,
        gameSessionId: snapshot.gameSessionId,
        attackerId: snapshot.attackerId,
        defenderId: snapshot.defenderId,
        activePlayerId: snapshot.activePlayerId,
        attackerName: attacker?.name ?? snapshot.attackerId,
        defenderName: defender?.name ?? snapshot.defenderId,
        activePlayerName: activePlayer?.name ?? snapshot.activePlayerId,
        phase: snapshot.phase,
        round: snapshot.round,
        countdownSeconds: snapshot.countdownSeconds,
    };
}

function getResolvedFightersById(resolvedRoundLog: CombatRoundLog): Map<string, CombatRoundFighterLog> {
    return new Map(resolvedRoundLog.fighters.map((fighter) => [fighter.fighterId, fighter]));
}
