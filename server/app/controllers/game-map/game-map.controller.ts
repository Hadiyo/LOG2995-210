import { GameMapService } from '@app/services/game-map/game-map.service';
import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('Game-Maps')
@Controller('game-map')
export class GameMapController {
    constructor(private readonly gameMapService: GameMapService) {}

    @ApiOkResponse({
        description: 'Return all game sessions',
        isArray: true,
    })
    @Get('/')
    getMapPreviews() {
        return this.gameMapService.getGameMapPreviews();
    }
}
