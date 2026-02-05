import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsEnum, IsString, IsOptional, Matches, MaxLength } from 'class-validator';

import { GameMode, MapSize } from '@common/enum';
import { EditorCell, MapObject, PreviewImageFormat } from '@common/interface';
import { MAX_PREVIEW_IMAGE_BASE64_LENGTH } from '@common/constants';

export class SaveMapDto {
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

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(MAX_PREVIEW_IMAGE_BASE64_LENGTH)
    @Matches(/^[A-Za-z0-9+/=]+$/)
    previewImage?: string;

    @ApiProperty({ required: false, enum: PreviewImageFormat })
    @IsOptional()
    @IsEnum(PreviewImageFormat)
    previewImageFormat?: PreviewImageFormat;

}
