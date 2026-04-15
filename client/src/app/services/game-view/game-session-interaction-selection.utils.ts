import { GameSessionActionContext } from '@app/config/game-session.config';
import { GameSessionTargetsService } from './game-session-targets.service';

export interface GameSessionActionTargetSets {
    combat: ReadonlySet<string>;
    door: ReadonlySet<string>;
    flagTransfer: ReadonlySet<string>;
    sanctuary: ReadonlySet<string>;
}

type GameSessionActionTargetSource = Pick<
    GameSessionTargetsService,
    'getCombatActionTargets' | 'getDoorActionTargets' | 'getFlagTransferTargets' | 'getSanctuaryActionTargets'
>;

export function createActionTargetSets(targetSource: GameSessionActionTargetSource): GameSessionActionTargetSets {
    return {
        sanctuary: targetSource.getSanctuaryActionTargets(),
        combat: targetSource.getCombatActionTargets(),
        flagTransfer: targetSource.getFlagTransferTargets(),
        door: targetSource.getDoorActionTargets(),
    };
}

export function collectActionTargetKeys(targetSets: GameSessionActionTargetSets): Set<string> {
    return new Set<string>([
        ...targetSets.sanctuary,
        ...targetSets.combat,
        ...targetSets.flagTransfer,
        ...targetSets.door,
    ]);
}

export function resolveActionContextFromTile(
    tileKey: string,
    targetSets: GameSessionActionTargetSets,
): GameSessionActionContext | null {
    if (targetSets.sanctuary.has(tileKey)) {
        return 'sanctuary';
    }
    if (targetSets.combat.has(tileKey)) {
        return 'combat';
    }
    if (targetSets.flagTransfer.has(tileKey)) {
        return 'flag-transfer';
    }
    if (targetSets.door.has(tileKey)) {
        return 'door';
    }
    return null;
}
