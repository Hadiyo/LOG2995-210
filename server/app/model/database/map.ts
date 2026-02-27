import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
    IsArray,
    IsBoolean,
    IsDateString,
    IsEnum,
    IsInt,
    IsOptional,
    IsString,
    Min,
} from 'class-validator';
import { Document } from 'mongoose';

import { Vec2Document } from '@app/model/database/vec2';
import { GameMode, MapSize, ObjectSize, ObjectType, TileType } from '@common/maps/map.enums';
import { EditorCell, MapObject, Vec2 } from '@common/maps/map.interface';
import { PreviewImageFormat } from '@common/enum';

export type MapDocument = Map & Document;

@Schema({ _id: false })
class EditorCellSchema {
    @ApiProperty({ enum: TileType })
    @Prop({ required: true, enum: TileType })
    @IsEnum(TileType)
    tileType: TileType;

    @ApiProperty()
    @Prop({ required: false })
    @IsOptional()
    @IsBoolean()
    doorOpen?: boolean;
}

const editorCellSchema = SchemaFactory.createForClass(EditorCellSchema);

@Schema({ _id: false })
class MapObjectSchema {
    @ApiProperty()
    @Prop({ required: true })
    @IsInt()
    @Min(1)
    id: number;

    @ApiProperty({ enum: ObjectType })
    @Prop({ required: true, enum: ObjectType })
    @IsEnum(ObjectType)
    type: ObjectType;

    @ApiProperty({ type: Vec2Document })
    @Prop({ required: true, type: Vec2Document })
    position: Vec2;

    @ApiProperty({ enum: ObjectSize })
    @Prop({ required: true, enum: ObjectSize })
    @IsEnum(ObjectSize)
    size: ObjectSize;
}

const mapObjectSchema = SchemaFactory.createForClass(MapObjectSchema);

@Schema({ timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' } })
export class Map {
    @ApiProperty()
    @Prop({ required: true })
    @IsString()
    name: string;

    @ApiProperty()
    @Prop({ required: true })
    @IsString()
    description: string;

    @ApiProperty({ enum: GameMode })
    @Prop({ required: true, enum: GameMode })
    @IsEnum(GameMode)
    mode: GameMode;

    @ApiProperty({ enum: MapSize })
    @Prop({ required: true, enum: MapSize })
    @IsEnum(MapSize)
    size: MapSize;

    @ApiProperty({ format: 'date-time' })
    @Prop({ required: true })
    @IsDateString()
    date: string;

    @ApiProperty()
    @Prop({ required: true })
    @IsBoolean()
    visibility: boolean;

    @ApiProperty({ required: false })
    @Prop({ required: false })
    previewImage?: string;

    @ApiProperty({ required: false, enum: PreviewImageFormat })
    @Prop({ required: false, enum: PreviewImageFormat })
    @IsOptional()
    @IsEnum(PreviewImageFormat)
    previewImageFormat?: PreviewImageFormat;

    @ApiProperty({
        type: [EditorCellSchema],
        description: 'List of cells that compose the map grid.',
    })
    @Prop({ required: true, type: [editorCellSchema] })
    @IsArray()
    map: EditorCell[];

    @ApiProperty({ type: [MapObjectSchema] })
    @Prop({ required: true, type: [mapObjectSchema] })
    @IsArray()
    objects: MapObject[];

    @ApiProperty()
    createdAt?: Date;

    @ApiProperty()
    updatedAt?: Date;

    @ApiPropertyOptional()
    _id?: string;
}

export const mapSchema = SchemaFactory.createForClass(Map);
