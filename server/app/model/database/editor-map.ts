import { editorCellSchema } from '@app/model/schema/editor-cell.schema';
import { mapObjectSchema } from '@app/model/schema/map-object.schema';
import { GameMode, MapSize } from '@common/enum';
import { EditorCell, MapObject } from '@common/interface';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ApiProperty } from '@nestjs/swagger';
import { Document } from 'mongoose';

export type EditorMapDocument = EditorMapDb & Document

@Schema()
export class EditorMapDb {
    @ApiProperty()
    @Prop({ required: true })
    _id: string;

    @ApiProperty()
    @Prop({ required: true })
    name: string;

    @ApiProperty()
    @Prop({ required: true })
    description: string;

    @ApiProperty()
    @Prop({ enum: GameMode, required: true })
    mode: GameMode;

    @ApiProperty()
    @Prop({ enum: MapSize, required: true })
    size: MapSize;

    @ApiProperty()
    @Prop({ required: true })
    date: string;

    @Prop({ type: [editorCellSchema], default: [] })
    map: EditorCell[];

    @ApiProperty()
    @Prop({ type: [mapObjectSchema], default: [] })
    objects: MapObject[];

    @ApiProperty()
    @Prop({ default: true })
    visibility: boolean;
}

export const editorMapSchema = SchemaFactory.createForClass(EditorMapDb);
