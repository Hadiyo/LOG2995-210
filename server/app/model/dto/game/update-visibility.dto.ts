import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class UpdateGameVisibilityDto {
    @ApiProperty()
    @IsBoolean()
    visibility: boolean;
}
