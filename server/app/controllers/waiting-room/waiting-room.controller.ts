import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { WaitingRoomService } from '@app/services/waiting-room/waiting-room.service';
import { WaitingRoomStatePayload } from '@common/socket-events';

@ApiTags('Waiting Rooms')
@Controller('waiting-rooms')
export class WaitingRoomController {
    constructor(private readonly waitingRoomService: WaitingRoomService) {}

    @ApiOkResponse({
        description: 'Return joinable waiting rooms',
        isArray: true,
    })
    @Get('/available')
    getAvailableWaitingRooms() {
        return this.waitingRoomService.getAvailableWaitingRoomPreviews();
    }

    @ApiOkResponse({
        description: 'Return current waiting room state',
        type: Object,
    })
    @Get('/:accessCode')
    getWaitingRoomState(@Param('accessCode') accessCode: string): WaitingRoomStatePayload {
        const state = this.waitingRoomService.getWaitingRoomState(accessCode);
        if (!state) {
            throw new NotFoundException('Salle introuvable.');
        }

        return state;
    }
}
