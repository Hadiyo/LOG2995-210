import { Body, Controller, Delete, Get, Param, Patch, Post, Put } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';

import { Map } from '@app/model/database/map';
import { SaveMapDto } from '@app/model/dto/map/save-map.dto';
import { UpdateMapVisibilityDto } from '@app/model/dto/map/update-map-visibility.dto';
import { MapService } from '@app/services/map/map.service';

@ApiTags('Maps')
@Controller('maps')
export class MapController {
    constructor(private readonly mapService: MapService) {}

    @ApiOkResponse({
        description: 'Return all maps',
        type: Map,
        isArray: true,
    })
    @Get('/')
    getAllMaps() {
        return this.mapService.getAllMaps();
    }

    @ApiOkResponse({
        description: 'Return all maps summary (without map data)',
        isArray: true,
    })
    @Get('/summary')
    getAllMapsSummary() {
        return this.mapService.getAllMapsSummary();
    }

    @ApiOkResponse({
        description: 'Return visible maps',
        type: Map,
        isArray: true,
    })
    @Get('/visible')
    getVisibleMaps() {
        return this.mapService.getVisibleMaps();
    }

    @ApiOkResponse({
        description: 'Return one map',
        type: Map,
    })
    @Get('/:id/editor')
    getMapByIdForEditor(@Param('id') id: string) {
        return this.mapService.getMapByIdForEditor(id);
    }

    @ApiOkResponse({
        description: 'Return one full map',
        type: Map,
    })
    @Get('/:id')
    getMapById(@Param('id') id: string) {
        return this.mapService.getMapById(id);
    }

    @ApiCreatedResponse({
        description: 'Create a map',
        type: Map,
    })
    @Post('/')
    createMap(@Body() map: SaveMapDto) {
        return this.mapService.createMap(map);
    }

    @ApiOkResponse({
        description: 'Update a map',
        type: Map,
    })
    @Put('/:id')
    updateMap(@Param('id') id: string, @Body() map: SaveMapDto) {
        return this.mapService.updateMap(id, map);
    }

    @ApiOkResponse({
        description: 'Update map visibility',
        type: Map,
    })
    @Patch('/:id/visibility')
    updateMapVisibility(@Param('id') id: string, @Body() payload: UpdateMapVisibilityDto) {
        const isVisible = payload.visibility;
        this.mapService.updateMapVisibility(id, isVisible);
    }

    @ApiOkResponse({
        description: 'Delete a map',
    })
    @Delete('/:id')
    deleteMap(@Param('id') id: string) {
        this.mapService.deleteMap(id);
    }
}
