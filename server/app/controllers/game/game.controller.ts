import { Body, Controller, Delete, Get, Param, Patch, Post, Put } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';

import { Game } from '@app/model/database/game';
import { SaveGameDto } from '@app/model/dto/game/save-game.dto';
import { UpdateGameVisibilityDto } from '@app/model/dto/game/update-visibility.dto';
import { GameService } from '@app/services/game/game.service';

@ApiTags('Games')
@Controller('games')
export class GameController {
    constructor(private readonly gameService: GameService) {}

    @ApiOkResponse({
        description: 'Return all games',
        type: Game,
        isArray: true,
    })
    @Get('/')
    getAllGames() {
        return this.gameService.getAllGames();
    }

    @ApiOkResponse({
        description: 'Return visible games',
        type: Game,
        isArray: true,
    })
    @Get('/visible')
    getVisibleGames() {
        return this.gameService.getVisibleGames();
    }

    @ApiOkResponse({
        description: 'Return one game',
        type: Game,
    })
    @Get('/:id')
    getGameById(@Param('id') id: string) {
        return this.gameService.getGameById(id);
    }

    @ApiCreatedResponse({
        description: 'Create a game',
        type: Game,
    })
    @Post('/')
    createGame(@Body() game: SaveGameDto) {
        return this.gameService.createGame(game);
    }

    @ApiOkResponse({
        description: 'Update a game',
        type: Game,
    })
    @Put('/:id')
    updateGame(@Param('id') id: string, @Body() game: SaveGameDto) {
        return this.gameService.updateGame(id, game);
    }

    @ApiOkResponse({
        description: 'Update game visibility',
        type: Game,
    })
    @Patch('/:id/visibility')
    updateGameVisibility(@Param('id') id: string, @Body() payload: UpdateGameVisibilityDto) {
        const isVisible = payload.visibility;
        return this.gameService.updateGameVisibility(id, isVisible);
    }

    @ApiOkResponse({
        description: 'Delete a game',
    })
    @Delete('/:id')
    deleteGame(@Param('id') id: string) {
        return this.gameService.deleteGame(id);
    }
}
