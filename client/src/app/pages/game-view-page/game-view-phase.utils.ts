import { MatchTurnState } from '@common/game/turn.interface';

export function getPhaseHeadline(
    turnState: MatchTurnState | null | undefined,
    activePlayerName: string | null,
    transitionTargetPlayerName: string | null,
    transitionCountdownSeconds: number,
): string {
    if (!turnState) {
        return 'Chargement de la partie';
    }

    if (turnState.phase === 'transition') {
        return `Debut du tour dans ${transitionCountdownSeconds} s`;
    }

    return `Tour actif: ${activePlayerName ?? 'Joueur inconnu'}`;
}

export function getPhaseDescription(
    turnState: MatchTurnState | null | undefined,
    transitionTargetPlayerName: string | null,
    movementPointsRemaining: number,
    actionAvailable: boolean,
): string {
    if (!turnState) {
        return 'Connexion a la session multijoueur.';
    }

    if (turnState.phase === 'transition') {
        return `Notification globale avant le tour de ${transitionTargetPlayerName ?? 'Joueur inconnu'}.`;
    }

    return `${movementPointsRemaining} point(s) de mouvement restant(s), action ${actionAvailable ? 'disponible' : 'utilisee'}.`;
}
