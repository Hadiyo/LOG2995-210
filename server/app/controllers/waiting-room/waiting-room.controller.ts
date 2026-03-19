import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { WaitingRoomService } from '@app/services/waiting-room/waiting-room.service';

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
}
