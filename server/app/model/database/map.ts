import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ApiProperty } from '@nestjs/swagger';
import { Document } from 'mongoose';

import { Vec2Document, vec2Schema } from '@app/model/database/vec2';
import { GameMode, MapSize, ObjectSize, ObjectType, TileType } from '@common/enum';
import { EditorCell, MapObject, PreviewImageFormat, Vec2 } from '@common/interface';

export type MapDocument = Map & Document;

@Schema({ _id: false })
class EditorCellDocument {
    @ApiProperty({ enum: TileType })
    @Prop({ required: true, enum: TileType })
    tileType: TileType;

    @ApiProperty()
    @Prop({ required: false })
    doorOpen?: boolean;
}

const editorCellSchema = SchemaFactory.createForClass(EditorCellDocument);

@Schema({ _id: false })
class MapObjectDocument {
    @ApiProperty()
    @Prop({ required: true })
    id: number;

    @ApiProperty({ enum: ObjectType })
    @Prop({ required: true, enum: ObjectType })
    type: ObjectType;

    @ApiProperty({ type: Vec2Document })
    @Prop({ required: true, type: vec2Schema })
    position: Vec2;

    @ApiProperty({ enum: ObjectSize })
    @Prop({ required: true, enum: ObjectSize })
    size: ObjectSize;
}

const mapObjectSchema = SchemaFactory.createForClass(MapObjectDocument);

@Schema({ timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' } })
export class Map {
    @ApiProperty()
    @Prop({ required: true })
    name: string;

    @ApiProperty()
    @Prop({ required: true })
    description: string;

    @ApiProperty({ enum: GameMode })
    @Prop({ required: true, enum: GameMode })
    mode: GameMode;

    @ApiProperty({ enum: MapSize })
    @Prop({ required: true, enum: MapSize })
    size: MapSize;

    @ApiProperty()
    @Prop({ required: true })
    date: string;

    @ApiProperty()
    @Prop({ required: true })
    visibility: boolean;

    @ApiProperty({ required: false })
    @Prop({ required: false })
    previewImage?: string;

    @ApiProperty({ required: false, enum: PreviewImageFormat })
    @Prop({ required: false, enum: PreviewImageFormat })
    previewImageFormat?: PreviewImageFormat;

    @ApiProperty({ type: [EditorCellDocument] })
    @Prop({ required: true, type: [editorCellSchema] })
    map: EditorCell[];

    @ApiProperty({ type: [MapObjectDocument] })
    @Prop({ required: true, type: [mapObjectSchema] })
    objects: MapObject[];

    @ApiProperty()
    createdAt?: Date;

    @ApiProperty()
    updatedAt?: Date;

    @ApiProperty()
    _id?: string;
}

export const mapSchema = SchemaFactory.createForClass(Map);
