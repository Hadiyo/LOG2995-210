import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class UpdateMapVisibilityDto {
    @ApiProperty()
    @IsBoolean()
    visibility: boolean;
}
