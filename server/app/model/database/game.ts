import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ApiProperty } from '@nestjs/swagger';
import { Document } from 'mongoose';

import { GameMode, MapSize, ObjectSize, ObjectType, TileType } from '@common/enum';
import type { EditorCell, MapObject, Vec2 } from '@common/interface';
import { Vec2Document, vec2Schema } from '@app/model/database/vec2';

export type GameDocument = Game & Document;

@Schema({ _id: false })
class EditorCellDocument {
    @ApiProperty({ type: Vec2Document })
    @Prop({ required: true, type: vec2Schema })
    position: Vec2;

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
export class Game {
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

export const gameSchema = SchemaFactory.createForClass(Game);
