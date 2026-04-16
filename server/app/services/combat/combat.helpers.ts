import { FighterStance } from '@common/combat/combat.interface';
import { MatchPlayer } from '@common/game/match.interface';

export function setVirtualStance(player: MatchPlayer): FighterStance | null {
    if(player.controller === 'virtual' && player.virtualProfile === 'aggressive')
        return 'attack';
    else if(player.controller === 'virtual' && player.virtualProfile === 'defensive')
        return 'defense';
    else {
        return null;
    }
}

export function isPlayerVirtual(player: MatchPlayer): boolean {
    return player.controller === 'virtual';
}