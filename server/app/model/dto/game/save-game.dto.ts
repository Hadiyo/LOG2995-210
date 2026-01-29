import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsEnum, IsString } from 'class-validator';

import { GameMode, MapSize } from '@common/enum';
import type { EditorCell, MapObject } from '@common/interface';

export class SaveGameDto {
    @ApiProperty()
    @IsString()
    id: string;

    @ApiProperty()
    @IsString()
    name: string;

    @ApiProperty()
    @IsString()
    description: string;

    @ApiProperty({ enum: GameMode })
    @IsEnum(GameMode)
    mode: GameMode;

    @ApiProperty({ enum: MapSize })
    @IsEnum(MapSize)
    size: MapSize;

    @ApiProperty()
    @IsString()
    date: string;

    @ApiProperty()
    @IsBoolean()
    visibility: boolean;

    @ApiProperty({ type: [Object] })
    @IsArray()
    map: EditorCell[];

    @ApiProperty({ type: [Object] })
    @IsArray()
    objects: MapObject[];
}
