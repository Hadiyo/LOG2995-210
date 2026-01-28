import { Vec2, vec2Schema } from '@app/model/schema/vec2.schema';
import { TileType } from '@common/enum';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema({ _id: false })
export class EditorCell {
    @Prop({ type: vec2Schema, required: true })
    position: Vec2;

    @Prop({ enum: TileType, required: true })
    tileType: TileType;

    @Prop({ required: true })
    isWalkable: boolean;

    @Prop({ required: true })
    isOccupied: boolean;
}

export const editorCellSchema = SchemaFactory.createForClass(EditorCell);
