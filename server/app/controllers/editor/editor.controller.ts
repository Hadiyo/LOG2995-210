import { EditorService } from '@app/services/editor/editor.service';
import { Controller, Get, HttpStatus, Param, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Response } from 'express';

@ApiTags('Editor')
@Controller('editor')
export class EditorController {
    constructor(private readonly mapService: EditorService) {}

    @Get('/:id')
    async editorMap(@Param('id') mapId: string, @Res() response: Response) {
        try {
            const map = await this.mapService.getMap(mapId);
            if (!map) {
                return response.status(HttpStatus.NOT_FOUND).send(`Map ${mapId} introuvable`);
            }
            return response.status(HttpStatus.OK).json(map);
        } catch (error) {
            return response.status(HttpStatus.BAD_REQUEST).send(error.message);
        }
    }

}
